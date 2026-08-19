"use client";

import { useState, useTransition } from "react";
import {
  Search,
  Send,
  Trash2,
  Eye,
  CheckCircle2,
  Clock,
  Download,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { UserRow, serializeUsersCsv } from "@/lib/csv-parser";
import { sendSingleEmailAction, deleteUsersAction } from "@/app/actions";
import { EmailPreviewModal } from "./email-preview-modal";

interface EmailTableProps {
  users: UserRow[];
  activeListId?: string;
}

export function EmailTable({ users, activeListId = "default" }: EmailTableProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "sent" | "delivered" | "bounced">("all");
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [previewUser, setPreviewUser] = useState<UserRow | null>(null);
  const [sendingIndex, setSendingIndex] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  const filteredUsers = users.filter((u) => {
    const q = search.toLowerCase();
    const matchesSearch =
      u.email.toLowerCase().includes(q) ||
      u.firstName.toLowerCase().includes(q) ||
      u.lastName.toLowerCase().includes(q) ||
      u.company.toLowerCase().includes(q) ||
      u.title.toLowerCase().includes(q) ||
      u.address.toLowerCase().includes(q) ||
      u.segment.toLowerCase().includes(q);

    if (!matchesSearch) return false;

    if (statusFilter === "pending") return u.status === "pending";
    if (statusFilter === "sent") return u.status === "sent";
    if (statusFilter === "delivered") return u.deliveryStatus === "delivered" || u.deliveryStatus === "opened" || u.deliveryStatus === "clicked";
    if (statusFilter === "bounced") return u.deliveryStatus === "bounced" || u.deliveryStatus === "failed";

    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const allFilteredSelected =
    paginatedUsers.length > 0 &&
    paginatedUsers.every((u) => selectedEmails.has(u.email.toLowerCase()));

  function toggleSelectAll() {
    const next = new Set(selectedEmails);
    if (allFilteredSelected) {
      paginatedUsers.forEach((u) => next.delete(u.email.toLowerCase()));
    } else {
      paginatedUsers.forEach((u) => next.add(u.email.toLowerCase()));
    }
    setSelectedEmails(next);
  }

  function toggleSelectRow(email: string) {
    const next = new Set(selectedEmails);
    const lower = email.toLowerCase();
    if (next.has(lower)) {
      next.delete(lower);
    } else {
      next.add(lower);
    }
    setSelectedEmails(next);
  }

  function handleDeleteSelected() {
    if (selectedEmails.size === 0) return;
    if (!confirm(`Are you sure you want to remove ${selectedEmails.size} selected recipient(s)?`)) return;

    startTransition(async () => {
      await deleteUsersAction(Array.from(selectedEmails), activeListId);
      setSelectedEmails(new Set());
    });
  }

  function handleSendSingle(user: UserRow, indexInFullList: number, force = false) {
    setSendingIndex(indexInFullList);
    startTransition(async () => {
      await sendSingleEmailAction(indexInFullList, user.email, force, activeListId);
      setSendingIndex(null);
    });
  }

  function handleExportCsv() {
    const serialized = serializeUsersCsv(filteredUsers);
    const blob = new Blob([serialized], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `wppro_leads_${activeListId}_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      {/* Table Toolbar */}
      <div className="flex flex-col gap-4 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-2">
          {/* Search bar */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search leads, company, category..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:border-wppro-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-950">
            {(["all", "pending", "sent", "delivered", "bounced"] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => {
                  setStatusFilter(filter);
                  setCurrentPage(1);
                }}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold capitalize transition-all ${
                  statusFilter === filter
                    ? "bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        {/* Action bar */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            disabled={filteredUsers.length === 0}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            <Download className="h-3.5 w-3.5" /> Export CSV
          </button>

          {selectedEmails.size > 0 && (
            <button
              onClick={handleDeleteSelected}
              disabled={isPending}
              className="flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-400"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete {selectedEmails.size} selected
            </button>
          )}
          <span className="text-xs text-slate-500">
            Showing {filteredUsers.length} of {users.length} leads
          </span>
        </div>
      </div>

      {/* Table Render */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-200 bg-slate-50 uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-400">
            <tr>
              <th className="p-3.5 w-8">
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={toggleSelectAll}
                  className="rounded border-slate-300 text-wppro-600 focus:ring-wppro-500 dark:border-slate-700"
                />
              </th>
              <th className="p-3.5 font-bold">Recipient Lead</th>
              <th className="p-3.5 font-bold">Company / Category</th>
              <th className="p-3.5 font-bold">Location</th>
              <th className="p-3.5 font-bold">Fit Score</th>
              <th className="p-3.5 font-bold">Status</th>
              <th className="p-3.5 font-bold">Resend Delivery</th>
              <th className="p-3.5 font-bold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {paginatedUsers.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-slate-400">
                  No recipient leads match your filter or search query.
                </td>
              </tr>
            ) : (
              paginatedUsers.map((u) => {
                const globalIndex = users.findIndex((orig) => orig.email === u.email);
                const isSelected = selectedEmails.has(u.email.toLowerCase());
                const fullName = [u.firstName, u.lastName].filter(Boolean).join(" ");

                return (
                  <tr
                    key={u.email}
                    className={`transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40 ${
                      isSelected ? "bg-wppro-50/40 dark:bg-wppro-950/20" : ""
                    }`}
                  >
                    <td className="p-3.5">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectRow(u.email)}
                        className="rounded border-slate-300 text-wppro-600 focus:ring-wppro-500 dark:border-slate-700"
                      />
                    </td>
                    <td className="p-3.5">
                      <div className="font-bold text-slate-900 dark:text-white">
                        {fullName || u.email.split("@")[0]}
                      </div>
                      <div className="text-slate-500 font-mono text-[11px]">{u.email}</div>
                    </td>
                    <td className="p-3.5">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">
                        {u.company || "-"}
                      </div>
                      <div className="text-slate-500 text-[11px] flex items-center gap-1">
                        {u.segment ? (
                          <span className="rounded bg-slate-100 px-1.5 py-0.2 text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            {u.segment}
                          </span>
                        ) : (
                          u.title || "-"
                        )}
                      </div>
                    </td>
                    <td className="p-3.5 text-slate-600 dark:text-slate-400">
                      {u.address || "-"}
                    </td>
                    <td className="p-3.5">
                      {u.fitScore !== null ? (
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${
                            u.fitScore >= 75
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : u.fitScore >= 50
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                              : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                          }`}
                        >
                          {u.fitScore} ({u.fitLabel || "Score"})
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="p-3.5">
                      {u.status === "sent" ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                          <CheckCircle2 className="h-3 w-3" />
                          Sent ({u.sentAt})
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                          <Clock className="h-3 w-3" />
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="p-3.5">
                      {u.deliveryStatus ? (
                        <span
                          className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold capitalize ${
                            u.deliveryStatus === "delivered" || u.deliveryStatus === "opened" || u.deliveryStatus === "clicked"
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                              : u.deliveryStatus === "bounced" || u.deliveryStatus === "failed"
                              ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
                              : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                          }`}
                        >
                          {u.deliveryStatus}
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setPreviewUser(u)}
                          title="Preview Personalized Email"
                          className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleSendSingle(u, globalIndex, u.status === "sent")}
                          disabled={sendingIndex === globalIndex || isPending}
                          title={u.status === "sent" ? "Force Resend Email" : "Send Email Now"}
                          className="flex items-center gap-1 rounded-lg bg-wppro-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-wppro-700 disabled:opacity-50"
                        >
                          <Send className="h-3 w-3" />
                          {sendingIndex === globalIndex
                            ? "..."
                            : u.status === "sent"
                            ? "Resend"
                            : "Send"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 dark:border-slate-800">
        <div className="text-xs text-slate-500">
          Page {currentPage} of {totalPages}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Previous
          </button>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Next <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Live Preview Modal */}
      {previewUser && (
        <EmailPreviewModal user={previewUser} onClose={() => setPreviewUser(null)} />
      )}
    </div>
  );
}
