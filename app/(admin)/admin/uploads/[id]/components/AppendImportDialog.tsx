"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { CampaignAppendImportVM } from "../hooks/useCampaignAppendImport";

export default function AppendImportDialog(props: {
  vm: CampaignAppendImportVM;
  onCompleted?: () => Promise<void> | void;
}) {
  const { vm, onCompleted } = props;

  const handleChooseFile = async (file: File | null) => {
    if (!file) return;
    try {
      await vm.prepareFile(file);
    } catch (e: any) {
      console.error(e);
      alert(e?.message ?? "Parse file failed");
      vm.setFile(null);
    }
  };

  const handleAppend = async () => {
    try {
      const result = await vm.appendNow();
      alert(
        [
          "Append import completed.",
          `Inserted: ${result.inserted_rows}`,
          `Duplicate: ${result.duplicate_rows}`,
          `Failed: ${result.failed_rows}`,
          `Skipped: ${result.skipped_rows}`,
        ].join("\n")
      );
      await onCompleted?.();
    } catch (e: any) {
      console.error(e);
      alert(e?.message ?? "Append import failed");
    }
  };

  return (
    <Dialog
      open={vm.open}
      onOpenChange={(b) => {
        vm.setOpen(b);
        if (!b) vm.reset();
      }}
    >
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Import More Data Into This Campaign</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto pr-2">
          <div className="space-y-2">
            <div className="text-sm opacity-70">Choose CSV/XLSX file</div>
            <Input
              type="file"
              accept=".csv,.xlsx,.xls"
              disabled={vm.busy}
              onChange={(e) => void handleChooseFile(e.target.files?.[0] ?? null)}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <div className="text-sm opacity-70">Duplicate policy</div>
              <Select
                value={vm.duplicatePolicy}
                onValueChange={(v) => vm.setDuplicatePolicy(v as any)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Duplicate policy" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SKIP">Skip duplicates</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="text-sm opacity-70">Preview</div>
              <div className="rounded-md border px-3 py-2 text-sm">
                {vm.previewCount === null
                  ? "No file parsed yet"
                  : `${vm.previewName} • ${vm.previewCount} row(s) ready`}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-sm opacity-70">Import notes (optional)</div>
            <Textarea
              value={vm.notes}
              onChange={(e) => vm.setNotes(e.target.value)}
              rows={3}
              disabled={vm.busy}
            />
          </div>

          <div className="rounded-lg border p-3">
            <div className="text-sm font-medium">Import log</div>
            <pre className="mt-2 text-xs whitespace-pre-wrap break-words opacity-80">
              {vm.log || "No activity yet."}
            </pre>
          </div>

          {vm.result ? (
            <div className="rounded-lg border p-3 bg-emerald-500/5 border-emerald-500/30">
              <div className="text-sm font-medium">Latest result</div>
              <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
                <div>Inserted: <b>{vm.result.inserted_rows}</b></div>
                <div>Duplicate: <b>{vm.result.duplicate_rows}</b></div>
                <div>Failed: <b>{vm.result.failed_rows}</b></div>
                <div>Skipped: <b>{vm.result.skipped_rows}</b></div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="pt-2 flex justify-end gap-2">
          <Button
            variant="outline"
            disabled={vm.busy}
            onClick={() => {
              vm.setOpen(false);
              vm.reset();
            }}
          >
            Cancel
          </Button>
          <Button
            disabled={vm.busy || !vm.file || !vm.mappedRows.length}
            onClick={() => void handleAppend()}
          >
            {vm.busy ? "Importing..." : "Append Import"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}