"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";

type CampaignStatus = "RUNNING" | "PAUSE" | "COMPLETED" | "DONE" | string;

type ProgressTele = {
  upload_id: string;
  status: string;

  total_contacts: number;
  done_contacts: number;
  remaining_contacts: number;
  done_percent: number;

  available_now: number;
  my_holding: number;
  other_holding: number;
  capacity_left: number;

  callback_contacts: number;
  earliest_my_expiry: string | null;
};

type CampaignInfo = {
  id: string;
  campaign_name: string | null;
  description: string | null;
  filename: string | null;
};

type MsgKind = "success" | "error" | "info";

const AUTO_REFRESH_MS = 60_000;
const LEASE_MINUTES = 270; // 4h30
const PULL_MAX = 100;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function fmtDT(s?: string | null) {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

export default function CampaignPullPage() {
  const router = useRouter();
  const params = useParams();

  const id = useMemo(() => {
    const raw = (params as any)?.id;
    return Array.isArray(raw) ? raw[0] : String(raw ?? "");
  }, [params]);

  const [loading, setLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [pLoading, setPLoading] = useState(false);
  const [reconciling, setReconciling] = useState(false);

  const [msg, setMsg] = useState<string | null>(null);
  const [msgKind, setMsgKind] = useState<MsgKind>("info");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

  const [status, setStatus] = useState<CampaignStatus | null>(null);
  const [campaign, setCampaign] = useState<CampaignInfo | null>(null);
  const [p, setP] = useState<ProgressTele | null>(null);

  const reconcileRunningRef = useRef(false);

  const setBanner = useCallback((text: string | null, kind: MsgKind = "info") => {
    setMsg(text);
    setMsgKind(kind);
  }, []);

  const loadCampaign = useCallback(async () => {
    if (!id) return;

    setStatusLoading(true);
    try {
      const { data, error } = await supabase
        .from("uploads")
        .select("id,status,campaign_name,description,filename")
        .eq("id", id)
        .single();

      if (error) throw error;

      setStatus(String((data as any)?.status ?? ""));
      setCampaign({
        id: String((data as any).id),
        campaign_name: (data as any).campaign_name ?? null,
        description: (data as any).description ?? null,
        filename: (data as any).filename ?? null,
      });
    } catch (e: any) {
      console.error(e);
      setBanner(e?.message ?? "Load campaign failed", "error");
      setStatus(null);
      setCampaign(null);
    } finally {
      setStatusLoading(false);
    }
  }, [id, setBanner]);

  const loadProgress = useCallback(async () => {
    if (!id) return;

    setPLoading(true);
    try {
      const { data, error } = await supabase.rpc("rpc_campaign_progress_tele", {
        p_upload_id: id,
      });
      if (error) throw error;

      const row = Array.isArray(data) ? data[0] : data;

      if (!row || typeof row !== "object") {
        setP(null);
        return;
      }

      setP({
        upload_id: String(row.upload_id ?? id),
        status: String(row.status ?? ""),

        total_contacts: Number(row.total_contacts ?? 0),
        done_contacts: Number(row.done_contacts ?? 0),
        remaining_contacts: Number(row.remaining_contacts ?? 0),
        done_percent: Number(row.done_percent ?? 0),

        available_now: Number(row.available_now ?? 0),
        my_holding: Number(row.my_holding ?? 0),
        other_holding: Number(row.other_holding ?? 0),
        capacity_left: Number(row.capacity_left ?? 0),

        callback_contacts: Number(row.callback_contacts ?? 0),
        earliest_my_expiry: row.earliest_my_expiry ? String(row.earliest_my_expiry) : null,
      });
    } catch (e: any) {
      console.error(e);
      setBanner(e?.message ?? "Load progress failed", "error");
      setP(null);
    } finally {
      setPLoading(false);
    }
  }, [id, setBanner]);

  const refreshPage = useCallback(
    async (showMessage = false) => {
      if (!id) return;

      if (showMessage) setBanner(null);

      await Promise.all([loadCampaign(), loadProgress()]);
      setLastUpdatedAt(new Date().toISOString());

      if (showMessage) {
        setBanner("Campaign status and progress refreshed.", "info");
      }
    },
    [id, loadCampaign, loadProgress, setBanner]
  );

  const reconcileExpiredLeases = useCallback(
    async (showMessage = false) => {
      if (!id) return 0;
      if (reconcileRunningRef.current) return 0;

      reconcileRunningRef.current = true;
      setReconciling(true);

      try {
        const { data, error } = await supabase.rpc("rpc_tele_reconcile_campaign_leases", {
          p_upload_id: id,
          p_limit: 1000,
        });

        if (error) throw error;

        const released = Number(data ?? 0);

        if (showMessage) {
          if (released > 0) {
            setBanner(
              `${released} expired lease(s) were automatically released back to this campaign pool.`,
              "success"
            );
          } else {
            setBanner("No expired leases found for this campaign.", "info");
          }
        }

        return released;
      } catch (e: any) {
        console.error(e);
        setBanner(e?.message ?? "Failed to reconcile expired leases", "error");
        return 0;
      } finally {
        reconcileRunningRef.current = false;
        setReconciling(false);
      }
    },
    [id, setBanner]
  );

  useEffect(() => {
    if (!id) return;

    (async () => {
      setBanner(null);
      await reconcileExpiredLeases(false);
      await refreshPage(false);
    })();
  }, [id, reconcileExpiredLeases, refreshPage, setBanner]);

  useEffect(() => {
    if (!msg) return;

    const timeout = window.setTimeout(() => {
      setMsg(null);
    }, msgKind === "error" ? 7000 : 4000);

    return () => window.clearTimeout(timeout);
  }, [msg, msgKind]);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible" && !loading && !reconciling) {
        void (async () => {
          await reconcileExpiredLeases(false);
          await refreshPage(false);
        })();
      }
    };

    const timer = window.setInterval(tick, AUTO_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [loading, reconciling, reconcileExpiredLeases, refreshPage]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && !loading && !reconciling) {
        void (async () => {
          await reconcileExpiredLeases(false);
          await refreshPage(false);
        })();
      }
    };

    const onFocus = () => {
      if (document.visibilityState === "visible" && !loading && !reconciling) {
        void (async () => {
          await reconcileExpiredLeases(false);
          await refreshPage(false);
        })();
      }
    };

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
    };
  }, [loading, reconciling, reconcileExpiredLeases, refreshPage]);

  const disabledByStatus = status === "PAUSE" || status === "DONE";

  const computedPullLimit = useMemo(() => {
    const cap = p ? clamp(Number(p.capacity_left ?? 0), 0, PULL_MAX) : PULL_MAX;
    return cap;
  }, [p]);

  const disabledByProgress = useMemo(() => {
    if (!p) return false;
    return Number(p.capacity_left ?? 0) <= 0 || Number(p.available_now ?? 0) <= 0;
  }, [p]);

  const pullDisabled =
    loading ||
    reconciling ||
    !id ||
    statusLoading ||
    disabledByStatus ||
    disabledByProgress ||
    computedPullLimit <= 0;

  const pullHint = useMemo(() => {
    if (disabledByStatus) return "Campaign disabled";
    if (!p) return null;

    if (Number(p.capacity_left ?? 0) <= 0) return "Queue full (100). Submit calls to free capacity.";
    if (Number(p.available_now ?? 0) <= 0) return "No available contacts now (maybe held by others or all terminal).";
    return null;
  }, [disabledByStatus, p]);

  const pull = async () => {
    if (!id) return;

    setLoading(true);
    setBanner(null);

    try {
      await reconcileExpiredLeases(false);
      await loadProgress();

      const latestCapacity = p ? clamp(Number(p.capacity_left ?? 0), 0, PULL_MAX) : computedPullLimit;
      const latestAvailable = p ? Number(p.available_now ?? 0) : 0;
      const limit = latestCapacity;

      if (limit <= 0) {
        setBanner("You already hold maximum contacts (100). Please submit calls to free capacity.", "error");
        return;
      }

      if (p && latestAvailable <= 0) {
        setBanner("No contacts available to pull right now.", "info");
        return;
      }

      const { data, error } = await supabase.rpc("rpc_pull_contacts", {
        p_upload_id: id,
        p_limit: limit,
        p_lease_minutes: LEASE_MINUTES,
      });

      if (error) throw error;

      let pulled = 0;
      if (Array.isArray(data)) pulled = data.length;
      else if (typeof data === "number") pulled = data;

      await refreshPage(false);

      if (pulled === 0) {
        setBanner("No contacts available to pull right now.", "info");
        return;
      }

      setBanner(`Pulled ${pulled} contacts successfully. Redirecting to workspace...`, "success");

      setTimeout(() => {
        router.push("/tele/workspace");
      }, 500);
    } catch (e: any) {
      console.error(e);
      setBanner(e?.message ?? "Pull failed", "error");
      await refreshPage(false);
    } finally {
      setLoading(false);
    }
  };

  const donePercent = p ? clamp(Number(p.done_percent ?? 0), 0, 100) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span>Pull Contacts</span>
          <div className="flex items-center gap-2 text-xs opacity-70">
            <span>Last updated: {lastUpdatedAt ? fmtDT(lastUpdatedAt) : "—"}</span>
            <span>•</span>
            <span>{reconciling ? "Reconciling leases..." : "Lease sync active"}</span>
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="font-medium">{campaign?.campaign_name ?? "—"}</div>
          {campaign?.filename ? <Badge variant="outline">{campaign.filename}</Badge> : null}
        </div>

        <div className="text-sm opacity-80">Campaign ID: {id || "—"}</div>

        <div className="text-sm opacity-80 flex items-center gap-2">
          <span>Status:</span>
          {statusLoading ? (
            <span>Loading...</span>
          ) : status ? (
            <StatusBadge status={status} kind="campaign" />
          ) : (
            <span>—</span>
          )}
        </div>

        <div className="text-sm opacity-80 whitespace-pre-wrap">
          <span>Description: </span>
          {statusLoading ? "Loading description..." : campaign?.description?.trim() ? campaign.description : "No description."}
        </div>

        <div className="rounded-lg border p-3">
          <div className="flex items-center justify-between">
            <div className="font-medium">Progress</div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void reconcileExpiredLeases(true)}
                disabled={reconciling || loading || !id}
              >
                {reconciling ? "Syncing..." : "Sync Leases"}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => void refreshPage(true)}
                disabled={pLoading || reconciling || loading || !id}
              >
                {pLoading ? "Loading..." : "Refresh"}
              </Button>
            </div>
          </div>

          {!p ? (
            <div className="text-sm opacity-70 mt-2">Progress not available.</div>
          ) : (
            <div className="mt-3 space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant="outline">Total: {p.total_contacts}</Badge>
                <Badge variant="outline">Done: {p.done_contacts}</Badge>
                <Badge variant="outline">Remaining: {p.remaining_contacts}</Badge>
                <span className="text-xs opacity-60">({donePercent}% done)</span>
              </div>

              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div className="h-2 bg-primary" style={{ width: `${donePercent}%` }} />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                <div className="rounded-md border p-2">
                  <div className="text-xs opacity-60">Available now</div>
                  <div className="font-semibold">{p.available_now}</div>
                </div>

                <div className="rounded-md border p-2">
                  <div className="text-xs opacity-60">My holding</div>
                  <div className="font-semibold">{p.my_holding}</div>
                </div>

                <div className="rounded-md border p-2">
                  <div className="text-xs opacity-60">Capacity left</div>
                  <div className="font-semibold">{p.capacity_left}</div>
                </div>

                <div className="rounded-md border p-2">
                  <div className="text-xs opacity-60">Callback</div>
                  <div className="font-semibold">{p.callback_contacts}</div>
                </div>
              </div>

              {p.earliest_my_expiry && (
                <div className="text-xs opacity-70">
                  Earliest expiry (mine): <span className="font-medium">{fmtDT(p.earliest_my_expiry)}</span>
                </div>
              )}

              {(p.capacity_left <= 0 || p.available_now <= 0) && (
                <div className="text-xs text-amber-600">
                  {p.capacity_left <= 0
                    ? "Queue full (100). Submit calls to free capacity."
                    : "No available contacts now (maybe held by others)."}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={pull} disabled={pullDisabled}>
            {disabledByStatus
              ? "Campaign disabled"
              : reconciling
              ? "Syncing..."
              : loading
              ? "Pulling..."
              : `Pull ${computedPullLimit || PULL_MAX}`}
          </Button>

          <div className="text-xs opacity-70">
            Lease: <span className="font-medium">4h30</span> • max holding: <span className="font-medium">100</span>
          </div>
        </div>

        {pullHint && <div className="text-sm text-amber-700 whitespace-pre-wrap">{pullHint}</div>}

        {msg ? (
          <div
            className={`text-sm whitespace-pre-wrap rounded-lg border px-3 py-2 ${
              msgKind === "success"
                ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300"
                : msgKind === "error"
                ? "border-destructive/40 text-destructive"
                : "border-border bg-muted/40"
            }`}
          >
            {msg}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}