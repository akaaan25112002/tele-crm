"use client";

import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

import ContactsTable from "./ContactsTable";
import AssignDialogs from "./AssignDialogs";

import type { UploadDetailVM } from "../hooks/useUploadDetail";
import { CONTACT_STATUS_OPTIONS } from "../lib/types";
import { assigneeFilterToValue, assigneeValueToFilter } from "../lib/utils";
import type { AdminEditorVM } from "../hooks/useAdminEditor";

async function getMeId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user?.id ?? null;
  } catch {
    return null;
  }
}

export default function ContactsConsole({ vm, editor }: { vm: UploadDetailVM; editor: AdminEditorVM }) {
  // assign dialogs state
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignContactId, setAssignContactId] = useState<string | null>(null);
  const [assignTeleId, setAssignTeleId] = useState<string>("");

  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [bulkAssignTeleId, setBulkAssignTeleId] = useState<string>("");

  // selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const selectedCount = selectedIds.size;

  const pageIds = useMemo(() => vm.contactRows.map((x) => x.id), [vm.contactRows]);

  const allSelectedOnPage = useMemo(() => {
    if (!pageIds.length) return false;
    return pageIds.every((cid) => selectedIds.has(cid));
  }, [pageIds, selectedIds]);

  const toggleSelectAllOnPage = (checked: boolean) => {
    const next = new Set(selectedIds);
    if (checked) pageIds.forEach((cid) => next.add(cid));
    else pageIds.forEach((cid) => next.delete(cid));
    setSelectedIds(next);
  };

  const toggleSelectOne = (cid: string, checked: boolean) => {
    const next = new Set(selectedIds);
    if (checked) next.add(cid);
    else next.delete(cid);
    setSelectedIds(next);
  };

  const clearSelection = () => setSelectedIds(new Set());

  const openAssign = (contactId: string) => {
    setAssignContactId(contactId);
    setAssignTeleId("");
    setAssignOpen(true);
  };

  const openBulkAssign = () => {
    if (selectedIds.size === 0) return;
    setBulkAssignTeleId("");
    setBulkAssignOpen(true);
  };

  const releaseContact = async (contactId: string) => {
    vm.tryCleanupExpiredLeases(); // ok to fire-and-forget
    try {
      const me = await getMeId();
      const nowIso = new Date().toISOString();

      const { error } = await supabase
        .from("contacts")
        .update({
          assigned_to: null,
          assigned_at: null,
          lease_expires_at: null,
          current_status: "NEW",

          // ✅ keep audit even after release
          last_action_by: me,
          last_action_at: nowIso,
        })
        .eq("id", contactId);

      if (error) throw error;
      await Promise.all([vm.loadKpis(), vm.loadContacts()]);
    } catch (e: any) {
      alert(e?.message ?? "Release failed");
    }
  };

  const confirmAssign = async () => {
    if (!assignContactId) return;
    if (!assignTeleId) return alert("Choose a tele");

    try {
      const me = await getMeId();
      const nowIso = new Date().toISOString();

      const leaseMs = 270 * 60 * 1000;
      const leaseIso = new Date(Date.now() + leaseMs).toISOString();

      const { error } = await supabase
        .from("contacts")
        .update({
          assigned_to: assignTeleId,
          assigned_at: nowIso,
          lease_expires_at: leaseIso,
          current_status: "ASSIGNED",

          // ✅ audit for admin action
          last_action_by: me,
          last_action_at: nowIso,
        })
        .eq("id", assignContactId);

      if (error) throw error;

      setAssignOpen(false);
      await Promise.all([vm.loadKpis(), vm.loadContacts()]);
    } catch (e: any) {
      alert(e?.message ?? "Assign failed");
    }
  };

  const confirmBulkAssign = async () => {
    if (selectedIds.size === 0) return;
    if (!bulkAssignTeleId) return alert("Choose a tele");

    try {
      const me = await getMeId();
      const nowIso = new Date().toISOString();

      const leaseMs = 270 * 60 * 1000;
      const leaseIso = new Date(Date.now() + leaseMs).toISOString();

      const ids = Array.from(selectedIds);
      const { error } = await supabase
        .from("contacts")
        .update({
          assigned_to: bulkAssignTeleId,
          assigned_at: nowIso,
          lease_expires_at: leaseIso,
          current_status: "ASSIGNED",

          // ✅ audit for admin action
          last_action_by: me,
          last_action_at: nowIso,
        })
        .in("id", ids);

      if (error) throw error;

      setBulkAssignOpen(false);
      clearSelection();
      await Promise.all([vm.loadKpis(), vm.loadContacts()]);
    } catch (e: any) {
      alert(e?.message ?? "Bulk assign failed");
    }
  };

  const bulkRelease = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Release ${selectedIds.size} contacts?`)) return;

    try {
      const me = await getMeId();
      const nowIso = new Date().toISOString();

      const ids = Array.from(selectedIds);
      const { error } = await supabase
        .from("contacts")
        .update({
          assigned_to: null,
          assigned_at: null,
          lease_expires_at: null,
          current_status: "NEW",

          // ✅ audit for admin action
          last_action_by: me,
          last_action_at: nowIso,
        })
        .in("id", ids);

      if (error) throw error;

      clearSelection();
      await Promise.all([vm.loadKpis(), vm.loadContacts()]);
    } catch (e: any) {
      alert(e?.message ?? "Bulk release failed");
    }
  };

  const totalPages = Math.max(1, Math.ceil(vm.contactTotal / vm.pageSize));
  const assigneeSelectValue = assigneeFilterToValue(vm.filterAssignee);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle>Contacts</CardTitle>
            <div className="text-sm opacity-70">Ops table • click Edit for full details</div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button variant="outline" onClick={() => vm.loadContacts()} disabled={vm.loading}>
              Refresh data
            </Button>

            <Input
              placeholder="Search name/company/email/phone..."
              value={vm.q}
              onChange={(e) => {
                vm.setPage(1);
                vm.setQ(e.target.value);
              }}
              className="sm:w-80"
            />

            <Select
              value={vm.filterStatus}
              onValueChange={(v) => {
                vm.setPage(1);
                vm.setFilterStatus(v as any);
              }}
            >
              <SelectTrigger className="sm:w-44">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {CONTACT_STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={assigneeSelectValue}
              onValueChange={(v) => {
                vm.setPage(1);
                vm.setFilterAssignee(assigneeValueToFilter(v));
              }}
            >
              <SelectTrigger className="sm:w-56">
                <SelectValue placeholder="Assignee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">ALL</SelectItem>
                <SelectItem value="UNASSIGNED">UNASSIGNED/EXPIRED</SelectItem>
                {vm.memberTeles.map((t) => (
                  <SelectItem key={t.id} value={`TELE:${t.id}`}>
                    {t.full_name ?? t.id.slice(0, 8)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/30 p-2">
          <div className="text-sm">
            Selected: <span className="font-medium tabular-nums">{selectedCount}</span>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={selectedCount === 0 || vm.loading} onClick={openBulkAssign}>
              Bulk Assign
            </Button>
            <Button variant="outline" disabled={selectedCount === 0 || vm.loading} onClick={bulkRelease}>
              Bulk Release
            </Button>
            <Button variant="outline" disabled={selectedCount === 0 || vm.loading} onClick={clearSelection}>
              Clear
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="flex items-center justify-between text-sm mb-3">
          <div className="opacity-70">
            Total: <span className="font-medium tabular-nums">{vm.contactTotal}</span> • Page{" "}
            <span className="font-medium tabular-nums">{vm.page}</span> /{" "}
            <span className="font-medium tabular-nums">{totalPages}</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" disabled={vm.page <= 1} onClick={() => vm.setPage((p) => Math.max(1, p - 1))}>
              Prev
            </Button>
            <Button
              variant="outline"
              disabled={vm.page >= totalPages}
              onClick={() => vm.setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>

        <ContactsTable
          rows={vm.contactRows}
          loading={vm.loading}
          sortIcon={vm.sortIcon}
          clickSort={vm.clickSort}
          selectedIds={selectedIds}
          onToggleOne={toggleSelectOne}
          allSelectedOnPage={allSelectedOnPage}
          onToggleAllOnPage={toggleSelectAllOnPage}
          onEdit={(c) => editor.openEditor(c)}
          onAssign={(id) => openAssign(id)}
          onRelease={(id) => releaseContact(id)}
        />

        <AssignDialogs
          loading={vm.loading}
          memberTeles={vm.memberTeles}
          assignOpen={assignOpen}
          setAssignOpen={setAssignOpen}
          assignTeleId={assignTeleId}
          setAssignTeleId={setAssignTeleId}
          onConfirmAssign={confirmAssign}
          bulkAssignOpen={bulkAssignOpen}
          setBulkAssignOpen={setBulkAssignOpen}
          bulkAssignTeleId={bulkAssignTeleId}
          setBulkAssignTeleId={setBulkAssignTeleId}
          selectedCount={selectedCount}
          onConfirmBulkAssign={confirmBulkAssign}
        />
      </CardContent>
    </Card>
  );
}