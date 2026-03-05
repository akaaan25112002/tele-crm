"use client";

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/status-badge";
import { StatusButton } from "@/components/status-button";
import { CAMPAIGN_STATUSES } from "../lib/types";
import { fmtDT } from "../lib/utils";
import type { UploadDetailVM } from "../hooks/useUploadDetail";

export default function CampaignHeader({ vm }: { vm: UploadDetailVM }) {
  const u = vm.upload!;
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg">{u.campaign_name}</CardTitle>
            <div className="text-sm opacity-70">
              {u.filename ?? "—"} • Created {fmtDT(u.created_at)}
            </div>
            {u.description ? (
              <div className="text-sm opacity-80 whitespace-pre-wrap">{u.description}</div>
            ) : (
              <div className="text-sm opacity-60">No description.</div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={u.status} kind="campaign" />
            <Button variant="outline" onClick={vm.refreshAll} disabled={vm.loading || vm.exportingReport || vm.exportingLogs}>
              {vm.loading ? "Refreshing..." : "Refresh"}
            </Button>
            <Button variant="outline" onClick={() => vm.setDescOpen(true)} disabled={vm.loading}>
              Edit description
            </Button>
            <Button variant="outline" onClick={() => vm.setRenameOpen(true)} disabled={vm.loading}>
              Rename
            </Button>
            <Button variant="destructive" onClick={() => vm.setDeleteOpen(true)} disabled={vm.loading}>
              Delete
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="text-sm font-medium">Campaign Status</div>
          <div className="flex flex-wrap gap-2">
            {CAMPAIGN_STATUSES.map((s) => (
              <StatusButton
                key={s}
                kind="campaign"
                status={s}
                active={u.status === s}
                disabled={vm.loading}
                onClick={() => vm.setCampaignStatus(s)}
              />
            ))}
          </div>
        </div>
      </CardContent>

      {/* Description dialog */}
      <Dialog open={vm.descOpen} onOpenChange={vm.setDescOpen}>
        <DialogContent className="max-h-[85vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Edit Campaign Description</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 overflow-y-auto pr-2">
            <div className="text-sm opacity-70">Description</div>
            <Textarea value={vm.descValue} onChange={(e) => vm.setDescValue(e.target.value)} rows={5} />
          </div>
          <div className="pt-2 flex justify-end gap-2">
            <Button variant="outline" onClick={() => vm.setDescOpen(false)} disabled={vm.loading}>
              Cancel
            </Button>
            <Button onClick={vm.saveDescription} disabled={vm.loading}>
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rename dialog */}
      <Dialog open={vm.renameOpen} onOpenChange={vm.setRenameOpen}>
        <DialogContent className="max-h-[85vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Rename Campaign</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 overflow-y-auto pr-2">
            <div className="text-sm opacity-70">New campaign name</div>
            <Input value={vm.renameValue} onChange={(e) => vm.setRenameValue(e.target.value)} />
          </div>
          <div className="pt-2 flex justify-end gap-2">
            <Button variant="outline" onClick={() => vm.setRenameOpen(false)} disabled={vm.loading}>
              Cancel
            </Button>
            <Button onClick={vm.renameCampaign} disabled={vm.loading}>
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={vm.deleteOpen} onOpenChange={vm.setDeleteOpen}>
        <DialogContent className="max-h-[85vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Delete Campaign</DialogTitle>
          </DialogHeader>
          <div className="text-sm opacity-70 overflow-y-auto pr-2">
            This will delete the campaign and related contacts/memberships. Cannot be undone.
          </div>
          <div className="pt-2 flex justify-end gap-2">
            <Button variant="outline" onClick={() => vm.setDeleteOpen(false)} disabled={vm.deleteBusy}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={vm.deleteCampaign} disabled={vm.deleteBusy}>
              {vm.deleteBusy ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}