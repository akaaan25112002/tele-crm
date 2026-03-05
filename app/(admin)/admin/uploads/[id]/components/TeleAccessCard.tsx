"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import type { UploadDetailVM } from "../hooks/useUploadDetail";

export default function TeleAccessCard({ vm }: { vm: UploadDetailVM }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tele Access</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-sm opacity-70">Select which tele agents can work on this campaign.</div>

        {vm.teles.length === 0 ? (
          <div className="text-sm opacity-70">No TELE users found.</div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {vm.teles.map((t) => {
              const checked = vm.members.has(t.id);
              const busy = vm.savingMember === t.id;

              return (
                <label key={t.id} className="flex items-center gap-2 rounded-md border p-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={checked}
                    disabled={busy || vm.loading}
                    onChange={(e) => vm.toggleMember(t.id, e.target.checked)}
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{t.full_name ?? t.id.slice(0, 8)}</div>
                    <div className="text-xs opacity-60 truncate">{busy ? "Saving..." : t.id}</div>
                  </div>
                </label>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}