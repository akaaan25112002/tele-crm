"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";

type CampaignRow = {
  id: string;
  campaign_name: string;
  created_at: string;
  status: string;
  total_contacts?: number;
  available_contacts?: number;
};

export default function TeleHome() {
  const [rows, setRows] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const hasRows = useMemo(() => rows.length > 0, [rows]);

  const loadViaRpc = async (): Promise<CampaignRow[] | null> => {
    const { data, error } = await supabase.rpc("rpc_my_campaigns");
    if (error) return null;

    return ((data as any[]) ?? []).map((x) => ({
      id: String(x.id),
      campaign_name: String(x.campaign_name ?? ""),
      created_at: String(x.created_at),
      status: String(x.status),
      total_contacts: Number(x.total_contacts ?? 0),
      available_contacts: Number(x.available_contacts ?? 0),
    }));
  };

  const loadViaTables = async (): Promise<CampaignRow[]> => {
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user.id;
    if (!uid) return [];

    const { data: ms, error: msErr } = await supabase.from("upload_members").select("upload_id").eq("tele_id", uid);
    if (msErr) throw msErr;

    const uploadIds = ((ms as any[]) ?? []).map((x) => x.upload_id);
    if (!uploadIds.length) return [];

    const { data: us, error: usErr } = await supabase
      .from("uploads")
      .select("id,campaign_name,created_at,status")
      .in("id", uploadIds)
      .order("created_at", { ascending: false });

    if (usErr) throw usErr;

    return ((us as any[]) ?? []).map((u) => ({
      id: String(u.id),
      campaign_name: String(u.campaign_name ?? ""),
      created_at: String(u.created_at),
      status: String(u.status),
    }));
  };

  const load = async () => {
    setLoading(true);
    setErr(null);

    try {
      const rpcRows = await loadViaRpc();
      if (rpcRows) {
        setRows(rpcRows);
        return;
      }

      const tableRows = await loadViaTables();
      setRows(tableRows);
    } catch (e: any) {
      console.error(e);
      setErr(e?.message ?? "Load failed");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="text-2xl font-semibold">Choose Campaign</div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          {loading ? "Loading..." : "Refresh"}
        </Button>
      </div>

      {err && <div className="text-sm text-red-600 whitespace-pre-wrap">{err}</div>}

      {!hasRows && !loading && (
        <div className="text-sm opacity-70">No campaigns available. Ask admin to add you to a campaign.</div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {rows.map((u) => (
          <Link key={u.id} href={`/tele/campaign/${u.id}`}>
            <Card className="hover:shadow-md transition">
              <CardHeader>
                <CardTitle className="text-lg flex items-center justify-between gap-2">
                  <span className="truncate">{u.campaign_name}</span>
                  <StatusBadge status={u.status} kind="campaign" />
                </CardTitle>
              </CardHeader>

              <CardContent className="text-sm opacity-80 space-y-2">
                <div>Created: {new Date(u.created_at).toLocaleString()}</div>

                {typeof u.total_contacts === "number" && typeof u.available_contacts === "number" ? (
                  <div className="flex gap-3">
                    <div className="rounded-md border px-2 py-1">
                      <div className="text-xs opacity-70">Contacts</div>
                      <div className="font-semibold tabular-nums">{u.total_contacts}</div>
                    </div>

                    <div className="rounded-md border px-2 py-1">
                      <div className="text-xs opacity-70">Available</div>
                      <div className="font-semibold tabular-nums">{u.available_contacts}</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs opacity-60"></div>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}