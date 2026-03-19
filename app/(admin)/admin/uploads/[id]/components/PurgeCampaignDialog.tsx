"use client";

import { useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { CampaignPurgeVM } from "../hooks/useCampaignPurge";

function Stat(props: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-[11px] opacity-60">{props.label}</div>
      <div className="mt-1 text-sm font-semibold tabular-nums">{props.value}</div>
    </div>
  );
}

function RiskBanner(props: {
  tone: "default" | "warn" | "danger";
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

export default function PurgeCampaignDialog(props: {
  vm: CampaignPurgeVM;
  onCompleted?: () => Promise<void> | void;
}) {
  const { vm, onCompleted } = props;

  const confirmOk = vm.confirmText.trim().toUpperCase() === "DELETE";

  const dangerState = useMemo(() => {
    const p = vm.preview;

    if (vm.purgeMode === "FORCE_WITH_HISTORY") {
      return {
        tone: "danger" as const,
        title: "Highest risk purge",
        description:
          "This mode can delete all campaign contacts together with related call logs, edit history, and import issues.",
      };
    }

    if (vm.purgeMode === "ALL_CONTACTS") {
      const touched = Number(p?.touched_contacts ?? 0);
      const withLogs = Number(p?.contacts_with_logs ?? 0);

      if (touched > 0 || withLogs > 0) {
        return {
          tone: "warn" as const,
          title: "Blocked unless data is untouched",
          description:
            "This mode is intended to delete all contacts, but it should block when contacts already have call history or edit history.",
        };
      }

      return {
        tone: "warn" as const,
        title: "Full campaign contact purge",
        description:
          "This mode removes all campaign contacts when they do not have protected history.",
      };
    }

    return {
      tone: "default" as const,
      title: "Safer purge mode",
      description:
        "This mode only removes untouched contacts and is the recommended option for normal cleanup.",
    };
  }, [vm.preview, vm.purgeMode]);

  const handleClose = () => {
    vm.setPurgeOpen(false);
    vm.setConfirmText("");
  };

  const handlePurge = async () => {
    try {
      const result = await vm.purgeNow();

      toast.success("Campaign purge completed", {
        description: `Deleted ${result.deleted_contacts} contact(s)`,
      });

      await onCompleted?.();

      vm.setConfirmText("");
      vm.setPurgeOpen(false);
    } catch (e: any) {
      console.error(e);

      toast.error("Purge failed", {
        description: e?.message ?? "Failed to purge campaign data",
      });
    }
  };

  return (
    <Dialog
      open={vm.purgeOpen}
      onOpenChange={(b) => {
        vm.setPurgeOpen(b);
        if (!b) {
          vm.setConfirmText("");
        }
      }}
    >
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Purge Campaign Data</DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto pr-2 space-y-4">
          {vm.previewError ? (
            <div className="rounded-md border border-destructive/40 p-3 text-sm text-destructive">
              {vm.previewError}
            </div>
          ) : null}

          <RiskBanner
            tone={dangerState.tone}
            title={dangerState.title}
            description={dangerState.description}
          />

          {vm.preview ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Stat label="Total contacts" value={vm.preview.total_contacts} />
                <Stat label="Untouched" value={vm.preview.untouched_contacts} />
                <Stat label="Touched" value={vm.preview.touched_contacts} />
                <Stat label="Active leases" value={vm.preview.active_leases} />
                <Stat label="With logs" value={vm.preview.contacts_with_logs} />
                <Stat label="With edits" value={vm.preview.contacts_with_edits} />
                <Stat label="Safe untouched deletable" value={vm.preview.safe_untouched_deletable} />
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">
                  Contacts with logs: {vm.preview.contacts_with_logs}
                </Badge>
                <Badge variant="outline">
                  Contacts with edits: {vm.preview.contacts_with_edits}
                </Badge>
                <Badge variant="outline">
                  Active leases: {vm.preview.active_leases}
                </Badge>
              </div>
            </>
          ) : (
            <div className="text-sm opacity-70">Loading purge preview...</div>
          )}

          <div className="space-y-2">
            <div className="text-sm opacity-70">Purge mode</div>
            <Select value={vm.purgeMode} onValueChange={(v) => vm.setPurgeMode(v as any)}>
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
              placeholder="Type DELETE"
            />
            {!confirmOk && vm.confirmText.length > 0 ? (
              <div className="text-xs text-amber-600">
                Confirmation text must exactly match DELETE.
              </div>
            ) : null}
          </div>

          {vm.lastPurgeResult ? (
            <div className="rounded-lg border p-3 bg-emerald-500/5 border-emerald-500/30 text-sm">
              <div className="font-medium">Last result</div>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <div>
                  Deleted contacts: <b>{vm.lastPurgeResult.deleted_contacts}</b>
                </div>
                <div>
                  Deleted call logs: <b>{vm.lastPurgeResult.deleted_call_logs}</b>
                </div>
                <div>
                  Deleted contact edits: <b>{vm.lastPurgeResult.deleted_contact_edits}</b>
                </div>
                <div>
                  Deleted import issues: <b>{vm.lastPurgeResult.deleted_import_issues}</b>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="pt-3 mt-2 border-t flex justify-end gap-2">
          <Button variant="outline" disabled={vm.busy} onClick={handleClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={vm.busy || !confirmOk || !!vm.previewError}
            onClick={() => void handlePurge()}
          >
            {vm.busy ? "Purging..." : "Purge Data"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}