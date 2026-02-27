"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
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

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function CampaignPullPage() {
  const router = useRouter();
  const params = useParams();

  const id = useMemo(() => {
    const raw = (params as any)?.id;
    return Array.isArray(raw) ? raw[0] : String(raw ?? "");
  }, [params]);

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [status, setStatus] = useState<CampaignStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  const [p, setP] = useState<ProgressTele | null>(null);
  const [pLoading, setPLoading] = useState(false);

  const LEASE_MINUTES = 270; // 4h30
  const PULL_MAX = 100;

  const loadStatus = async () => {
    if (!id) return;
    setStatusLoading(true);
    try {
      const { data, error } = await supabase.from("uploads").select("status").eq("id", id).single();
      if (error) throw error;
      setStatus(String((data as any)?.status ?? ""));
    } catch (e: any) {
      console.error(e);
      setMsg(e?.message ?? "Load campaign failed");
      setStatus(null);
    } finally {
      setStatusLoading(false);
    }
  };

  const loadProgress = async () => {
    if (!id) return;
    setPLoading(true);
    try {
      const { data, error } = await supabase.rpc("rpc_campaign_progress_tele", { p_upload_id: id });
      if (error) throw error;

      const row = ((data as any[]) ?? [])[0];
      if (!row) {
        setP(null);
        return;
      }

      setP({
        upload_id: String(row.upload_id),
        status: String(row.status),

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
      // progress fail should not block pulling
      setMsg(e?.message ?? "Load progress failed");
      setP(null);
    } finally {
      setPLoading(false);
    }
  };

  useEffect(() => {
    if (!id) return;
    (async () => {
      setMsg(null);
      await Promise.all([loadStatus(), loadProgress()]);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const disabledByStatus = status === "PAUSE" || status === "DONE";

  const computedPullLimit = useMemo(() => {
    const cap = p ? clamp(p.capacity_left, 0, PULL_MAX) : PULL_MAX;
    // nếu cap = 0 thì pullLimit = 0 => button disabled
    return cap;
  }, [p]);

  const disabledByProgress = useMemo(() => {
    if (!p) return false; // nếu chưa load progress vẫn cho pull (RPC pull sẽ quyết định)
    return p.capacity_left <= 0 || p.available_now <= 0;
  }, [p]);

  const pullDisabled = loading || !id || statusLoading || disabledByStatus || disabledByProgress || computedPullLimit <= 0;

  const pullHint = useMemo(() => {
    if (disabledByStatus) return "Campaign disabled";
    if (!p) return null;

    if (p.capacity_left <= 0) return "Queue full (100). Submit calls to free capacity.";
    if (p.available_now <= 0) return "No available contacts now (maybe held by others or all terminal).";
    return null;
  }, [disabledByStatus, p]);

  const pull = async () => {
    if (!id) return;
    setLoading(true);
    setMsg(null);

    try {
      // Defensive: if we know limit=0, don't call
      const limit = computedPullLimit;
      if (limit <= 0) {
        setMsg("You already hold maximum contacts (100). Please submit calls to free capacity.");
        return;
      }

      const { data, error } = await supabase.rpc("rpc_pull_contacts", {
        p_upload_id: id,
        p_limit: limit,
        p_lease_minutes: LEASE_MINUTES,
      });

      if (error) throw error;

      const pulled = (data as any[])?.length ?? 0;

      // refresh progress always
      await loadProgress();

      if (pulled === 0) {
        setMsg("No contacts available to pull right now.");
        return;
      }

      setMsg(`Pulled ${pulled} contacts. Redirecting to workspace...`);
      router.push("/tele/workspace");
    } catch (e: any) {
      console.error(e);
      setMsg(e?.message ?? "Pull failed");
      await Promise.all([loadStatus(), loadProgress()]);
    } finally {
      setLoading(false);
    }
  };

  const donePercent = p ? clamp(p.done_percent, 0, 100) : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span>Pull Contacts</span>
          {status ? <StatusBadge status={status} kind="campaign" /> : null}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
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

        {/* Progress (tele-grade, not noisy) */}
        <div className="rounded-lg border p-3">
          <div className="flex items-center justify-between">
            <div className="font-medium">Progress</div>
            <Button variant="outline" size="sm" onClick={loadProgress} disabled={pLoading || !id}>
              {pLoading ? "Loading..." : "Refresh"}
            </Button>
          </div>

          {!p ? (
            <div className="text-sm opacity-70 mt-2">Progress not available.</div>
          ) : (
            <div className="mt-3 space-y-3">
              {/* Primary */}
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant="outline">Total: {p.total_contacts}</Badge>
                <Badge variant="outline">Done: {p.done_contacts}</Badge>
                <Badge variant="outline">Remaining: {p.remaining_contacts}</Badge>
                <span className="text-xs opacity-60">({donePercent}% done)</span>
              </div>

              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div className="h-2 bg-primary" style={{ width: `${donePercent}%` }} />
              </div>

              {/* Tele ops essentials */}
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
                  Earliest expiry (mine):{" "}
                  <span className="font-medium">{new Date(p.earliest_my_expiry).toLocaleString()}</span>
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
            {disabledByStatus ? "Campaign disabled" : loading ? "Pulling..." : `Pull ${computedPullLimit || PULL_MAX}`}
          </Button>

          <div className="text-xs opacity-70">
            Lease: <span className="font-medium">4h30</span>
            {p ? (
              <>
                {" "}
                • max holding: <span className="font-medium">100</span>
              </>
            ) : null}
          </div>
        </div>

        {pullHint && <div className="text-sm text-amber-700 whitespace-pre-wrap">{pullHint}</div>}
        {msg && <div className="text-sm whitespace-pre-wrap">{msg}</div>}
      </CardContent>
    </Card>
  );
}