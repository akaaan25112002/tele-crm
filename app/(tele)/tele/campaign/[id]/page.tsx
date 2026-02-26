"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function CampaignPullPage() {
  const { id } = useParams<{ id: string }>();
  const [limit, setLimit] = useState(50);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const pull = async () => {
    setLoading(true);
    setMsg(null);

    const { data, error } = await supabase.rpc("rpc_pull_contacts", {
      p_upload_id: id,
      p_limit: limit,
      p_lease_minutes: 120,
    });

    setLoading(false);
    if (error) return setMsg(error.message);

    const pulled = (data as any[])?.length ?? 0;
    setMsg(`Pulled ${pulled} contacts`);
    localStorage.setItem("active_upload_id", id);
    window.location.href = "/tele/workspace";
  };

  return (
    <Card>
      <CardHeader><CardTitle>Pull Contacts</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="text-sm opacity-80">Campaign ID: {id}</div>
        <div className="flex gap-2">
          <Input
            type="number"
            value={limit}
            onChange={(e) => setLimit(parseInt(e.target.value || "50", 10))}
          />
          <Button onClick={pull} disabled={loading}>
            {loading ? "Pulling..." : `Pull ${limit}`}
          </Button>
        </div>
        {msg && <div className="text-sm">{msg}</div>}
      </CardContent>
    </Card>
  );
}