"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type CallLogRow = {
  call_log_id: string;
  called_at: string;
  next_call_at: string | null;
  note_text: string | null;

  upload_id: string;
  campaign_name: string | null;

  contact_id: string;
  person_id: string | null;
  company_name: string | null;
  given_name: string | null;
  family_name: string | null;
  telephone_number: string | null;
  mobile_number: string | null;
  email: string | null;

  tele_id: string | null;
  tele_name: string | null;

  result_id: string | null;
  group_name: string | null;
  detail_name: string | null;
  final_status: string | null;
  is_terminal: boolean | null;
  contact_current_status: string | null;
};

type Summary = {
  total: number;
  done: number;
  invalid: number;
  callback: number;
  terminal: number;
};

function fmtDT(s?: string | null) {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function fullName(r: CallLogRow) {
  const name = [r.given_name, r.family_name].filter(Boolean).join(" ").trim();
  return name || r.company_name || "—";
}

function finalStatusBadge(s?: string | null) {
  const text = String(s ?? "").trim().toUpperCase();
  if (!text) return null;

  if (text === "DONE") {
    return <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">DONE</Badge>;
  }
  if (text === "INVALID") {
    return <Badge className="bg-rose-600 text-white hover:bg-rose-600">INVALID</Badge>;
  }
  if (text === "CALLBACK") {
    return <Badge className="bg-amber-500 text-black hover:bg-amber-500">CALLBACK</Badge>;
  }

  return <Badge variant="outline">{text}</Badge>;
}

function summaryFromRows(rows: CallLogRow[]): Summary {
  return {
    total: rows.length,
    done: rows.filter((x) => String(x.final_status ?? "").toUpperCase() === "DONE").length,
    invalid: rows.filter((x) => String(x.final_status ?? "").toUpperCase() === "INVALID").length,
    callback: rows.filter((x) => String(x.final_status ?? "").toUpperCase() === "CALLBACK").length,
    terminal: rows.filter((x) => !!x.is_terminal).length,
  };
}

function SummaryChip(props: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border px-3 py-2">
      <div className="text-[11px] opacity-60">{props.label}</div>
      <div className="mt-1 text-sm font-semibold tabular-nums">{props.value}</div>
    </div>
  );
}

export default function AdminCallLogsPage() {
  const searchParams = useSearchParams();

  const uploadIdFilter = (searchParams.get("upload_id") ?? "").trim();
  const teleIdFilter = (searchParams.get("tele_id") ?? "").trim();
  const finalStatusFilter = (searchParams.get("final_status") ?? "").trim().toUpperCase();
  const resultGroupFilter = (searchParams.get("result_group") ?? "").trim();
  const dateFromFilter = (searchParams.get("date_from") ?? "").trim();
  const dateToFilter = (searchParams.get("date_to") ?? "").trim();

  const [rows, setRows] = useState<CallLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [groupOptions, setGroupOptions] = useState<string[]>([]);

  const load = async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "initial") setLoading(true);
    if (mode === "refresh") setRefreshing(true);

    setErrorText("");

    try {
      let query = supabase
        .from("v_call_logs_report")
        .select(
          [
            "call_log_id",
            "called_at",
            "next_call_at",
            "note_text",
            "upload_id",
            "campaign_name",
            "contact_id",
            `"Person ID"`,
            `"Company Name"`,
            `"Given Name"`,
            `"Family Name"`,
            `"Telephone Number"`,
            `"Mobile Number"`,
            `"Email"`,
            "tele_id",
            "tele_name",
            "result_id",
            "group_name",
            "detail_name",
            "final_status",
            "is_terminal",
            "contact_current_status",
          ].join(",")
        )
        .order("called_at", { ascending: false })
        .limit(1000);

      if (uploadIdFilter) {
        query = query.eq("upload_id", uploadIdFilter);
      }

      if (teleIdFilter) {
        query = query.eq("tele_id", teleIdFilter);
      }

      if (finalStatusFilter) {
        query = query.eq("final_status", finalStatusFilter);
      }

      if (resultGroupFilter) {
        query = query.eq("group_name", resultGroupFilter);
      }

      if (dateFromFilter) {
        query = query.gte("called_at", `${dateFromFilter}T00:00:00`);
      }

      if (dateToFilter) {
        query = query.lte("called_at", `${dateToFilter}T23:59:59`);
      }

      const { data, error } = await query;
      if (error) throw error;

      const mapped: CallLogRow[] = (((data as any[]) ?? []) as any[]).map((r) => ({
        call_log_id: String(r.call_log_id),
        called_at: String(r.called_at),
        next_call_at: r.next_call_at ?? null,
        note_text: r.note_text ?? null,

        upload_id: String(r.upload_id),
        campaign_name: r.campaign_name ?? null,

        contact_id: String(r.contact_id),
        person_id: r["Person ID"] ?? null,
        company_name: r["Company Name"] ?? null,
        given_name: r["Given Name"] ?? null,
        family_name: r["Family Name"] ?? null,
        telephone_number: r["Telephone Number"] ?? null,
        mobile_number: r["Mobile Number"] ?? null,
        email: r["Email"] ?? null,

        tele_id: r.tele_id ?? null,
        tele_name: r.tele_name ?? null,

        result_id: r.result_id ?? null,
        group_name: r.group_name ?? null,
        detail_name: r.detail_name ?? null,
        final_status: r.final_status ?? null,
        is_terminal: r.is_terminal ?? null,
        contact_current_status: r.contact_current_status ?? null,
      }));

      setRows(mapped);
      setLastUpdatedAt(new Date().toISOString());

      const groups = Array.from(
        new Set(mapped.map((x) => String(x.group_name ?? "").trim()).filter(Boolean))
      ).sort((a, b) => a.localeCompare(b));
      setGroupOptions(groups);
    } catch (e: any) {
      console.error(e);
      setErrorText(e?.message ?? "Failed to load call logs");
      setRows([]);
      setGroupOptions([]);
    } finally {
      if (mode === "initial") setLoading(false);
      if (mode === "refresh") setRefreshing(false);
    }
  };

  useEffect(() => {
    load("initial");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadIdFilter, teleIdFilter, finalStatusFilter, resultGroupFilter, dateFromFilter, dateToFilter]);

  const filteredRows = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;

    return rows.filter((r) => {
      const values = [
        r.campaign_name,
        r.tele_name,
        r.person_id,
        r.company_name,
        r.given_name,
        r.family_name,
        r.telephone_number,
        r.mobile_number,
        r.email,
        r.group_name,
        r.detail_name,
        r.final_status,
        r.note_text,
      ]
        .map((x) => String(x ?? "").toLowerCase())
        .join(" ");

      return values.includes(s);
    });
  }, [rows, q]);

  const summary = useMemo(() => summaryFromRows(filteredRows), [filteredRows]);

  const activeFilterLabels = [
    uploadIdFilter ? `Upload = ${uploadIdFilter}` : null,
    teleIdFilter ? `Tele = ${teleIdFilter}` : null,
    finalStatusFilter ? `Final status = ${finalStatusFilter}` : null,
    resultGroupFilter ? `Group = ${resultGroupFilter}` : null,
    dateFromFilter ? `From = ${dateFromFilter}` : null,
    dateToFilter ? `To = ${dateToFilter}` : null,
  ].filter(Boolean);

  const currentPathBase = "/admin/call-logs";

  const buildReplaceUrl = (next: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());

    Object.entries(next).forEach(([k, v]) => {
      if (!v) params.delete(k);
      else params.set(k, v);
    });

    const qs = params.toString();
    return qs ? `${currentPathBase}?${qs}` : currentPathBase;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <div className="text-2xl font-bold tracking-tight">Admin Call Logs</div>
          <div className="text-sm opacity-70">Loading call activity...</div>
        </div>

        <div className="grid gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="py-6">
                <div className="h-6 rounded bg-muted animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="text-2xl font-bold tracking-tight">Admin Call Logs</div>
          <div className="text-sm opacity-70">
            Filtered operational call history for campaign and team drill-down.
          </div>
          <div className="mt-1 text-xs opacity-60">
            Last updated: {lastUpdatedAt ? fmtDT(lastUpdatedAt) : "—"}
            {refreshing ? " · Refreshing..." : ""}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => load("refresh")} disabled={refreshing}>
            {refreshing ? "Refreshing..." : "Refresh"}
          </Button>
          <Link href="/admin/uploads">
            <Button variant="outline">Back to Uploads</Button>
          </Link>
        </div>
      </div>

      {errorText ? (
        <Card className="border-destructive/40">
          <CardContent className="py-4 text-sm text-destructive">{errorText}</CardContent>
        </Card>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryChip label="Visible logs" value={summary.total} />
        <SummaryChip label="DONE" value={summary.done} />
        <SummaryChip label="INVALID" value={summary.invalid} />
        <SummaryChip label="CALLBACK" value={summary.callback} />
        <SummaryChip label="Terminal" value={summary.terminal} />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Filters</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {activeFilterLabels.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {activeFilterLabels.map((label) => (
                <div key={label} className="rounded-full border px-3 py-1 text-xs opacity-80">
                  {label}
                </div>
              ))}

              <Link href="/admin/call-logs">
                <Button variant="outline" size="sm">
                  Clear filters
                </Button>
              </Link>
            </div>
          ) : (
            <div className="text-sm opacity-70">No URL filter applied.</div>
          )}

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Input
              placeholder="Search campaign / tele / person / phone / email / note..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />

            <div>
              <div className="text-xs opacity-60 mb-1">Result group</div>
              <Select
                value={resultGroupFilter || "__all__"}
                onValueChange={(v) => {
                  const href = buildReplaceUrl({ result_group: v === "__all__" ? "" : v });
                  window.location.href = href;
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All groups" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All groups</SelectItem>
                  {groupOptions.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <div className="text-xs opacity-60 mb-1">Date from</div>
              <Input
                type="date"
                value={dateFromFilter}
                onChange={(e) => {
                  const href = buildReplaceUrl({ date_from: e.target.value });
                  window.location.href = href;
                }}
              />
            </div>

            <div>
              <div className="text-xs opacity-60 mb-1">Date to</div>
              <Input
                type="date"
                value={dateToFilter}
                onChange={(e) => {
                  const href = buildReplaceUrl({ date_to: e.target.value });
                  window.location.href = href;
                }}
              />
            </div>
          </div>

          <div className="text-xs opacity-60">
            Showing {filteredRows.length} of {rows.length} loaded log(s).
          </div>
        </CardContent>
      </Card>

      <Card className="min-h-0">
        <CardHeader className="pb-3">
          <CardTitle>Call Logs</CardTitle>
        </CardHeader>

        <CardContent>
          {filteredRows.length === 0 ? (
            <div className="text-sm opacity-70">No call logs match the current filter.</div>
          ) : (
            <div className="max-h-[72vh] overflow-y-auto pr-1 space-y-3">
              {filteredRows.map((r) => (
                <div key={r.call_log_id} className="rounded-2xl border p-4">
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-sm font-semibold">{r.campaign_name || "—"}</div>
                        {finalStatusBadge(r.final_status)}
                        {r.group_name ? <Badge variant="outline">{r.group_name}</Badge> : null}
                      </div>

                      <div className="mt-1 text-xs opacity-70">
                        Called at: {fmtDT(r.called_at)} · Tele: {r.tele_name || "—"}
                      </div>

                      <div className="mt-2 grid gap-2 text-sm md:grid-cols-2 xl:grid-cols-3">
                        <div>
                          <span className="opacity-60">Contact:</span>{" "}
                          <span className="font-medium">{fullName(r)}</span>
                        </div>
                        <div>
                          <span className="opacity-60">Person ID:</span>{" "}
                          <span className="font-medium">{r.person_id || "—"}</span>
                        </div>
                        <div>
                          <span className="opacity-60">Phone:</span>{" "}
                          <span className="font-medium">{r.telephone_number || r.mobile_number || "—"}</span>
                        </div>
                        <div>
                          <span className="opacity-60">Email:</span>{" "}
                          <span className="font-medium">{r.email || "—"}</span>
                        </div>
                        <div>
                          <span className="opacity-60">Result detail:</span>{" "}
                          <span className="font-medium">{r.detail_name || "—"}</span>
                        </div>
                        <div>
                          <span className="opacity-60">Next call:</span>{" "}
                          <span className="font-medium">{fmtDT(r.next_call_at)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Link href={`/admin/uploads/${r.upload_id}`}>
                        <Button variant="outline" size="sm">
                          Open Campaign
                        </Button>
                      </Link>

                      {r.tele_id ? (
                        <Link href={`/admin/call-logs?tele_id=${r.tele_id}`}>
                          <Button variant="outline" size="sm">
                            More from Tele
                          </Button>
                        </Link>
                      ) : null}

                      <Link href={`/admin/call-logs?upload_id=${r.upload_id}`}>
                        <Button variant="outline" size="sm">
                          Same Campaign Logs
                        </Button>
                      </Link>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-3 xl:grid-cols-2">
                    <div className="rounded-xl bg-muted/40 p-3 text-sm">
                      <div className="text-xs opacity-60">Note</div>
                      <div className="mt-1 whitespace-pre-wrap line-clamp-4">
                        {r.note_text || "—"}
                      </div>
                    </div>

                    <div className="rounded-xl bg-muted/40 p-3 text-sm">
                      <div className="text-xs opacity-60">Contact status snapshot</div>
                      <div className="mt-1 font-medium">
                        {r.contact_current_status || "—"}
                        {r.is_terminal ? " · terminal" : ""}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 text-xs opacity-70">
                    <span className="rounded-full border px-2 py-1">Call Log ID: {r.call_log_id}</span>
                    <span className="rounded-full border px-2 py-1">Upload ID: {r.upload_id}</span>
                    <span className="rounded-full border px-2 py-1">Contact ID: {r.contact_id}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}