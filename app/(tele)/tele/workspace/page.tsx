"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";

type Upload = {
  id: string;
  campaign_name: string;
  created_at: string;
  status: string;
};

type Stat = { total: number; available: number; inProgress: number };

function nowIso() {
  return new Date().toISOString();
}

export default function TeleHome() {
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [stats, setStats] = useState<Record<string, Stat>>({});
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("uploads")
      .select("id,campaign_name,created_at,status")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }

    const rows = ((data as any) ?? []) as Upload[];
    setUploads(rows);

    const nextStats: Record<string, Stat> = {};

    await Promise.all(
      rows.map(async (u) => {
        const { count: totalCount } = await supabase
          .from("contacts")
          .select("id", { count: "exact", head: true })
          .eq("upload_id", u.id);

        const { count: availCount } = await supabase
          .from("contacts")
          .select("id", { count: "exact", head: true })
          .eq("upload_id", u.id)
          .not("current_status", "in", '("DONE","INVALID")')
          .or(`assigned_to.is.null,lease_expires_at.lt.${nowIso()}`);

        const { count: progCount } = await supabase
          .from("contacts")
          .select("id", { count: "exact", head: true })
          .eq("upload_id", u.id)
          .not("current_status", "in", '("DONE","INVALID")')
          .not("assigned_to", "is", null)
          .gt("lease_expires_at", nowIso());

        nextStats[u.id] = {
          total: totalCount ?? 0,
          available: availCount ?? 0,
          inProgress: progCount ?? 0,
        };
      })
    );

    setStats(nextStats);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 10000); // realtime-ish
    return () => clearInterval(t);
  }, []);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    const rows = query
      ? uploads.filter((u) => u.campaign_name.toLowerCase().includes(query))
      : uploads;

    // Sort: available desc, then created desc
    return [...rows].sort((a, b) => {
      const sa = stats[a.id]?.available ?? -1;
      const sb = stats[b.id]?.available ?? -1;
      if (sb !== sa) return sb - sa;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [uploads, stats, q]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <div className="text-2xl font-semibold">Campaigns</div>
          <div className="text-sm opacity-70">Pick a campaign to pull contacts and start calling.</div>
        </div>

        <div className="flex gap-2">
          <Input
            placeholder="Search campaign..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="md:w-[320px]"
          />
          <Button variant="outline" onClick={load} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {filtered.map((u) => {
          const st = stats[u.id];
          const available = st?.available ?? null;
          const total = st?.total ?? null;
          const inProgress = st?.inProgress ?? null;

          const isEmpty = available !== null && available <= 0;

          return (
            <Link key={u.id} href={`/tele/campaign/${u.id}`} className={isEmpty ? "opacity-80" : ""}>
              <Card className="hover:shadow-md transition rounded-2xl">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="text-xl truncate">{u.campaign_name}</CardTitle>
                    <StatusBadge status={u.status} />
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  <div className="flex items-baseline justify-between">
                    <div>
                      <div className="text-xs opacity-60">Available</div>
                      <div className="text-3xl font-semibold">
                        {available === null ? "…" : available}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs opacity-60">Total</div>
                      <div className="text-lg font-semibold">{total === null ? "…" : total}</div>

                      <div className="text-xs opacity-60 mt-1">In progress</div>
                      <div className="text-sm font-medium">{inProgress === null ? "…" : inProgress}</div>
                    </div>
                  </div>

                  <div className="text-xs opacity-60">
                    Created: {new Date(u.created_at).toLocaleString()}
                  </div>

                  {isEmpty && (
                    <div className="text-xs opacity-70">
                      No available contacts (all done/invalid or currently leased).
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}