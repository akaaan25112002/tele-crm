"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import type { CampaignPurgeVM } from "../hooks/useCampaignPurge";

function Stat(props: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-[11px] opacity-60">{props.label}</div>
      <div className="mt-1 text-sm font-semibold tabular-nums">{props.value}</div>
    </div>
  );
}

export default function PurgeCampaignDialog(props: {
  vm: CampaignPurgeVM;
  onCompleted?: () => Promise<void> | void;
}) {
  const { vm, onCompleted } = props;

  const handlePurge = async () => {
    try {
      const result = await vm.purgeNow();
      alert(
        [
          "Campaign purge completed.",
          `Deleted contacts: ${result.deleted_contacts}`,
          `Deleted call logs: ${result.deleted_call_logs}`,
          `Deleted contact edits: ${result.deleted_contact_edits}`,
          `Deleted import issues: ${result.deleted_import_issues}`,
        ].join("\n")
      );
      await onCompleted?.();
    } catch (e: any) {
      console.error(e);
      alert(e?.message ?? "Purge failed");
    }
  };

  return (
    <Dialog open={vm.purgeOpen} onOpenChange={vm.setPurgeOpen}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Purge Campaign Data</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto pr-2">
          {vm.previewError ? (
            <div className="rounded-md border border-destructive/40 p-3 text-sm text-destructive">
              {vm.previewError}
            </div>
          ) : null}

          {vm.preview ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Stat label="Total contacts" value={vm.preview.total_contacts} />
              <Stat label="Untouched" value={vm.preview.untouched_contacts} />
              <Stat label="Touched" value={vm.preview.touched_contacts} />
              <Stat label="Active leases" value={vm.preview.active_leases} />
              <Stat label="With logs" value={vm.preview.contacts_with_logs} />
              <Stat label="With edits" value={vm.preview.contacts_with_edits} />
              <Stat label="Safe untouched deletable" value={vm.preview.safe_untouched_deletable} />
            </div>
          ) : (
            <div className="text-sm opacity-70">Loading purge preview...</div>
          )}

          <div className="space-y-2">
            <div className="text-sm opacity-70">Purge mode</div>
            <Select
              value={vm.purgeMode}
              onValueChange={(v) => vm.setPurgeMode(v as any)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Purge mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="UNTOUCHED_ONLY">Delete untouched contacts only</SelectItem>
                <SelectItem value="ALL_CONTACTS">Delete all contacts (block touched/history)</SelectItem>
                <SelectItem value="FORCE_WITH_HISTORY">Force delete all contacts with history</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
            <div className="font-medium">Danger zone</div>
            <div className="mt-1 opacity-80">
              This operation can remove contacts, call logs, edit history, and import issues depending on the selected mode.
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-sm opacity-70">
              Type <b>DELETE</b> to confirm
            </div>
            <Input
              value={vm.confirmText}
              onChange={(e) => vm.setConfirmText(e.target.value)}
              disabled={vm.busy}
            />
          </div>

          {vm.lastPurgeResult ? (
            <div className="rounded-lg border p-3 bg-emerald-500/5 border-emerald-500/30 text-sm">
              Last result: deleted {vm.lastPurgeResult.deleted_contacts} contact(s)
            </div>
          ) : null}
        </div>

        <div className="pt-2 flex justify-end gap-2">
          <Button variant="outline" disabled={vm.busy} onClick={() => vm.setPurgeOpen(false)}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={vm.busy} onClick={() => void handlePurge()}>
            {vm.busy ? "Purging..." : "Purge Data"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}