"use client";

import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import type { ContactRow, SortKey } from "../lib/types";
import { fmtDT, isLeaseActive, isTerminalStatus } from "../lib/utils";

export default function ContactsTable(props: {
  rows: ContactRow[];
  loading: boolean;

  sortIcon: (k: SortKey) => string;
  clickSort: (k: SortKey) => void;

  selectedIds: Set<string>;
  onToggleOne: (id: string, checked: boolean) => void;
  allSelectedOnPage: boolean;
  onToggleAllOnPage: (checked: boolean) => void;

  onEdit: (c: ContactRow) => void;
  onAssign: (id: string) => void;
  onRelease: (id: string, assigned_to: string | null) => void;
}) {
  const {
    rows,
    loading,
    sortIcon,
    clickSort,
    selectedIds,
    onToggleOne,
    allSelectedOnPage,
    onToggleAllOnPage,
    onEdit,
    onAssign,
    onRelease,
  } = props;

  return (
    <div className="rounded-md border">
      <div className="overflow-x-auto">
        <div className="min-w-[1400px]">
          <div className="max-h-[60vh] overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead className="w-[44px]">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={allSelectedOnPage}
                      onChange={(e) => onToggleAllOnPage(e.target.checked)}
                    />
                  </TableHead>

                  <TableHead className="min-w-[90px] cursor-pointer" onClick={() => clickSort("row_no")}>
                    Row {sortIcon("row_no")}
                  </TableHead>

                  <TableHead className="min-w-[260px]">Contact</TableHead>

                  <TableHead className="cursor-pointer" onClick={() => clickSort("current_status")}>
                    Status {sortIcon("current_status")}
                  </TableHead>

                  <TableHead className="cursor-pointer" onClick={() => clickSort("assigned_name")}>
                    Assignee {sortIcon("assigned_name")}
                  </TableHead>

                  <TableHead className="min-w-[180px] cursor-pointer" onClick={() => clickSort("lease_expires_at")}>
                    Lease {sortIcon("lease_expires_at")}
                  </TableHead>

                  <TableHead className="min-w-[160px] cursor-pointer" onClick={() => clickSort("last_called_at")}>
                    Last Call {sortIcon("last_called_at")}
                  </TableHead>

                  <TableHead className="min-w-[220px]">Last Result</TableHead>
                  <TableHead className="min-w-[320px]">Last Note</TableHead>
                  <TableHead className="text-right min-w-[260px]">Actions</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {rows.map((c) => {
                  const leaseActive = isLeaseActive(c.lease_expires_at);
                  const checked = selectedIds.has(c.id);

                  const statusUpper = String(c.current_status ?? "").toUpperCase();
                  const suspiciousSuccess =
                    (c.last_result_group ?? "").toUpperCase() === "SUCCESS" && statusUpper === "ASSIGNED";

                  const leaseLabel = (() => {
                    if (isTerminalStatus(statusUpper)) return "—";
                    if (!c.assigned_to) return "UNASSIGNED";
                    if (leaseActive) return "LOCKED";
                    return "EXPIRED";
                  })();

                  return (
                    <TableRow key={c.id}>
                      <TableCell>
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={checked}
                          onChange={(e) => onToggleOne(c.id, e.target.checked)}
                        />
                      </TableCell>

                      <TableCell className="tabular-nums">
                        {c.row_no ?? "—"}
                        <div className="text-xs opacity-60 truncate">{c.id.slice(0, 8)}</div>
                      </TableCell>

                      <TableCell>
                        <div className="font-medium">
                          {c.given_name || c.family_name
                            ? `${c.given_name ?? ""} ${c.family_name ?? ""}`.trim()
                            : c.company_name ?? "—"}
                        </div>
                        <div className="text-xs opacity-60 break-words whitespace-pre-wrap">
                          {c.company_name ?? "—"} • {c.email ?? "—"} • {c.normalized_phone ?? "—"}
                        </div>
                      </TableCell>

                      <TableCell>
                        <StatusBadge status={c.current_status} kind="contact" />
                        <div className="text-xs opacity-60 mt-1">
                          attempts: <span className="tabular-nums">{c.call_attempts ?? 0}</span>
                        </div>
                        {suspiciousSuccess ? (
                          <div className="mt-1 text-xs text-amber-600">
                            ⚠ SUCCESS but status=ASSIGNED → check call_results.final_status mapping
                          </div>
                        ) : null}
                      </TableCell>

                      <TableCell>
                        <div className="font-medium break-words">
                          {c.assigned_name ?? (c.assigned_to ? c.assigned_to.slice(0, 8) : "—")}
                        </div>
                        <div className="text-xs opacity-60">assigned: {fmtDT(c.assigned_at)}</div>
                      </TableCell>

                      <TableCell>
                        <div className="text-sm font-medium">{leaseLabel}</div>
                        <div className="text-xs opacity-60">expires: {fmtDT(c.lease_expires_at)}</div>
                      </TableCell>

                      <TableCell>
                        <div className="font-medium">
                            {c.last_action_name ?? "—"}
                        </div>
                        <div className="text-xs opacity-60">
                            {fmtDT(c.last_action_at)}
                        </div>
                        </TableCell>

                      <TableCell>
                        <div className="text-sm font-medium break-words">{c.last_result_group ?? "—"}</div>
                        <div className="text-xs opacity-60 break-words">{c.last_result_detail ?? "—"}</div>
                      </TableCell>

                      <TableCell className="max-w-[380px]">
                        <div className="text-sm break-words whitespace-pre-wrap">{c.last_note_text ?? "—"}</div>
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" onClick={() => onEdit(c)} disabled={loading}>
                            Edit
                          </Button>
                          <Button variant="outline" onClick={() => onAssign(c.id)} disabled={loading}>
                            Assign
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => onRelease(c.id, c.assigned_to)}
                            disabled={loading || !c.assigned_to}
                          >
                            Release
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}

                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="py-10 text-center text-sm opacity-70">
                      No contacts match the current filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
}