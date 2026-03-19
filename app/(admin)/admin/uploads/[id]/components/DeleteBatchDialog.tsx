"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { CampaignPurgeVM } from "../hooks/useCampaignPurge";

export default function DeleteBatchDialog(props: {
  vm: CampaignPurgeVM;
  onCompleted?: () => Promise<void> | void;
}) {
  const { vm, onCompleted } = props;
  const batch = vm.targetBatch;

  const handleDelete = async () => {
    try {
      const result = await vm.deleteBatchNow();
      alert(
        [
          "Import batch deleted / rolled back.",
          `Deleted contacts: ${result.deleted_contacts}`,
          `Deleted call logs: ${result.deleted_call_logs}`,
          `Deleted contact edits: ${result.deleted_contact_edits}`,
          `Deleted import issues: ${result.deleted_import_issues}`,
        ].join("\n")
      );
      await onCompleted?.();
    } catch (e: any) {
      console.error(e);
      alert(e?.message ?? "Delete batch failed");
    }
  };

  return (
    <Dialog open={vm.deleteBatchOpen} onOpenChange={vm.setDeleteBatchOpen}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Delete Import Batch</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto pr-2">
          {!batch ? (
            <div className="text-sm opacity-70">No batch selected.</div>
          ) : (
            <>
              <div className="rounded-lg border p-3 text-sm space-y-1">
                <div><b>Filename:</b> {batch.filename ?? "—"}</div>
                <div><b>Status:</b> {batch.status}</div>
                <div><b>Total rows:</b> {batch.total_rows}</div>
                <div><b>Inserted:</b> {batch.inserted_rows}</div>
                <div><b>Duplicate:</b> {batch.duplicate_rows}</div>
                <div><b>Failed:</b> {batch.failed_rows}</div>
              </div>

              <label className="flex items-center gap-2 rounded-md border p-3">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={vm.forceDeleteBatch}
                  onChange={(e) => vm.setForceDeleteBatch(e.target.checked)}
                  disabled={vm.busy}
                />
                <div className="text-sm">
                  Force delete batch even if contacts already have call logs / edit history
                </div>
              </label>

              {vm.lastDeleteBatchResult ? (
                <div className="rounded-lg border p-3 bg-emerald-500/5 border-emerald-500/30 text-sm">
                  Last result: deleted {vm.lastDeleteBatchResult.deleted_contacts} contact(s)
                </div>
              ) : null}
            </>
          )}
        </div>

        <div className="pt-2 flex justify-end gap-2">
          <Button variant="outline" disabled={vm.busy} onClick={() => vm.setDeleteBatchOpen(false)}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={vm.busy || !batch} onClick={() => void handleDelete()}>
            {vm.busy ? "Deleting..." : "Delete Batch"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}