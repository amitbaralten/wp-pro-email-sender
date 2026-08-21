import fs from "fs";
import path from "path";
import { put, head } from "@vercel/blob";
import {
  parseUsersCsv,
  serializeUsersCsv,
  UserRow,
  MailingListMeta,
} from "./csv-parser";

export * from "./csv-parser";

const DATA_DIR = process.env.APP_DATA_DIR || path.join(process.cwd(), "webdata");
const LISTS_DIR = path.join(DATA_DIR, "lists");
const MANIFEST_PATH = path.join(LISTS_DIR, "manifest.json");
const DEFAULT_CSV_PATH = path.join(LISTS_DIR, "default.csv");
const LEGACY_LISTS_DIR = path.join(process.cwd(), "public", "lists");
const LEGACY_MANIFEST_PATH = path.join(LEGACY_LISTS_DIR, "manifest.json");
const LEGACY_DEFAULT_CSV_PATH = path.join(process.cwd(), "public", "users.csv");

const listLocks = new Map<string, Promise<unknown>>();

function getListFilePath(listId: string): string {
  if (listId === "default" || listId === "users") {
    return DEFAULT_CSV_PATH;
  }
  const safeId = listId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(LISTS_DIR, `${safeId}.csv`);
}

function getLegacyListFilePath(listId: string): string {
  if (listId === "default" || listId === "users") {
    return LEGACY_DEFAULT_CSV_PATH;
  }
  const safeId = listId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(LEGACY_LISTS_DIR, `${safeId}.csv`);
}

function ensureListsDir(): void {
  if (!fs.existsSync(LISTS_DIR)) {
    fs.mkdirSync(LISTS_DIR, { recursive: true });
  }
}

function readManifest(): MailingListMeta[] {
  const manifestPath = fs.existsSync(MANIFEST_PATH) ? MANIFEST_PATH : LEGACY_MANIFEST_PATH;
  if (!fs.existsSync(manifestPath)) return [];

  try {
    return JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  } catch {
    return [];
  }
}

function writeJsonAtomic(filePath: string, value: unknown): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(value, null, 2), "utf-8");
  fs.renameSync(tmpPath, filePath);
}

function writeTextAtomic(filePath: string, value: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmpPath, value, "utf-8");
  fs.renameSync(tmpPath, filePath);
}

export async function withListLock<T>(listId: string, task: () => Promise<T>): Promise<T> {
  const key = listId || "default";
  const previous = listLocks.get(key) || Promise.resolve();
  const next = previous.catch(() => undefined).then(task);

  listLocks.set(
    key,
    next.finally(() => {
      if (listLocks.get(key) === next) {
        listLocks.delete(key);
      }
    })
  );

  return next;
}

export async function getMailingLists(): Promise<MailingListMeta[]> {
  ensureListsDir();
  const manifest = readManifest();

  const defaultIdx = manifest.findIndex((m) => m.id === "default");
  const defaultUsers = await readListUsersCsv("default");
  const defaultSent = defaultUsers.filter((u) => u.status === "sent").length;

  const defaultMeta: MailingListMeta = {
    id: "default",
    name: "Default Master List",
    createdAt: new Date().toISOString().slice(0, 10),
    totalLeads: defaultUsers.length,
    sentCount: defaultSent,
  };

  if (defaultIdx === -1) {
    manifest.unshift(defaultMeta);
  } else {
    manifest[defaultIdx] = defaultMeta;
  }

  writeJsonAtomic(MANIFEST_PATH, manifest);
  return manifest;
}

export async function createMailingList(name: string, csvText?: string): Promise<MailingListMeta> {
  const safeId = name.toLowerCase().replace(/[^a-zA-Z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || `list-${Date.now()}`;
  const lists = await getMailingLists();
  
  if (lists.some((l) => l.id === safeId)) {
    throw new Error(`A mailing list with ID '${safeId}' already exists.`);
  }

  const initialUsers = csvText ? parseUsersCsv(csvText) : [];
  const sentCount = initialUsers.filter((u) => u.status === "sent").length;

  const newMeta: MailingListMeta = {
    id: safeId,
    name: name.trim(),
    createdAt: new Date().toISOString().slice(0, 10),
    totalLeads: initialUsers.length,
    sentCount,
  };

  await writeListUsersCsv(safeId, initialUsers);

  lists.push(newMeta);
  writeJsonAtomic(MANIFEST_PATH, lists);

  return newMeta;
}

export async function deleteMailingList(listId: string): Promise<void> {
  if (listId === "default") {
    throw new Error("Cannot delete the default master list.");
  }

  const file = getListFilePath(listId);
  if (fs.existsSync(file)) {
    fs.unlinkSync(file);
  }

  const lists = await getMailingLists();
  const updated = lists.filter((l) => l.id !== listId);
  writeJsonAtomic(MANIFEST_PATH, updated);
}

export async function readListUsersCsv(listId = "default"): Promise<UserRow[]> {
  const filePath = getListFilePath(listId);
  const token = process.env.BLOB_READ_WRITE_TOKEN;

  if (token) {
    try {
      const blobKey = `lists/${listId}.csv`;
      const blob = await head(blobKey);
      if (blob && blob.url) {
        const res = await fetch(blob.url);
        if (res.ok) {
          return parseUsersCsv(await res.text());
        }
      }
    } catch (e) {
      console.warn("Blob read error, falling back to local file:", e);
    }
  }

  if (fs.existsSync(filePath)) {
    return parseUsersCsv(fs.readFileSync(filePath, "utf-8"));
  }

  const legacyFilePath = getLegacyListFilePath(listId);
  if (fs.existsSync(legacyFilePath)) {
    return parseUsersCsv(fs.readFileSync(legacyFilePath, "utf-8"));
  }

  return [];
}

export async function writeListUsersCsv(listId = "default", users: UserRow[]): Promise<void> {
  const serialized = serializeUsersCsv(users);
  const filePath = getListFilePath(listId);
  const token = process.env.BLOB_READ_WRITE_TOKEN;

  if (token) {
    try {
      await put(`lists/${listId}.csv`, serialized, {
        access: "public",
        contentType: "text/csv",
        addRandomSuffix: false,
      });
    } catch (e) {
      console.warn("Blob write error, writing locally:", e);
    }
  }

  writeTextAtomic(filePath, serialized);

  if (fs.existsSync(MANIFEST_PATH)) {
    try {
      const manifest: MailingListMeta[] = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf-8"));
      const idx = manifest.findIndex((l) => l.id === listId);
      if (idx !== -1) {
        manifest[idx].totalLeads = users.length;
        manifest[idx].sentCount = users.filter((u) => u.status === "sent").length;
        writeJsonAtomic(MANIFEST_PATH, manifest);
      }
    } catch {
    }
  }
}

export async function readUsersCsv(): Promise<UserRow[]> {
  return readListUsersCsv("default");
}

export async function writeUsersCsv(users: UserRow[]): Promise<void> {
  return writeListUsersCsv("default", users);
}
