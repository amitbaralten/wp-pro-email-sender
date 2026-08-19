"use client";

import { useState, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileSpreadsheet, CheckCircle2, FolderPlus } from "lucide-react";
import { uploadCsvAction, UploadState } from "@/app/actions";

interface CsvUploaderProps {
  activeListId?: string;
}

export function CsvUploader({ activeListId = "default" }: CsvUploaderProps) {
  const [state, setState] = useState<UploadState>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [createAsNewList, setCreateAsNewList] = useState(false);
  const [newListName, setNewListName] = useState("");
  const router = useRouter();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!inputRef.current?.files?.[0]) return;
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await uploadCsvAction(null, formData);
      setState(res);
      if (res?.newListId) {
        router.push(`/?listId=${res.newListId}`);
      }
    });
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && inputRef.current) {
      const dt = new DataTransfer();
      dt.items.add(file);
      inputRef.current.files = dt.files;
      setFileName(file.name);

      // Auto propose list name from file name
      if (!newListName) {
        const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]+/g, " ");
        setNewListName(cleanName);
      }
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
          <FileSpreadsheet className="h-4 w-4 text-wppro-600" />
          Upload Recipient Leads CSV (Google Maps Scraper Supported)
        </h2>
        <span className="text-xs text-slate-500">Auto-maps gosom/google-maps-scraper outputs</span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input type="hidden" name="listId" value={activeListId} />

        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`cursor-pointer rounded-xl border-2 border-dashed p-7 text-center transition-all ${
            isDragging
              ? "border-wppro-500 bg-wppro-50/50 dark:border-wppro-400 dark:bg-wppro-950/30"
              : "border-slate-300 hover:border-wppro-400 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/50"
          }`}
        >
          <Upload className="mx-auto mb-2 h-7 w-7 text-wppro-600 dark:text-wppro-400" />
          {fileName ? (
            <p className="text-sm font-semibold text-wppro-700 dark:text-wppro-300">{fileName}</p>
          ) : (
            <>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Drop your CSV file here or click to browse
              </p>
              <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                Auto-detects Google Maps Scraper headers: <code className="font-mono text-[11px] text-wppro-600">title, category, email/emails, full_address, website, phone, rating</code>
              </p>
              <p className="mt-1 text-xs text-wppro-600 dark:text-wppro-400">
                ✓ Already-sent contacts are automatically preserved on re-upload.
              </p>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            name="csv"
            accept=".csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              setFileName(file?.name ?? null);
              if (file && !newListName) {
                const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]+/g, " ");
                setNewListName(cleanName);
              }
            }}
          />
        </div>

        {/* Option to create as new list */}
        <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/50 p-3 dark:border-slate-800/60 dark:bg-slate-950/40">
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={createAsNewList}
              onChange={(e) => setCreateAsNewList(e.target.checked)}
              className="rounded border-slate-300 text-wppro-600 focus:ring-wppro-500"
            />
            <FolderPlus className="h-4 w-4 text-wppro-600" />
            Upload as a Brand New Mailing List
          </label>

          {createAsNewList && (
            <input
              type="text"
              name="newListName"
              placeholder="List Name (e.g. Sydney Real Estate)"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:border-wppro-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          )}
        </div>

        {state?.error && (
          <p className="mt-2 text-xs font-semibold text-red-600 dark:text-red-400">{state.error}</p>
        )}

        {!state?.error && state?.count !== undefined && (
          <div className="mt-2 space-y-1 rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-900/50 dark:bg-emerald-950/20">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4" />
              Loaded {state.count} recipient lead{state.count !== 1 ? "s" : ""}.
            </p>
            {(state.preserved ?? 0) > 0 && (
              <p className="text-xs text-slate-600 dark:text-slate-400">
                🔒 {state.preserved} previously sent contact{state.preserved !== 1 ? "s" : ""} preserved.
              </p>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={isPending || !fileName}
          className="rounded-lg bg-wppro-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-wppro-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending
            ? "Uploading..."
            : createAsNewList
            ? "Upload & Create New List"
            : "Upload to Active List"}
        </button>
      </form>
    </div>
  );
}
