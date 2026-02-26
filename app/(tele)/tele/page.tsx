"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

type Upload = { id: string; campaign_name: string; created_at: string; status: string };

export default function TeleHome() {
  const [uploads, setUploads] = useState<Upload[]>([]);

  useEffect(() => {
    supabase
      .from("uploads")
      .select("id,campaign_name,created_at,status")
      .order("created_at", { ascending: false })
      .then(({ data }) => setUploads((data as any) ?? []));
  }, []);

  return (
    <div className="space-y-3">
      <div className="text-2xl font-semibold">Choose Campaign</div>
      <div className="grid md:grid-cols-2 gap-4">
        {uploads.map((u) => (
          <Link key={u.id} href={`/tele/campaign/${u.id}`}>
            <Card className="hover:shadow-md transition">
              <CardHeader><CardTitle className="text-lg">{u.campaign_name}</CardTitle></CardHeader>
              <CardContent className="text-sm opacity-80">
                Status: {u.status}<br />
                Created: {new Date(u.created_at).toLocaleString()}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}