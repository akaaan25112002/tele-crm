"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import type { AdminEditorVM } from "../hooks/useAdminEditor";

export default function EditorDialog(props: {
  vm: AdminEditorVM;
  onSaved?: () => Promise<void> | void; // callback để refresh list/kpis
}) {
  const { vm, onSaved } = props;

  const renderSnapshotRow = (label: string, keyName: string) => {
    const v = vm.snapshot ? vm.snapshot[keyName] : undefined;
    const text = v === null || v === undefined || String(v) === "" ? "—" : String(v);
    const changed = vm.editedFields.has(keyName);
    return (
      <div className="grid grid-cols-12 gap-2 py-1">
        <div className="col-span-4 text-xs opacity-70">{label}</div>
        <div className={`col-span-8 text-sm break-words whitespace-pre-wrap ${changed ? "font-medium" : ""}`}>
          {text}
          {changed ? <span className="ml-2 text-xs opacity-60">(edited)</span> : null}
        </div>
      </div>
    );
  };

  const save = async () => {
    const ok = await vm.saveEditor();
    if (ok && onSaved) await onSaved();
  };

  return (
    <Dialog open={vm.editOpen} onOpenChange={vm.setEditOpen}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden p-0">
        <div className="p-6 pb-3">
          <DialogHeader>
            <DialogTitle>Admin Contact Editor</DialogTitle>
          </DialogHeader>
        </div>

        <div className="px-6 pb-3 overflow-y-auto max-h-[calc(85vh-140px)] pr-4">
          {!vm.editTarget ? (
            <div className="text-sm opacity-70">No contact selected.</div>
          ) : (
            <div className="space-y-4">
              <div className="text-xs opacity-60">
                ContactID: <span className="font-medium">{vm.editTarget.id}</span> • Row:{" "}
                <span className="font-medium">{vm.editTarget.row_no ?? "—"}</span>
              </div>

              <div className="rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <div className="font-medium">Current snapshot (all fields)</div>
                  <div className="text-xs opacity-60">Fields marked (edited) have edit logs</div>
                </div>
                <div className="mt-2 border-t pt-2">
                  {renderSnapshotRow("Given name", "given_name")}
                  {renderSnapshotRow("Family name", "family_name")}
                  {renderSnapshotRow("Company name", "company_name")}
                  {renderSnapshotRow("Email", "email")}
                  {renderSnapshotRow("Telephone", "telephone_number")}
                  {renderSnapshotRow("Mobile CC", "mobile_country_code")}
                  {renderSnapshotRow("Mobile number", "mobile_number")}
                  {renderSnapshotRow("Job title", "job_title")}
                  {renderSnapshotRow("Department", "department")}
                  {renderSnapshotRow("Address line1", "address_line1")}
                  {renderSnapshotRow("Address line2", "address_line2")}
                  {renderSnapshotRow("Address line3", "address_line3")}
                  {renderSnapshotRow("City/Ward", "city_ward")}
                  {renderSnapshotRow("State", "state")}
                  {renderSnapshotRow("Country", "country")}
                  {renderSnapshotRow("Current status", "current_status")}
                  {renderSnapshotRow("Assigned to", "assigned_to")}
                  {renderSnapshotRow("Assigned at", "assigned_at")}
                  {renderSnapshotRow("Lease expires", "lease_expires_at")}
                  {renderSnapshotRow("Call attempts", "call_attempts")}
                  {renderSnapshotRow("Last called at", "last_called_at")}
                  {renderSnapshotRow("Last result id", "last_result_id")}
                  {renderSnapshotRow("Last note text", "last_note_text")}
                </div>
              </div>

              <div className="rounded-lg border p-3 space-y-3">
                <div className="font-medium">Edit contact info</div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <div className="text-xs opacity-70">Given name</div>
                    <Input value={vm.f_given} onChange={(e) => vm.setF_given(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs opacity-70">Family name</div>
                    <Input value={vm.f_family} onChange={(e) => vm.setF_family(e.target.value)} />
                  </div>

                  <div className="space-y-1 md:col-span-2">
                    <div className="text-xs opacity-70">Company name</div>
                    <Input value={vm.f_company} onChange={(e) => vm.setF_company(e.target.value)} />
                  </div>

                  <div className="space-y-1 md:col-span-2">
                    <div className="text-xs opacity-70">Email</div>
                    <Input value={vm.f_email} onChange={(e) => vm.setF_email(e.target.value)} />
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs opacity-70">Telephone number</div>
                    <Input value={vm.f_tel} onChange={(e) => vm.setF_tel(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs opacity-70">Mobile CC</div>
                    <Input value={vm.f_mobile_cc} onChange={(e) => vm.setF_mobile_cc(e.target.value)} />
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <div className="text-xs opacity-70">Mobile number</div>
                    <Input value={vm.f_mobile_no} onChange={(e) => vm.setF_mobile_no(e.target.value)} />
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs opacity-70">Job title</div>
                    <Input value={vm.f_job} onChange={(e) => vm.setF_job(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs opacity-70">Department</div>
                    <Input value={vm.f_dept} onChange={(e) => vm.setF_dept(e.target.value)} />
                  </div>

                  <div className="space-y-1 md:col-span-2">
                    <div className="text-xs opacity-70">Address line 1</div>
                    <Input value={vm.f_addr1} onChange={(e) => vm.setF_addr1(e.target.value)} />
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <div className="text-xs opacity-70">Address line 2</div>
                    <Input value={vm.f_addr2} onChange={(e) => vm.setF_addr2(e.target.value)} />
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <div className="text-xs opacity-70">Address line 3</div>
                    <Input value={vm.f_addr3} onChange={(e) => vm.setF_addr3(e.target.value)} />
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs opacity-70">City/Ward</div>
                    <Input value={vm.f_city} onChange={(e) => vm.setF_city(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs opacity-70">State</div>
                    <Input value={vm.f_state} onChange={(e) => vm.setF_state(e.target.value)} />
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <div className="text-xs opacity-70">Country</div>
                    <Input value={vm.f_country} onChange={(e) => vm.setF_country(e.target.value)} />
                  </div>
                </div>
              </div>

              <div className="rounded-lg border p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-medium">Ops fields</div>
                  <div className="text-xs opacity-60">Fix tele input mistakes here</div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <div className="text-xs opacity-70">Current status</div>
                    <Select value={vm.f_status} onValueChange={vm.setF_status}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        {["NEW", "ASSIGNED", "CALLBACK", "INVALID", "DONE"].map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs opacity-70">Other note</div>
                    <Textarea value={vm.noteText} onChange={(e) => vm.setNoteText(e.target.value)} rows={3} />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <div className="text-sm font-medium">Note 1</div>
                    <Select value={vm.note1} onValueChange={vm.changeNote1}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Note 1" />
                      </SelectTrigger>
                      <SelectContent>
                        {vm.note1Options.map((g) => (
                          <SelectItem key={g} value={g}>
                            {g}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="text-xs opacity-60">Chọn Note 1 để load Note 2.</div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm font-medium">Note 2</div>
                    <Select value={vm.note2} onValueChange={vm.setNote2} disabled={!vm.note1 || vm.note2Options.length === 0}>
                      <SelectTrigger>
                        <SelectValue placeholder={!vm.note1 ? "Choose Note 1 first" : "Select Note 2"} />
                      </SelectTrigger>
                      <SelectContent>
                        {vm.note2Options.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.detail_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border p-3">
                <div className="font-medium mb-2">Call logs</div>
                {vm.callHistory.length === 0 ? (
                  <div className="text-sm opacity-60">No logs.</div>
                ) : (
                  <div className="space-y-2 max-h-[220px] overflow-auto pr-2">
                    {vm.callHistory.map((x, i) => (
                      <div key={i} className="text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="opacity-60">{new Date(x.called_at).toLocaleString()}</span>
                          <span className="opacity-60">
                            {x.created_by_name ?? (x.created_by ? x.created_by.slice(0, 8) : "—")}
                          </span>
                        </div>
                        <div className="font-medium break-words">
                          {(x.result_group ?? "—") + " / " + (x.result_detail ?? "—")}
                        </div>
                        {x.note_text ? (
                          <div className="opacity-80 break-words whitespace-pre-wrap">{x.note_text}</div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-lg border p-3">
                <div className="font-medium mb-2">Tele/Admin edit history</div>
                {vm.editHistory.length === 0 ? (
                  <div className="text-sm opacity-60">No edits.</div>
                ) : (
                  <div className="space-y-2 max-h-[260px] overflow-auto pr-2">
                    {vm.editHistory.map((x, i) => (
                      <div key={i} className="text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{x.field_name}</span>
                          <span className="opacity-60">
                            {x.edited_by_name ?? (x.edited_by ? x.edited_by.slice(0, 8) : "—")} •{" "}
                            {new Date(x.edited_at).toLocaleString()}
                          </span>
                        </div>
                        <div className="opacity-70 break-words whitespace-pre-wrap">
                          <span className="opacity-60">{x.old_value ?? "—"}</span> →{" "}
                          <span className="font-medium">{x.new_value}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="border-t bg-background px-6 py-3 flex justify-end gap-2">
          <Button variant="outline" onClick={vm.closeEditor} disabled={vm.editBusy}>
            Cancel
          </Button>
          <Button onClick={save} disabled={vm.editBusy || !vm.editTarget}>
            {vm.editBusy ? "Saving..." : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}