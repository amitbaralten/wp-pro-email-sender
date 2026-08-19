"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Layers, Plus, Trash2, Check, FolderPlus, MapPin } from "lucide-react";
import { MailingListMeta } from "@/lib/csv";
import { createMailingListAction, deleteMailingListAction } from "@/app/actions";

interface MailingListSelectorProps {
  lists: MailingListMeta[];
  activeListId: string;
}

export function MailingListSelector({ lists, activeListId }: MailingListSelectorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const activeList = lists.find((l) => l.id === activeListId) || lists[0];

  function handleSelectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const listId = e.target.value;
    const params = new URLSearchParams(searchParams.toString());
    params.set("listId", listId);
    router.push(`/?${params.toString()}`);
  }

  function handleCreateList(e: React.FormEvent) {
    e.preventDefault();
    if (!newListName.trim()) return;
    setError(null);

    startTransition(async () => {
      const res = await createMailingListAction(newListName.trim());
      if (res.error) {
        setError(res.error);
      } else if (res.list) {
        setNewListName("");
        setShowCreateModal(false);
        const params = new URLSearchParams(searchParams.toString());
        params.set("listId", res.list.id);
        router.push(`/?${params.toString()}`);
      }
    });
  }

  function handleDeleteCurrentList() {
    if (activeListId === "default") return;
    if (!confirm(`Are you sure you want to delete the mailing list "${activeList?.name}"?`)) return;

    startTransition(async () => {
      const res = await deleteMailingListAction(activeListId);
      if (res.error) {
        alert(res.error);
      } else {
        const params = new URLSearchParams(searchParams.toString());
        params.set("listId", "default");
        router.push(`/?${params.toString()}`);
      }
    });
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-wppro-100 text-wppro-600 dark:bg-wppro-950 dark:text-wppro-400">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Active Mailing List:
              </span>
              <span className="flex items-center gap-1 text-xs font-bold text-wppro-600 dark:text-wppro-400">
                <MapPin className="h-3 w-3" /> Scraper / Target Campaign
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <select
                value={activeListId}
                onChange={handleSelectChange}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-900 shadow-sm focus:border-wppro-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l.totalLeads} leads, {l.sentCount} sent)
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <FolderPlus className="h-3.5 w-3.5 text-wppro-600" />
            + New List
          </button>

          {activeListId !== "default" && (
            <button
              onClick={handleDeleteCurrentList}
              disabled={isPending}
              title="Delete Active List"
              className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-400"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete List
            </button>
          )}
        </div>
      </div>

      {/* Modal to Create New List */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Create New Mailing List
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Target a new scraped lead campaign (e.g. &quot;Sydney Real Estate Scraped&quot; or &quot;Google Maps Lawyers&quot;)
            </p>

            <form onSubmit={handleCreateList} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500">
                  Mailing List Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sydney Real Estate Leads"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-wppro-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              {error && <p className="text-xs font-semibold text-red-600 dark:text-red-400">{error}</p>}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending || !newListName.trim()}
                  className="rounded-lg bg-wppro-600 px-4 py-2 text-xs font-semibold text-white hover:bg-wppro-700 disabled:opacity-50"
                >
                  {isPending ? "Creating..." : "Create List"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
