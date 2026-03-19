"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ChevronDown,
  DatabaseZap,
  FilePlus2,
  PhoneCall,
  RefreshCw,
  TriangleAlert,
  Users,
} from "lucide-react";

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

  const statusUpper = String(campaignStatus ?? "").toUpperCase();
  const disabledByStatus = statusUpper === "DONE";
  const pauseLikeStatus = statusUpper === "PAUSE";
  const mutationDisabled = disabledByStatus;

  const statusHint = useMemo(() => {
    if (statusUpper === "DONE") {
      return "This campaign is marked DONE. Import, purge, and cleanup actions are disabled.";
    }
    if (statusUpper === "PAUSE") {
      return "This campaign is paused. Navigation is still available, but review data-changing actions carefully.";
    }
    return "Use primary actions for day-to-day work. Advanced and destructive actions are grouped in menus.";
  }, [statusUpper]);

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
        const text = `Cleanup completed. ${count} expired lease(s) were released in this campaign.`;
        setMessage(text);
        toast.success("Cleanup completed", {
          description: `${count} expired lease(s) released`,
        });
      } else {
        const text = "Cleanup completed. No expired leases were found in this campaign.";
        setMessage(text);
        toast("Cleanup completed", {
          description: "No expired leases were found",
        });
      }

      await onAfterCleanup?.();
      await onAfterMutation?.();
    } catch (e: any) {
      console.error(e);
      const msg = e?.message ?? "Failed to cleanup expired leases for this campaign";
      setErrorText(msg);
      toast.error("Cleanup failed", {
        description: msg,
      });
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
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <div className="text-sm font-medium">Campaign Actions</div>
              <div className="mt-1 text-xs opacity-70">{statusHint}</div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
              {/* Primary actions */}
              <div className="flex flex-wrap gap-2">
                <Link href={`/admin/contacts?upload_id=${uploadId}`}>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Users className="h-4 w-4" />
                    Contacts
                  </Button>
                </Link>

                <Link href={`/admin/call-logs?upload_id=${uploadId}`}>
                  <Button variant="outline" size="sm" className="gap-2">
                    <PhoneCall className="h-4 w-4" />
                    Call Logs
                  </Button>
                </Link>

                <Button
                  size="sm"
                  className="gap-2"
                  onClick={() => {
                    appendVm.reset();
                    appendVm.setOpen(true);
                  }}
                  disabled={mutationDisabled}
                >
                  <FilePlus2 className="h-4 w-4" />
                  Import More
                </Button>
              </div>

              {/* Secondary actions */}
              <div className="flex flex-wrap gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <RefreshCw className="h-4 w-4" />
                      Operations
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64">
                    <DropdownMenuItem asChild>
                      <Link href={`/admin/contacts?upload_id=${uploadId}&status=CALLBACK&overdue_callback=1`}>
                        Open overdue callbacks
                      </Link>
                    </DropdownMenuItem>

                    <DropdownMenuItem asChild>
                      <Link href={`/admin/contacts?upload_id=${uploadId}&status=ASSIGNED&stale_assigned=1`}>
                        Open stale assigned
                      </Link>
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />

                    <DropdownMenuItem
                      disabled={cleaning || mutationDisabled}
                      onClick={() => void handleCleanup()}
                    >
                      {cleaning ? "Cleaning expired leases..." : "Cleanup expired leases"}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 border-destructive/40 text-destructive hover:text-destructive"
                      disabled={mutationDisabled}
                    >
                      <TriangleAlert className="h-4 w-4" />
                      Danger Zone
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64">
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      disabled={mutationDisabled}
                      onClick={() => void purgeVm.openPurge()}
                    >
                      Purge campaign data
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>

          {/* Quick state indicators */}
          <div className="mt-4 flex flex-wrap gap-2">
            <div className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs opacity-80">
              <DatabaseZap className="mr-1.5 h-3.5 w-3.5" />
              Status: {statusUpper || "RUNNING"}
            </div>

            {disabledByStatus ? (
              <div className="inline-flex items-center rounded-full border border-destructive/40 px-2.5 py-1 text-xs text-destructive">
                Data-changing actions disabled
              </div>
            ) : null}

            {pauseLikeStatus ? (
              <div className="inline-flex items-center rounded-full border border-amber-500/30 px-2.5 py-1 text-xs text-amber-700 dark:text-amber-300">
                Campaign paused
              </div>
            ) : null}
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