"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createKpiRule,
  deleteKpiRule,
  loadKpiRules,
  updateKpiRule,
} from "./kpi-rules.data";
import type { KpiRuleFilter, KpiRuleForm, KpiRuleRow } from "./kpi-rules.types";

const EMPTY_FORM: KpiRuleForm = {
  final_status: "DONE",
  group_name: "",
  detail_name: "",
  is_kpi_eligible: true,
  is_active: true,
  note: "",
};

function fmtDT(s?: string | null) {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function normalizeForSearch(s: string | null | undefined) {
  return String(s ?? "").trim().toLowerCase();
}

function matchesFilter(row: KpiRuleRow, filter: KpiRuleFilter) {
  if (filter.finalStatus !== "ALL" && row.final_status !== filter.finalStatus) {
    return false;
  }

  if (filter.activeMode === "ACTIVE" && !row.is_active) return false;
  if (filter.activeMode === "INACTIVE" && row.is_active) return false;

  if (filter.eligibilityMode === "KPI" && !row.is_kpi_eligible) return false;
  if (filter.eligibilityMode === "NON_KPI" && row.is_kpi_eligible) return false;

  const q = normalizeForSearch(filter.keyword);
  if (!q) return true;

  const haystack = [
    row.final_status,
    row.group_name,
    row.detail_name,
    row.note,
  ]
    .map(normalizeForSearch)
    .join(" ");

  return haystack.includes(q);
}

function RuleBadge(props: { eligible: boolean }) {
  return props.eligible ? (
    <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">KPI</Badge>
  ) : (
    <Badge variant="secondary">Non-KPI</Badge>
  );
}

function StatusBadge(props: { active: boolean }) {
  return props.active ? (
    <Badge variant="outline">Active</Badge>
  ) : (
    <Badge variant="secondary">Inactive</Badge>
  );
}

function ScopeBadge(props: { detailName: string | null }) {
  return props.detailName ? (
    <Badge variant="outline">Detail-level</Badge>
  ) : (
    <Badge variant="outline">Group-level</Badge>
  );
}

function MiniStat(props: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border p-3">
      <div className="text-[11px] opacity-60">{props.label}</div>
      <div className="mt-1 text-sm font-semibold tabular-nums">{props.value}</div>
    </div>
  );
}

function buildRuleKey(form: Pick<KpiRuleForm, "final_status" | "group_name" | "detail_name">) {
  return [
    form.final_status.trim().toUpperCase(),
    form.group_name.trim().toUpperCase(),
    form.detail_name.trim().toUpperCase(),
  ].join("::");
}

export default function AdminKpiRulesPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [errorText, setErrorText] = useState("");
  const [successText, setSuccessText] = useState("");

  const [rows, setRows] = useState<KpiRuleRow[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<KpiRuleForm>(EMPTY_FORM);

  const [filter, setFilter] = useState<KpiRuleFilter>({
    keyword: "",
    finalStatus: "ALL",
    activeMode: "ALL",
    eligibilityMode: "ALL",
  });

  const reload = useCallback(async () => {
    setLoading(true);
    setErrorText("");

    try {
      const data = await loadKpiRules();
      setRows(data);
    } catch (e: any) {
      console.error(e);
      setErrorText(e?.message ?? "Failed to load KPI rules");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => matchesFilter(row, filter));
  }, [rows, filter]);

  const stats = useMemo(() => {
    return {
      total: rows.length,
      active: rows.filter((x) => x.is_active).length,
      inactive: rows.filter((x) => !x.is_active).length,
      kpi: rows.filter((x) => x.is_kpi_eligible).length,
      nonKpi: rows.filter((x) => !x.is_kpi_eligible).length,
      done: rows.filter((x) => x.final_status === "DONE").length,
      callback: rows.filter((x) => x.final_status === "CALLBACK").length,
      invalid: rows.filter((x) => x.final_status === "INVALID").length,
    };
  }, [rows]);

  const duplicateKey = useMemo(() => {
    const currentKey = buildRuleKey(form);
    return rows.find((row) => {
      if (editingId && row.id === editingId) return false;
      const rowKey = [
        row.final_status.trim().toUpperCase(),
        row.group_name.trim().toUpperCase(),
        (row.detail_name ?? "").trim().toUpperCase(),
      ].join("::");
      return rowKey === currentKey;
    });
  }, [rows, form, editingId]);

  const groupedPreviewLabel = useMemo(() => {
    const status = form.final_status.trim().toUpperCase() || "—";
    const group = form.group_name.trim().toUpperCase() || "—";
    const detail = form.detail_name.trim().toUpperCase();

    if (!detail) {
      return `${status} · ${group} · ALL DETAILS`;
    }

    return `${status} · ${group} · ${detail}`;
  }, [form]);

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  function startEdit(row: KpiRuleRow) {
    setEditingId(row.id);
    setForm({
      id: row.id,
      final_status: row.final_status,
      group_name: row.group_name,
      detail_name: row.detail_name ?? "",
      is_kpi_eligible: row.is_kpi_eligible,
      is_active: row.is_active,
      note: row.note ?? "",
    });
    setSuccessText("");
    setErrorText("");
  }

  async function onSave() {
    setSaving(true);
    setErrorText("");
    setSuccessText("");

    try {
      if (!form.final_status.trim()) {
        throw new Error("Final status is required");
      }

      if (!form.group_name.trim()) {
        throw new Error("Outcome group is required");
      }

      if (duplicateKey) {
        throw new Error("A KPI rule with the same Final Status + Outcome Group + Detail already exists.");
      }

      if (editingId) {
        await updateKpiRule({
          ...form,
          id: editingId,
        });
        setSuccessText("KPI rule updated successfully.");
      } else {
        await createKpiRule(form);
        setSuccessText("KPI rule created successfully.");
      }

      await reload();
      resetForm();
    } catch (e: any) {
      console.error(e);
      setErrorText(e?.message ?? "Failed to save KPI rule");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(ruleId: string) {
    const confirmed = window.confirm(
      "Delete this KPI rule? This removes the rule from the database."
    );
    if (!confirmed) return;

    setDeletingId(ruleId);
    setErrorText("");
    setSuccessText("");

    try {
      await deleteKpiRule(ruleId);
      setSuccessText("KPI rule deleted successfully.");
      if (editingId === ruleId) {
        resetForm();
      }
      await reload();
    } catch (e: any) {
      console.error(e);
      setErrorText(e?.message ?? "Failed to delete KPI rule");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {(errorText || successText) && (
        <Card className={errorText ? "border-destructive/40" : "border-emerald-500/30"}>
          <CardContent className={`py-4 text-sm ${errorText ? "text-destructive" : "text-emerald-700"}`}>
            {errorText || successText}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Tele KPI Rules</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm opacity-80">
            Manage which call result outcomes count toward Tele KPI. Matching priority is:
            <span className="font-medium"> Final Status + Outcome Group + Detail</span>, then fallback to
            <span className="font-medium"> Final Status + Outcome Group</span> when Detail is blank.
          </div>

          <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-8">
            <MiniStat label="Total Rules" value={stats.total} />
            <MiniStat label="Active" value={stats.active} />
            <MiniStat label="Inactive" value={stats.inactive} />
            <MiniStat label="KPI" value={stats.kpi} />
            <MiniStat label="Non-KPI" value={stats.nonKpi} />
            <MiniStat label="DONE Rules" value={stats.done} />
            <MiniStat label="CALLBACK Rules" value={stats.callback} />
            <MiniStat label="INVALID Rules" value={stats.invalid} />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[440px_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? "Edit KPI Rule" : "Create KPI Rule"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border p-3">
              <div className="text-[11px] opacity-60">Rule Preview</div>
              <div className="mt-1 text-sm font-semibold break-words">{groupedPreviewLabel}</div>
              <div className="mt-2 flex flex-wrap gap-2">
                <RuleBadge eligible={form.is_kpi_eligible} />
                <StatusBadge active={form.is_active} />
                <ScopeBadge detailName={form.detail_name.trim() ? form.detail_name : null} />
              </div>
            </div>

            {duplicateKey ? (
              <div className="rounded-lg border border-amber-500/40 px-3 py-2 text-sm text-amber-700">
                A rule with the same Final Status + Outcome Group + Detail already exists.
              </div>
            ) : null}

            <div>
              <div className="mb-2 text-sm font-medium">Final Status</div>
              <Select
                value={form.final_status}
                onValueChange={(v) => setForm((prev) => ({ ...prev, final_status: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select final status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DONE">DONE</SelectItem>
                  <SelectItem value="CALLBACK">CALLBACK</SelectItem>
                  <SelectItem value="INVALID">INVALID</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <div className="mb-2 text-sm font-medium">Outcome Group</div>
              <Input
                placeholder="Example: REFUSE / RECALL / FAIL 2 / DUPLICATE"
                value={form.group_name}
                onChange={(e) => setForm((prev) => ({ ...prev, group_name: e.target.value }))}
              />
              <div className="mt-1 text-xs opacity-60">
                This is the main business outcome from <code>call_results.group_name</code>.
              </div>
            </div>

            <div>
              <div className="mb-2 text-sm font-medium">Detail Name (optional)</div>
              <Input
                placeholder="Leave blank to apply to all details in this outcome group"
                value={form.detail_name}
                onChange={(e) => setForm((prev) => ({ ...prev, detail_name: e.target.value }))}
              />
              <div className="mt-1 text-xs opacity-60">
                Use this only when you want a more specific detail-level override.
              </div>
            </div>

            <div>
              <div className="mb-2 text-sm font-medium">Admin Note</div>
              <Input
                placeholder="Example: Counts toward KPI"
                value={form.note}
                onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.is_kpi_eligible}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, is_kpi_eligible: e.target.checked }))
                  }
                />
                Counts toward KPI
              </label>

              <label className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, is_active: e.target.checked }))
                  }
                />
                Active rule
              </label>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void onSave()} disabled={saving || Boolean(duplicateKey)}>
                {saving ? "Saving..." : editingId ? "Update Rule" : "Create Rule"}
              </Button>

              <Button variant="outline" onClick={resetForm} disabled={saving}>
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>KPI Rule List</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-4">
              <Input
                placeholder="Search final status / group / detail / note..."
                value={filter.keyword}
                onChange={(e) =>
                  setFilter((prev) => ({ ...prev, keyword: e.target.value }))
                }
              />

              <Select
                value={filter.finalStatus}
                onValueChange={(v) =>
                  setFilter((prev) => ({
                    ...prev,
                    finalStatus: v as KpiRuleFilter["finalStatus"],
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Final status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Statuses</SelectItem>
                  <SelectItem value="DONE">DONE</SelectItem>
                  <SelectItem value="CALLBACK">CALLBACK</SelectItem>
                  <SelectItem value="INVALID">INVALID</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={filter.eligibilityMode}
                onValueChange={(v) =>
                  setFilter((prev) => ({
                    ...prev,
                    eligibilityMode: v as KpiRuleFilter["eligibilityMode"],
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Eligibility" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Eligibility</SelectItem>
                  <SelectItem value="KPI">KPI Only</SelectItem>
                  <SelectItem value="NON_KPI">Non-KPI Only</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={filter.activeMode}
                onValueChange={(v) =>
                  setFilter((prev) => ({
                    ...prev,
                    activeMode: v as KpiRuleFilter["activeMode"],
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Active mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All States</SelectItem>
                  <SelectItem value="ACTIVE">Active Only</SelectItem>
                  <SelectItem value="INACTIVE">Inactive Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {loading ? (
              <div className="rounded-xl border p-4 text-sm opacity-70">Loading KPI rules...</div>
            ) : filteredRows.length === 0 ? (
              <div className="rounded-xl border p-4 text-sm opacity-70">No KPI rules found.</div>
            ) : (
              <div className="max-h-[760px] space-y-3 overflow-y-auto pr-1">
                {filteredRows.map((row) => (
                  <div key={row.id} className="rounded-xl border p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-sm font-semibold break-words">
                            {row.final_status} · {row.group_name}
                            {row.detail_name ? ` · ${row.detail_name}` : ""}
                          </div>
                          <RuleBadge eligible={row.is_kpi_eligible} />
                          <StatusBadge active={row.is_active} />
                          <ScopeBadge detailName={row.detail_name} />
                        </div>

                        <div className="mt-2 text-sm opacity-80">
                          Detail scope: {row.detail_name || "All details in this outcome group"}
                        </div>

                        <div className="mt-1 text-sm opacity-70">
                          Note: {row.note || "—"}
                        </div>

                        <div className="mt-2 text-xs opacity-60">
                          Updated: {fmtDT(row.updated_at)}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => startEdit(row)}>
                          Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => void onDelete(row.id)}
                          disabled={deletingId === row.id}
                        >
                          {deletingId === row.id ? "Deleting..." : "Delete"}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}