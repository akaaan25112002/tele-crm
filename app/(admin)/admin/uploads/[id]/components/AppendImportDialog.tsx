"use client";

import { useMemo } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import type { CampaignAppendImportVM } from "../hooks/useCampaignAppendImport";

function Stat(props: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-[11px] opacity-60">{props.label}</div>
      <div className="mt-1 text-sm font-semibold tabular-nums">{props.value}</div>
    </div>
  );
}

function InfoBanner(props: {
  tone?: "default" | "warn" | "danger";
  title: string;
  description: string;
}) {
  const cls =
    props.tone === "danger"
      ? "border-destructive/40 bg-destructive/5 text-destructive"
      : props.tone === "warn"
      ? "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300"
      : "border-border bg-muted/30";

  return (
    <div className={`rounded-lg border p-3 text-sm ${cls}`}>
      <div className="font-medium">{props.title}</div>
      <div className="mt-1 opacity-90">{props.description}</div>
    </div>
  );
}

export default function AppendImportDialog(props: {
  vm: CampaignAppendImportVM;
  onCompleted?: () => Promise<void> | void;
}) {
  const { vm, onCompleted } = props;

  const canImport = !!vm.file && vm.mappedRows.length > 0 && !vm.busy;

  const previewTone = useMemo<"default" | "warn" | "danger">(() => {
    if (!vm.file) return "default";
    if (vm.previewCount !== null && vm.previewCount === 0) return "danger";
    if (vm.previewCount !== null && vm.previewCount > 5000) return "warn";
    return "default";
  }, [vm.file, vm.previewCount]);

  const handleClose = () => {
    vm.setOpen(false);
    vm.reset();
  };

  const handleChooseFile = async (file: File | null) => {
    if (!file) return;

    try {
      await vm.prepareFile(file);

      toast.success("File parsed successfully", {
        description: `${file.name} is ready for preview/import`,
      });
    } catch (e: any) {
      console.error(e);

      toast.error("Parse file failed", {
        description: e?.message ?? "Unable to parse selected file",
      });

      vm.setFile(null);
    }
  };

  const handleAppend = async () => {
    try {
      const result = await vm.appendNow();

      toast.success("Append import completed", {
        description: `Inserted ${result.inserted_rows} • Duplicate ${result.duplicate_rows}`,
      });

      await onCompleted?.();

      vm.setOpen(false);
      vm.reset();
    } catch (e: any) {
      console.error(e);

      toast.error("Append import failed", {
        description: e?.message ?? "Unable to append data into campaign",
      });
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
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Import More Data Into This Campaign</DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto pr-2 space-y-4">
          <InfoBanner
            tone="default"
            title="Append import"
            description="This will add more contacts into the current campaign without creating a new campaign."
          />

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
                disabled={vm.busy}
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

          <InfoBanner
            tone={previewTone}
            title={
              !vm.file
                ? "No file selected"
                : vm.previewCount === 0
                ? "No valid rows found"
                : vm.previewCount && vm.previewCount > 5000
                ? "Large import file"
                : "Preview ready"
            }
            description={
              !vm.file
                ? "Select a file first to parse and preview rows."
                : vm.previewCount === 0
                ? "The parsed file did not produce any valid rows for append import."
                : vm.previewCount && vm.previewCount > 5000
                ? "This file is large. Import may take longer and should be monitored carefully."
                : "The file has been parsed and is ready to import into the current campaign."
            }
          />

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Preview rows" value={vm.previewCount ?? 0} />
            <Stat label="Mapped rows" value={vm.mappedRows.length} />
            <Stat label="Policy" value={vm.duplicatePolicy} />
            <Stat label="Ready" value={canImport ? "YES" : "NO"} />
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">Campaign append mode</Badge>
            {vm.previewName ? <Badge variant="outline">{vm.previewName}</Badge> : null}
            {vm.previewCount !== null ? (
              <Badge variant="outline">{vm.previewCount} row(s)</Badge>
            ) : null}
          </div>

          <div className="space-y-2">
            <div className="text-sm opacity-70">Import notes (optional)</div>
            <Textarea
              value={vm.notes}
              onChange={(e) => vm.setNotes(e.target.value)}
              rows={3}
              disabled={vm.busy}
              placeholder="Optional internal note for this append import"
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
                <div>
                  Inserted: <b>{vm.result.inserted_rows}</b>
                </div>
                <div>
                  Duplicate: <b>{vm.result.duplicate_rows}</b>
                </div>
                <div>
                  Failed: <b>{vm.result.failed_rows}</b>
                </div>
                <div>
                  Skipped: <b>{vm.result.skipped_rows}</b>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="pt-3 mt-2 border-t flex justify-end gap-2">
          <Button variant="outline" disabled={vm.busy} onClick={handleClose}>
            Cancel
          </Button>
          <Button disabled={!canImport} onClick={() => void handleAppend()}>
            {vm.busy ? "Importing..." : "Append Import"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}