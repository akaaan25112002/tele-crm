"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import AppendImportDialog from "./AppendImportDialog";
import PurgeCampaignDialog from "./PurgeCampaignDialog";
import DeleteBatchDialog from "./DeleteBatchDialog";

import { useCampaignAppendImport } from "../hooks/useCampaignAppendImport";
import { useCampaignPurge } from "../hooks/useCampaignPurge";

export function CampaignActionBar(props: {
  uploadId: string;
  campaignStatus?: string | null;
  onAfterCleanup?: () => Promise<void> | void;
  onAfterMutation?: () => Promise<void> | void;
}) {
  const { uploadId, campaignStatus, onAfterCleanup, onAfterMutation } = props;

  const appendVm = useCampaignAppendImport(uploadId);
  const purgeVm = useCampaignPurge(uploadId);

  const [cleaning, setCleaning] = useState(false);
  const [message, setMessage] = useState("");
  const [errorText, setErrorText] = useState("");

  const disabledByStatus = String(campaignStatus ?? "").toUpperCase() === "DONE";

  const handleCleanup = async () => {
    if (!uploadId) return;

    setMessage("");
    setErrorText("");
    setCleaning(true);

    try {
      const { data, error } = await supabase.rpc("rpc_cleanup_expired_leases", {
        p_upload_id: uploadId,
        p_limit: 5000,
      });

      if (error) throw error;

      const count = Number(data ?? 0);

      if (count > 0) {
        setMessage(`Cleanup completed. ${count} expired lease(s) were released in this campaign.`);
      } else {
        setMessage("Cleanup completed. No expired leases were found in this campaign.");
      }

      await onAfterCleanup?.();
    } catch (e: any) {
      console.error(e);
      setErrorText(e?.message ?? "Failed to cleanup expired leases for this campaign");
    } finally {
      setCleaning(false);
    }
  };

  useEffect(() => {
    if (!message) return;
    const t = window.setTimeout(() => setMessage(""), 5000);
    return () => window.clearTimeout(t);
  }, [message]);

  useEffect(() => {
    if (!errorText) return;
    const t = window.setTimeout(() => setErrorText(""), 7000);
    return () => window.clearTimeout(t);
  }, [errorText]);

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="text-sm font-medium">Campaign Actions</div>
              <div className="text-xs opacity-70">
                Fast operational shortcuts for this campaign.
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link href={`/admin/contacts?upload_id=${uploadId}`}>
                <Button variant="outline" size="sm">
                  Open Contacts
                </Button>
              </Link>

              <Link href={`/admin/call-logs?upload_id=${uploadId}`}>
                <Button variant="outline" size="sm">
                  Open Call Logs
                </Button>
              </Link>

              <Link href={`/admin/contacts?upload_id=${uploadId}&status=CALLBACK&overdue_callback=1`}>
                <Button variant="outline" size="sm">
                  Overdue Callbacks
                </Button>
              </Link>

              <Link href={`/admin/contacts?upload_id=${uploadId}&status=ASSIGNED&stale_assigned=1`}>
                <Button variant="outline" size="sm">
                  Stale Assigned
                </Button>
              </Link>

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  appendVm.reset();
                  appendVm.setOpen(true);
                }}
                disabled={disabledByStatus}
              >
                Import More
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => void purgeVm.openPurge()}
                disabled={disabledByStatus}
              >
                Purge Data
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleCleanup}
                disabled={cleaning || disabledByStatus}
              >
                {cleaning ? "Cleaning..." : "Cleanup Expired Leases"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {message ? (
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="py-3 text-sm text-emerald-700 dark:text-emerald-300">
            {message}
          </CardContent>
        </Card>
      ) : null}

      {errorText ? (
        <Card className="border-destructive/40">
          <CardContent className="py-3 text-sm text-destructive">
            {errorText}
          </CardContent>
        </Card>
      ) : null}

      <AppendImportDialog
        vm={appendVm}
        onCompleted={async () => {
          await onAfterMutation?.();
        }}
      />

      <PurgeCampaignDialog
        vm={purgeVm}
        onCompleted={async () => {
          await onAfterMutation?.();
        }}
      />

      <DeleteBatchDialog
        vm={purgeVm}
        onCompleted={async () => {
          purgeVm.setDeleteBatchOpen(false);
          await onAfterMutation?.();
        }}
      />
    </div>
  );
}