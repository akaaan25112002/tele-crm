"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";

function nowIso() {
  return new Date().toISOString();
}

export default function CampaignPullPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [campaignName, setCampaignName] = useState<string>("");
  const [campaignStatus, setCampaignStatus] = useState<string>("");

  const [total, setTotal] = useState(0);
  const [available, setAvailable] = useState(0);
  const [inProgress, setInProgress] = useState(0);

  const load = async () => {
    if (!id) return;

    // upload info
    const { data: up, error: upErr } = await supabase
      .from("uploads")
      .select("campaign_name,status")
      .eq("id", id)
      .single();

    if (!upErr && up) {
      setCampaignName(up.campaign_name ?? "");
      setCampaignStatus(up.status ?? "");
    }

    // total
    const { count: totalCount } = await supabase
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .eq("upload_id", id);

    // available
    const { count: availCount } = await supabase
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .eq("upload_id", id)
      .not("current_status", "in", '("DONE","INVALID")')
      .or(`assigned_to.is.null,lease_expires_at.lt.${nowIso()}`);

    // in progress
    const { count: progCount } = await supabase
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .eq("upload_id", id)
      .not("current_status", "in", '("DONE","INVALID")')
      .not("assigned_to", "is", null)
      .gt("lease_expires_at", nowIso());

    setTotal(totalCount ?? 0);
    setAvailable(availCount ?? 0);
    setInProgress(progCount ?? 0);
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [id]);

  const pct = useMemo(() => {
    if (!total) return 0;
    const doneish = Math.max(0, total - available);
    return Math.round((doneish / total) * 100);
  }, [total, available]);

  const pullCount = Math.min(100, available);
  const pullLabel =
    available <= 0 ? "No contacts available" : pullCount < 100 ? `Pull ${pullCount} (all remaining)` : "Pull 100";

  const pull = async () => {
    setLoading(true);
    setMsg(null);

    const { data, error } = await supabase.rpc("rpc_pull_contacts", {
      p_upload_id: id,
      p_limit: 100, // 🔒 vẫn giữ 100 trong RPC, server có thể trả <100 nếu không đủ
      p_lease_minutes: 120,
    });

    setLoading(false);

    if (error) {
      setMsg(error.message);
      return;
    }

    const pulled = (data as any[])?.length ?? 0;
    setMsg(`Pulled ${pulled} contacts. Redirecting...`);

    await load();

    localStorage.setItem("active_upload_id", id);
    router.push("/tele/workspace");
  };

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-2xl">
                {campaignName || "Campaign"}
              </CardTitle>
              <div className="text-sm opacity-70 mt-1">Campaign ID: {id}</div>
            </div>
            {campaignStatus && <StatusBadge status={campaignStatus} />}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-3 gap-3">
            <div className="rounded-xl border p-3">
              <div className="text-xs opacity-60">Total</div>
              <div className="text-2xl font-semibold">{total}</div>
            </div>
            <div className="rounded-xl border p-3">
              <div className="text-xs opacity-60">Available</div>
              <div className="text-2xl font-semibold">{available}</div>
            </div>
            <div className="rounded-xl border p-3">
              <div className="text-xs opacity-60">In progress</div>
              <div className="text-2xl font-semibold">{inProgress}</div>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs opacity-70">
              <span>Progress</span>
              <span>{pct}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted">
              <div
                className="h-2 rounded-full bg-foreground/70"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="text-xs opacity-60">
              Available = not DONE/INVALID and (unassigned or lease expired)
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={pull} disabled={loading || available <= 0}>
              {loading ? "Pulling..." : pullLabel}
            </Button>
            <Button variant="outline" onClick={load} disabled={loading}>
              Refresh
            </Button>
          </div>

          {msg && <div className="text-sm">{msg}</div>}
        </CardContent>
      </Card>
    </div>
  );
}