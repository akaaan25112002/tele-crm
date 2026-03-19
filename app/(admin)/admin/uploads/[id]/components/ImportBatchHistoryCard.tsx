"use client";

import { useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import type { ImportBatchHistoryVM } from "../hooks/useImportBatchHistory";
import type { CampaignPurgeVM } from "../hooks/useCampaignPurge";
import { fmtDTFull, importBatchStatusTone } from "../lib/import-batch.utils";

export default function ImportBatchHistoryCard(props: {
  historyVm: ImportBatchHistoryVM;
  purgeVm: CampaignPurgeVM;
  refreshToken?: number;
  onAfterBatchDeleted?: () => Promise<void> | void;
}) {
  const { historyVm, purgeVm, refreshToken, onAfterBatchDeleted } = props;

  useEffect(() => {
    void historyVm.load();
  }, [historyVm, refreshToken]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Import Batch History</CardTitle>
          <Button variant="outline" size="sm" onClick={() => void historyVm.load()} disabled={historyVm.loading}>
            {historyVm.loading ? "Loading..." : "Refresh"}
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {historyVm.errorText ? (
          <div className="mb-3 rounded-md border border-destructive/40 p-3 text-sm text-destructive">
            {historyVm.errorText}
          </div>
        ) : null}

        {historyVm.rows.length === 0 ? (
          <div className="text-sm opacity-70">No import batch history found for this campaign.</div>
        ) : (
          <div className="space-y-3">
            {historyVm.rows.map((row) => (
              <div key={row.id} className="rounded-xl border p-4">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-medium break-all">{row.filename ?? "Unnamed batch"}</div>
                      <Badge className={importBatchStatusTone(row.status)}>{row.status}</Badge>
                      <Badge variant="outline">{row.import_mode}</Badge>
                    </div>

                    <div className="mt-2 text-xs opacity-70">
                      {row.imported_by_name ?? "Unknown"} • created {fmtDTFull(row.created_at)}
                      {row.completed_at ? ` • completed ${fmtDTFull(row.completed_at)}` : ""}
                    </div>

                    {row.notes ? (
                      <div className="mt-2 text-sm opacity-80 whitespace-pre-wrap">{row.notes}</div>
                    ) : null}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm xl:min-w-[300px]">
                    <div className="rounded-lg border p-2">Total: <b>{row.total_rows}</b></div>
                    <div className="rounded-lg border p-2">Inserted: <b>{row.inserted_rows}</b></div>
                    <div className="rounded-lg border p-2">Duplicate: <b>{row.duplicate_rows}</b></div>
                    <div className="rounded-lg border p-2">Failed: <b>{row.failed_rows}</b></div>
                    <div className="rounded-lg border p-2">Skipped: <b>{row.skipped_rows}</b></div>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => purgeVm.openDeleteBatch(row)}
                    disabled={purgeVm.busy}
                  >
                    Delete batch
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      purgeVm.openDeleteBatch(row);
                      await onAfterBatchDeleted?.();
                    }}
                    className="hidden"
                  >
                    hidden hook
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}