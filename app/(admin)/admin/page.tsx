"use client";

import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function AdminHome() {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Link href="/admin/uploads">
        <Card className="hover:shadow-md transition">
          <CardHeader><CardTitle>Uploads</CardTitle></CardHeader>
          <CardContent className="text-sm opacity-80">
            Import file tổng, xem progress, export report
          </CardContent>
        </Card>
      </Link>
    </div>
  );
}