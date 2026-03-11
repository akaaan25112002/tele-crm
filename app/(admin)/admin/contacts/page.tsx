"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";

type ContactRow = {
  contact_id: string;
  upload_id: string;

  current_status: string;
  assigned_to: string | null;
  assigned_tele_name: string | null;
  assigned_at: string | null;
  lease_expires_at: string | null;

  next_call_at: string | null;
  last_called_at: string | null;

  last_result_group: string | null;
  last_result_detail: string | null;
  last_result_final_status: string | null;
  last_note_text: string | null;

  total_calls: number;
  edited_fields_count: number;

  person_id: string | null;
  company_name: string | null;
  given_name: string | null;
  family_name: string | null;
  telephone_number: string | null;
  email: string | null;
};

function fmtDT(s?: string | null) {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function isExpired(s?: string | null) {
  if (!s) return false;
  const t = new Date(s).getTime();
  if (Number.isNaN(t)) return false;
  return t <= Date.now();
}

function fullName(r: ContactRow) {
  const name = [r.given_name, r.family_name].filter(Boolean).join(" ").trim();
  return name || r.company_name || "—";
}

function buildSubtitle(r: ContactRow) {
  const parts = [
    r.person_id ? `Person ID: ${r.person_id}` : null,
    r.telephone_number ? `Tel: ${r.telephone_number}` : null,
    r.email ? `Email: ${r.email}` : null,
  ].filter(Boolean);
  return parts.join(" · ");
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

export default function AdminContactsPage() {
  const searchParams = useSearchParams();

  const statusFilter = (searchParams.get("status") ?? "").trim().toUpperCase();
  const assignedToFilter = (searchParams.get("assigned_to") ?? "").trim();
  const uploadIdFilter = (searchParams.get("upload_id") ?? "").trim();
  const staleAssignedFilter = (searchParams.get("stale_assigned") ?? "").trim() === "1";
  const overdueCallbackFilter = (searchParams.get("overdue_callback") ?? "").trim() === "1";
  const terminalFilter = (searchParams.get("terminal") ?? "").trim() === "1";

  const [rows, setRows] = useState<ContactRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const load = async (mode: "initial" | "refresh" = "initial") => {
    if (mode === "initial") setLoading(true);
    if (mode === "refresh") setRefreshing(true);

    setErrorText("");

    try {
      let query = supabase
        .from("v_contacts_master_enriched")
        .select(
          [
            "contact_id",
            "upload_id",
            "current_status",
            "assigned_to",
            "assigned_tele_name",
            "assigned_at",
            "lease_expires_at",
            "next_call_at",
            "last_called_at",
            "last_result_group",
            "last_result_detail",
            "last_result_final_status",
            "last_note_text",
            "total_calls",
            "edited_fields_count",
            `"Person ID"`,
            `"Company Name"`,
            `"Given Name"`,
            `"Family Name"`,
            `"Telephone Number"`,
            `"Email"`,
          ].join(",")
        )
        .order("updated_at", { ascending: false })
        .limit(1000);

      if (uploadIdFilter) {
        query = query.eq("upload_id", uploadIdFilter);
      }

      if (assignedToFilter) {
        query = query.eq("assigned_to", assignedToFilter);
      }

      if (terminalFilter) {
        query = query.in("current_status", ["DONE", "INVALID"]);
      } else if (statusFilter) {
        query = query.eq("current_status", statusFilter);
      }

      if (staleAssignedFilter) {
        query = query.eq("current_status", "ASSIGNED").lte("lease_expires_at", new Date().toISOString());
      }

      if (overdueCallbackFilter) {
        query = query
          .eq("current_status", "CALLBACK")
          .not("next_call_at", "is", null)
          .lt("next_call_at", new Date().toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;

      const mapped: ContactRow[] = (((data as any[]) ?? []) as any[]).map((r) => ({
        contact_id: String(r.contact_id),
        upload_id: String(r.upload_id),
        current_status: String(r.current_status ?? ""),
        assigned_to: r.assigned_to ?? null,
        assigned_tele_name: r.assigned_tele_name ?? null,
        assigned_at: r.assigned_at ?? null,
        lease_expires_at: r.lease_expires_at ?? null,
        next_call_at: r.next_call_at ?? null,
        last_called_at: r.last_called_at ?? null,
        last_result_group: r.last_result_group ?? null,
        last_result_detail: r.last_result_detail ?? null,
        last_result_final_status: r.last_result_final_status ?? null,
        last_note_text: r.last_note_text ?? null,
        total_calls: Number(r.total_calls ?? 0),
        edited_fields_count: Number(r.edited_fields_count ?? 0),
        person_id: r["Person ID"] ?? null,
        company_name: r["Company Name"] ?? null,
        given_name: r["Given Name"] ?? null,
        family_name: r["Family Name"] ?? null,
        telephone_number: r["Telephone Number"] ?? null,
        email: r["Email"] ?? null,
      }));

      setRows(mapped);
      setLastUpdatedAt(new Date().toISOString());
    } catch (e: any) {
      console.error(e);
      setErrorText(e?.message ?? "Failed to load contacts");
      setRows([]);
    } finally {
      if (mode === "initial") setLoading(false);
      if (mode === "refresh") setRefreshing(false);
    }
  };

  useEffect(() => {
    load("initial");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, assignedToFilter, uploadIdFilter, staleAssignedFilter, overdueCallbackFilter, terminalFilter]);

  const filteredRows = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;

    return rows.filter((r) => {
      const name = fullName(r).toLowerCase();
      const company = (r.company_name ?? "").toLowerCase();
      const tel = (r.telephone_number ?? "").toLowerCase();
      const email = (r.email ?? "").toLowerCase();
      const pid = (r.person_id ?? "").toLowerCase();
      const assignee = (r.assigned_tele_name ?? "").toLowerCase();

      return (
        name.includes(s) ||
        company.includes(s) ||
        tel.includes(s) ||
        email.includes(s) ||
        pid.includes(s) ||
        assignee.includes(s)
      );
    });
  }, [rows, q]);

  const activeFilterLabels = [
    statusFilter ? `Status = ${statusFilter}` : null,
    terminalFilter ? "Terminal only" : null,
    assignedToFilter ? `Assigned to = ${assignedToFilter}` : null,
    uploadIdFilter ? `Upload = ${uploadIdFilter}` : null,
    staleAssignedFilter ? "Stale assigned only" : null,
    overdueCallbackFilter ? "Overdue callback only" : null,
  ].filter(Boolean);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <div className="text-2xl font-bold tracking-tight">Admin Contacts</div>
          <div className="text-sm opacity-70">Loading contact operations view...</div>
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
          <div className="text-2xl font-bold tracking-tight">Admin Contacts</div>
          <div className="text-sm opacity-70">
            Filtered operational view for contact-level drill-down actions.
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

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {activeFilterLabels.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {activeFilterLabels.map((label) => (
                <div key={label} className="rounded-full border px-3 py-1 text-xs opacity-80">
                  {label}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm opacity-70">No drill-down filter applied.</div>
          )}

          <Input
            placeholder="Search name / company / phone / email / person id / assignee..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />

          <div className="text-xs opacity-60">
            Showing {filteredRows.length} of {rows.length} loaded contact(s).
          </div>
        </CardContent>
      </Card>

      <Card className="min-h-0">
        <CardHeader className="pb-3">
          <CardTitle>Contacts</CardTitle>
        </CardHeader>

        <CardContent>
          {filteredRows.length === 0 ? (
            <div className="text-sm opacity-70">No contacts match the current filter.</div>
          ) : (
            <div className="max-h-[72vh] overflow-y-auto pr-1 space-y-3">
              {filteredRows.map((r) => {
                const expiredLease = isExpired(r.lease_expires_at);
                const overdueCallback =
                  r.current_status === "CALLBACK" &&
                  !!r.next_call_at &&
                  new Date(r.next_call_at).getTime() < Date.now();

                return (
                  <div key={r.contact_id} className="rounded-2xl border p-4">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-sm font-semibold">{fullName(r)}</div>
                          <StatusBadge status={r.current_status} kind="contact" />
                          {finalStatusBadge(r.last_result_final_status)}
                          {overdueCallback ? (
                            <Badge className="bg-amber-500 text-black hover:bg-amber-500">
                              OVERDUE CALLBACK
                            </Badge>
                          ) : null}
                          {expiredLease && r.current_status === "ASSIGNED" ? (
                            <Badge className="bg-rose-600 text-white hover:bg-rose-600">
                              STALE LEASE
                            </Badge>
                          ) : null}
                        </div>

                        <div className="mt-1 text-xs opacity-70">{buildSubtitle(r) || "—"}</div>

                        <div className="mt-2 grid gap-2 text-sm md:grid-cols-2 xl:grid-cols-3">
                          <div>
                            <span className="opacity-60">Assignee:</span>{" "}
                            <span className="font-medium">{r.assigned_tele_name ?? "—"}</span>
                          </div>
                          <div>
                            <span className="opacity-60">Assigned at:</span>{" "}
                            <span className="font-medium">{fmtDT(r.assigned_at)}</span>
                          </div>
                          <div>
                            <span className="opacity-60">Lease expires:</span>{" "}
                            <span className="font-medium">{fmtDT(r.lease_expires_at)}</span>
                          </div>
                          <div>
                            <span className="opacity-60">Next call:</span>{" "}
                            <span className="font-medium">{fmtDT(r.next_call_at)}</span>
                          </div>
                          <div>
                            <span className="opacity-60">Last called:</span>{" "}
                            <span className="font-medium">{fmtDT(r.last_called_at)}</span>
                          </div>
                          <div>
                            <span className="opacity-60">Total calls:</span>{" "}
                            <span className="font-medium">{r.total_calls}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Link href={`/admin/uploads/${r.upload_id}`}>
                          <Button variant="outline" size="sm">
                            Open Campaign
                          </Button>
                        </Link>
                        <Link href={`/admin/uploads/${r.upload_id}?tab=audit`}>
                          <Button variant="outline" size="sm">
                            Audit
                          </Button>
                        </Link>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-3 xl:grid-cols-2">
                      <div className="rounded-xl bg-muted/40 p-3 text-sm">
                        <div className="text-xs opacity-60">Last result</div>
                        <div className="mt-1 font-medium">
                          {r.last_result_group || "—"}
                          {r.last_result_detail ? ` / ${r.last_result_detail}` : ""}
                        </div>
                      </div>

                      <div className="rounded-xl bg-muted/40 p-3 text-sm">
                        <div className="text-xs opacity-60">Latest note</div>
                        <div className="mt-1 whitespace-pre-wrap line-clamp-3">
                          {r.last_note_text || "—"}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2 text-xs opacity-70">
                      <span className="rounded-full border px-2 py-1">Contact ID: {r.contact_id}</span>
                      <span className="rounded-full border px-2 py-1">Upload ID: {r.upload_id}</span>
                      <span className="rounded-full border px-2 py-1">
                        Edited fields: {r.edited_fields_count}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}