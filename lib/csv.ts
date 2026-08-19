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

const LISTS_DIR = path.join(process.cwd(), "public", "lists");
const MANIFEST_PATH = path.join(LISTS_DIR, "manifest.json");
const DEFAULT_CSV_PATH = path.join(process.cwd(), "public", "users.csv");

function getListFilePath(listId: string): string {
  if (listId === "default" || listId === "users") {
    return DEFAULT_CSV_PATH;
  }
  const safeId = listId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(LISTS_DIR, `${safeId}.csv`);
}

export async function getMailingLists(): Promise<MailingListMeta[]> {
  if (!fs.existsSync(LISTS_DIR)) {
    fs.mkdirSync(LISTS_DIR, { recursive: true });
  }

  let manifest: MailingListMeta[] = [];
  if (fs.existsSync(MANIFEST_PATH)) {
    try {
      manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf-8"));
    } catch {
      manifest = [];
    }
  }

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

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), "utf-8");
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
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(lists, null, 2), "utf-8");

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
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(updated, null, 2), "utf-8");
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

  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, serialized, "utf-8");

  if (fs.existsSync(MANIFEST_PATH)) {
    try {
      const manifest: MailingListMeta[] = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf-8"));
      const idx = manifest.findIndex((l) => l.id === listId);
      if (idx !== -1) {
        manifest[idx].totalLeads = users.length;
        manifest[idx].sentCount = users.filter((u) => u.status === "sent").length;
        fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), "utf-8");
      }
    } catch {
      // Ignore manifest update errors
    }
  }
}

export async function readUsersCsv(): Promise<UserRow[]> {
  return readListUsersCsv("default");
}

export async function writeUsersCsv(users: UserRow[]): Promise<void> {
  return writeListUsersCsv("default", users);
}
