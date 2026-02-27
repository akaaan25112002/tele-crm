"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/status-badge";

function nowIso() {
  return new Date().toISOString();
}
function fmtDT(s?: string | null) {
  if (!s) return "—";
  const d = new Date(s);
  return d.toLocaleString();
}
function msRemainingToText(ms: number) {
  if (ms <= 0) return "expired";
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h ${m}m remaining`;
}

// ===== Types =====
type Contact = {
  id: string;
  external_person_id: string | null;

  company_name: string | null;
  given_name: string | null;
  family_name: string | null;

  telephone_number: string | null;
  mobile_country_code: string | null;
  mobile_number: string | null;
  normalized_phone: string | null;

  job_title: string | null;
  department: string | null;
  email: string | null;

  address_line1: string | null;
  address_line2: string | null;
  address_line3: string | null;
  city_ward: string | null;
  state: string | null;
  country: string | null;

  current_status: string;
  call_attempts: number;
  last_called_at: string | null;

  last_result_id: string | null;
  last_note_text: string | null;

  assigned_at?: string | null;
  lease_expires_at?: string | null;

  // effective fields (optional)
  given_name_effective?: string | null;
  family_name_effective?: string | null;
  company_name_effective?: string | null;
  email_effective?: string | null;
  telephone_number_effective?: string | null;
  mobile_country_code_effective?: string | null;
  mobile_number_effective?: string | null;
  address_line1_effective?: string | null;
  address_line2_effective?: string | null;
  address_line3_effective?: string | null;
  city_ward_effective?: string | null;
  state_effective?: string | null;
  country_effective?: string | null;
};

type FinalStatus = "DONE" | "INVALID" | "CALLBACK" | "NEW" | "ASSIGNED" | string;

type CallResult = {
  id: string;
  group_name: string;
  detail_name: string;
  sort_order: number;
  final_status: FinalStatus;
  is_terminal: boolean;
};

type Draft = { note1: string; note2Id: string; noteText: string };

type EditFieldKey =
  | "given_name"
  | "family_name"
  | "company_name"
  | "email"
  | "telephone_number"
  | "mobile_country_code"
  | "mobile_number"
  | "job_title"
  | "department"
  | "address_line1"
  | "address_line2"
  | "address_line3"
  | "city_ward"
  | "state"
  | "country";

type EditField = { key: EditFieldKey; label: string };

const EDIT_FIELDS: EditField[] = [
  { key: "given_name", label: "Given name" },
  { key: "family_name", label: "Family name" },
  { key: "company_name", label: "Company name" },
  { key: "email", label: "Email" },
  { key: "telephone_number", label: "Telephone number" },
  { key: "mobile_country_code", label: "Mobile CC" },
  { key: "mobile_number", label: "Mobile number" },
  { key: "job_title", label: "Job title" },
  { key: "department", label: "Department" },
  { key: "address_line1", label: "Address line 1" },
  { key: "address_line2", label: "Address line 2" },
  { key: "address_line3", label: "Address line 3" },
  { key: "city_ward", label: "City/Ward" },
  { key: "state", label: "State" },
  { key: "country", label: "Country" },
];

function getEffective(c: Contact, key: EditFieldKey): string {
  const effKey = `${key}_effective` as keyof Contact;
  const eff = (c as any)[effKey];
  const raw = (c as any)[key];
  return String((eff ?? raw ?? "") as any);
}

function isTypingTarget(el: EventTarget | null) {
  const t = el as HTMLElement | null;
  if (!t) return false;
  const tag = (t.tagName || "").toLowerCase();
  // shadcn Select uses button; we consider input/textarea/contenteditable as typing.
  if (tag === "input" || tag === "textarea") return true;
  if (t.isContentEditable) return true;
  return false;
}

// ===== Draft persistence =====
const LS_KEY = "tele_drafts_v1";
function loadDraftStore(): Record<string, Draft> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch {
    return {};
  }
}
function saveDraftStore(store: Record<string, Draft>) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(store));
  } catch {}
}

function finalStatusBadge(fs?: FinalStatus | null) {
  if (!fs) return null;
  const text = String(fs);
  // keep styling simple but clear
  if (text === "DONE") return <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">DONE</Badge>;
  if (text === "INVALID") return <Badge className="bg-rose-600 text-white hover:bg-rose-600">INVALID</Badge>;
  if (text === "CALLBACK") return <Badge className="bg-amber-500 text-black hover:bg-amber-500">CALLBACK</Badge>;
  return <Badge>{text}</Badge>;
}

export default function TeleWorkspacePage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const [note1Options, setNote1Options] = useState<string[]>([]);
  const [note2Options, setNote2Options] = useState<CallResult[]>([]);
  const [note1, setNote1] = useState("");
  const [note2, setNote2] = useState(""); // uuid
  const [noteText, setNoteText] = useState("");

  const [busy, setBusy] = useState(false);
  const [topMsg, setTopMsg] = useState<string | null>(null);

  const [draftById, setDraftById] = useState<Record<string, Draft>>({});
  const [resultMap, setResultMap] = useState<Record<string, { group: string; detail: string; final_status?: FinalStatus }>>(
    {}
  );

  // Quick edit
  const [editField, setEditField] = useState<EditFieldKey>("email");
  const [editValue, setEditValue] = useState("");
  const [recentEdits, setRecentEdits] = useState<
    Array<{ field_name: string; old_value: string | null; new_value: string; edited_at: string }>
  >([]);

  // Search
  const [q, setQ] = useState("");

  const debounceTimer = useRef<any>(null);

  const active = useMemo(() => contacts.find((c) => c.id === activeId) ?? null, [contacts, activeId]);

  const leaseValid = useMemo(() => {
    if (!active?.lease_expires_at) return false;
    return new Date(active.lease_expires_at).getTime() > Date.now();
  }, [active?.lease_expires_at]);

  const leaseRemainingText = useMemo(() => {
    if (!active?.lease_expires_at) return "—";
    const ms = new Date(active.lease_expires_at).getTime() - Date.now();
    return msRemainingToText(ms);
  }, [active?.lease_expires_at]);

  const filteredContacts = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return contacts;

    return contacts.filter((c) => {
      const gn = (c.given_name_effective ?? c.given_name ?? "").toLowerCase();
      const fn = (c.family_name_effective ?? c.family_name ?? "").toLowerCase();
      const cp = (c.company_name_effective ?? c.company_name ?? "").toLowerCase();
      const tel = (c.telephone_number_effective ?? c.telephone_number ?? "").toLowerCase();
      const mob = (c.normalized_phone ?? "").toLowerCase();
      const em = (c.email_effective ?? c.email ?? "").toLowerCase();
      const pid = (c.external_person_id ?? "").toLowerCase();
      return (
        gn.includes(s) ||
        fn.includes(s) ||
        cp.includes(s) ||
        tel.includes(s) ||
        mob.includes(s) ||
        em.includes(s) ||
        pid.includes(s)
      );
    });
  }, [contacts, q]);

  const updateDraftState = (contactId: string, patch: Partial<Draft>) => {
    setDraftById((m) => {
      const prev = m[contactId] ?? { note1: "", note2Id: "", noteText: "" };
      const next = { ...m, [contactId]: { ...prev, ...patch } };
      return next;
    });
  };

  // autosave drafts (debounce 300ms)
  const scheduleDraftSave = (nextStore: Record<string, Draft>) => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      saveDraftStore(nextStore);
    }, 300);
  };

  const loadMeta = async () => {
    const [{ data: gData }, { data: rData }] = await Promise.all([
      supabase.from("v_call_result_groups").select("group_name"),
      supabase.from("call_results").select("id,group_name,detail_name,final_status").eq("is_active", true),
    ]);

    setNote1Options(((gData as any[]) ?? []).map((x) => String(x.group_name)));

    const m: Record<string, { group: string; detail: string; final_status?: FinalStatus }> = {};
    ((rData as any[]) ?? []).forEach((r) => {
      m[String(r.id)] = {
        group: String(r.group_name),
        detail: String(r.detail_name),
        final_status: String(r.final_status) as any,
      };
    });
    setResultMap(m);
  };

  const loadQueue = async () => {
    setTopMsg(null);

    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user.id;
    if (!uid) {
      setContacts([]);
      setActiveId(null);
      setTopMsg("Not authenticated");
      return;
    }

    // IMPORTANT: cap UI to 100 too (backend cap is the real protection)
    const { data, error } = await supabase
      .from("v_contacts_effective")
      .select(
        [
          "id",
          "external_person_id",
          "company_name",
          "given_name",
          "family_name",
          "telephone_number",
          "mobile_country_code",
          "mobile_number",
          "normalized_phone",
          "email",
          "job_title",
          "department",
          "address_line1",
          "address_line2",
          "address_line3",
          "city_ward",
          "state",
          "country",
          "current_status",
          "call_attempts",
          "last_called_at",
          "last_result_id",
          "last_note_text",
          "assigned_at",
          "lease_expires_at",

          "given_name_effective",
          "family_name_effective",
          "company_name_effective",
          "email_effective",
          "telephone_number_effective",
          "mobile_country_code_effective",
          "mobile_number_effective",
          "address_line1_effective",
          "address_line2_effective",
          "address_line3_effective",
          "city_ward_effective",
          "state_effective",
          "country_effective",
        ].join(",")
      )
      .eq("assigned_to", uid)
      .gt("lease_expires_at", nowIso())
      .order("assigned_at", { ascending: true })
      .limit(100);

    if (error) {
      console.error(error);
      setTopMsg(error.message);
      setContacts([]);
      setActiveId(null);
      return;
    }

    const rows = ((data as any[]) ?? []) as Contact[];
    setContacts(rows);

    if (!rows.length) {
      setActiveId(null);
      return;
    }

    setActiveId((prev) => {
      if (!prev) return rows[0].id;
      if (!rows.find((x) => x.id === prev)) return rows[0].id;
      return prev;
    });
  };

  const loadRecentEdits = async (contactId: string) => {
    const { data, error } = await supabase
      .from("contact_edits")
      .select("field_name,old_value,new_value,edited_at")
      .eq("contact_id", contactId)
      .order("edited_at", { ascending: false })
      .limit(5);

    if (error) {
      console.error(error);
      setRecentEdits([]);
      return;
    }

    setRecentEdits(
      ((data as any[]) ?? []).map((x) => ({
        field_name: String(x.field_name),
        old_value: x.old_value ? String(x.old_value) : null,
        new_value: String(x.new_value),
        edited_at: String(x.edited_at),
      }))
    );
  };

  // init: load drafts from localStorage, meta, queue
  useEffect(() => {
    const store = loadDraftStore();
    setDraftById(store);

    (async () => {
      await loadMeta();
      await loadQueue();
    })();

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // hotkeys: Ctrl+Enter submit, ArrowUp/Down change contact (only if not typing)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const typing = isTypingTarget(e.target);

      // Ctrl+Enter submit (allow even when typing in textarea)
      if (e.ctrlKey && e.key === "Enter") {
        e.preventDefault();
        void submitCall();
        return;
      }

      // change contact only when NOT typing
      if (typing) return;

      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        if (!filteredContacts.length) return;
        const idx = filteredContacts.findIndex((x) => x.id === activeId);
        const nextIdx =
          e.key === "ArrowDown"
            ? Math.min(filteredContacts.length - 1, (idx < 0 ? 0 : idx) + 1)
            : Math.max(0, (idx < 0 ? 0 : idx) - 1);

        const next = filteredContacts[nextIdx];
        if (next) setActiveId(next.id);
      }
    };

    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true } as any);
  }, [activeId, filteredContacts]);

  // when note1 changes -> load note2 options + auto pick (general)
  useEffect(() => {
    if (!activeId) return;

    if (!note1) {
      setNote2Options([]);
      setNote2("");
      updateDraftState(activeId, { note2Id: "" });
      return;
    }

    (async () => {
      const { data, error } = await supabase
        .from("call_results")
        .select("id,group_name,detail_name,sort_order,final_status,is_terminal")
        .eq("group_name", note1)
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (error) {
        console.error(error);
        setNote2Options([]);
        setNote2("");
        updateDraftState(activeId, { note2Id: "" });
        return;
      }

      const rows = ((data as any[]) ?? []) as CallResult[];
      setNote2Options(rows);

      const general = rows.find((x) => x.detail_name?.trim().toLowerCase() === "(general)");
      const chosen = general?.id ?? rows[0]?.id ?? "";
      setNote2(chosen);
      updateDraftState(activeId, { note2Id: chosen });

      // autosave store
      const nextStore = { ...draftById, [activeId]: { note1, note2Id: chosen, noteText } };
      scheduleDraftSave(nextStore);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note1]);

  // when active changes -> restore draft + recent edits + prefill edit value
  useEffect(() => {
    if (!active) return;

    const d = draftById[active.id];
    if (d) {
      setNote1(d.note1);
      setNote2(d.note2Id);
      setNoteText(d.noteText);
    } else {
      setNote1("");
      setNote2("");
      setNoteText("");
    }

    setEditValue(getEffective(active, editField));
    void loadRecentEdits(active.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  useEffect(() => {
    if (!active) return;
    setEditValue(getEffective(active, editField));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editField]);

  // keep localStorage autosave when draftById changes
  useEffect(() => {
    scheduleDraftSave(draftById);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftById]);

  const submitCall = async () => {
    if (!active) return;
    if (!leaseValid) return alert("Lease expired. Please refresh queue and pull again.");
    if (!note1) return alert("Please choose Note 1");
    if (!note2) return alert("No Note 2 available. Ask admin to seed call_results (including (general)).");

    setBusy(true);
    setTopMsg(null);

    try {
      const { error } = await supabase.rpc("rpc_submit_call", {
        p_contact_id: active.id,
        p_result_id: note2,
        p_note_text: noteText || null,
        p_called_at: new Date().toISOString(),
        p_next_call_at: null,
      });
      if (error) throw error;

      // clear noteText only (keep note1/note2)
      setNoteText("");
      updateDraftState(active.id, { noteText: "" });

      await loadQueue();
    } catch (e: any) {
      const m = e?.message ?? "Submit failed";
      setTopMsg(m);
      alert(m);
      if (String(m).toLowerCase().includes("lease") || String(m).toLowerCase().includes("owner")) {
        await loadQueue();
      }
    } finally {
      setBusy(false);
    }
  };

  const applyEdit = async () => {
    if (!active) return;
    if (!leaseValid) return alert("Lease expired. Cannot edit this contact.");
    const v = editValue.trim();
    if (!v) return alert("New value is required");

    setBusy(true);
    setTopMsg(null);

    try {
      const { error } = await supabase.rpc("rpc_contact_edit", {
        p_contact_id: active.id,
        p_field_name: editField,
        p_new_value: v,
      });
      if (error) throw error;

      await Promise.all([loadQueue(), loadRecentEdits(active.id)]);
    } catch (e: any) {
      const m = e?.message ?? "Edit failed";
      setTopMsg(m);
      alert(m);
    } finally {
      setBusy(false);
    }
  };

  const displayName = useMemo(() => {
    if (!active) return "—";
    const gn = active.given_name_effective ?? active.given_name;
    const fn = active.family_name_effective ?? active.family_name;
    const name = [gn, fn].filter(Boolean).join(" ").trim();
    return name || (active.company_name_effective ?? active.company_name) || "—";
  }, [active]);

  const selectedNote2 = useMemo(() => note2Options.find((x) => x.id === note2) ?? null, [note2Options, note2]);
  const selectedFinalStatus = (selectedNote2?.final_status ?? null) as FinalStatus | null;

  // ===== FIX SCROLL / ROLLING =====
  // Lock workspace height and let queue/panel scroll internally.
  const shellOffset = "120px"; // adjust if your AppShell header differs
  const rootClass = `h-[calc(100vh-${shellOffset})] overflow-hidden`;

  return (
    <div className={rootClass}>
      <div className="h-full flex flex-col gap-3">
        {topMsg && <div className="text-sm text-red-600 whitespace-pre-wrap">{topMsg}</div>}

        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Queue */}
          <Card className="md:col-span-1 flex flex-col min-h-0">
            <CardHeader className="flex flex-col gap-3">
              <div className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">
                  My Queue <span className="text-xs opacity-60">({contacts.length}/100)</span>
                </CardTitle>
                <Button variant="outline" size="sm" onClick={loadQueue} disabled={busy}>
                  Refresh
                </Button>
              </div>

              <Input
                placeholder="Search name / phone / email / person_id..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />

              <div className="text-xs opacity-60">
                Hotkeys: <span className="font-medium">Ctrl+Enter</span> submit •{" "}
                <span className="font-medium">↑/↓</span> change contact (when not typing)
              </div>
            </CardHeader>

            <CardContent className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-2">
              {filteredContacts.map((c) => {
                const gn = c.given_name_effective ?? c.given_name;
                const fn = c.family_name_effective ?? c.family_name;
                const name =
                  [gn, fn].filter(Boolean).join(" ").trim() ||
                  (c.company_name_effective ?? c.company_name) ||
                  "(No name)";

                const isActive = c.id === activeId;

                const ms = c.lease_expires_at ? new Date(c.lease_expires_at).getTime() - Date.now() : 0;
                const leaseText = msRemainingToText(ms);

                return (
                  <button
                    key={c.id}
                    onClick={() => setActiveId(c.id)}
                    className={`w-full text-left rounded-lg p-3 border transition ${
                      isActive ? "border-primary" : "border-border hover:border-muted-foreground"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium line-clamp-1">{name}</div>
                      <StatusBadge status={c.current_status} kind="contact" />
                    </div>

                    <div className="text-xs opacity-70 mt-1">Tel: {c.telephone_number_effective ?? c.telephone_number ?? "—"}</div>
                    <div className="text-xs opacity-70 mt-1">• Mobile: {c.normalized_phone ?? "—"}</div>
                    <div className="text-xs opacity-70 mt-1">• attempts: {c.call_attempts ?? 0}</div>
                    <div className="text-xs opacity-70 mt-1">Lease: {leaseText}</div>
                  </button>
                );
              })}

              {!filteredContacts.length && (
                <div className="text-sm opacity-70">
                  {contacts.length ? "No results." : "No assigned contacts (or lease expired). Go to a campaign and Pull more."}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Call panel */}
          <Card className="md:col-span-2 flex flex-col min-h-0">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Call Panel</CardTitle>
              <div className="text-xs opacity-70">
                Lease: <span className={!leaseValid && active ? "text-red-600 font-medium" : "font-medium"}>{leaseRemainingText}</span>
              </div>
            </CardHeader>

            <CardContent className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-2">
              {!active ? (
                <div className="text-sm opacity-70">Select a contact from queue.</div>
              ) : (
                <>
                  {/* Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg border">
                      <div className="text-xs opacity-70 mt-2">Person ID</div>
                      <div className="font-semibold text-sm">{active.external_person_id ?? "—"}</div>

                      <div className="text-xs opacity-70 mt-2">Company name</div>
                      <div className="font-semibold">{active.company_name_effective ?? active.company_name ?? "—"}</div>

                      <div className="text-xs opacity-70 mt-2">Customer Name</div>
                      <div className="font-semibold">{displayName}</div>

                      <div className="text-xs opacity-70 mt-2">Telephone number</div>
                      <div className="font-semibold">{active.telephone_number_effective ?? active.telephone_number ?? "—"}</div>

                      <div className="text-xs opacity-70 mt-2">Mobile number</div>
                      <div className="font-semibold">
                        {(active.mobile_country_code_effective ?? active.mobile_country_code ?? "")}
                        {(active.mobile_number_effective ?? active.mobile_number ?? "") || "—"}
                      </div>

                      <div className="text-xs opacity-70 mt-2">Email</div>
                      <div className="font-semibold text-sm">{active.email_effective ?? active.email ?? "—"}</div>

                      <div className="text-xs opacity-70 mt-2">Address</div>
                      <div className="font-semibold text-sm">{active.address_line1_effective ?? active.address_line1 ?? "—"}</div>
                    </div>

                    <div className="p-3 rounded-lg border space-y-2">
                      <div className="text-xs opacity-70">Status</div>
                      <div className="flex gap-2 items-center">
                        <Badge>{active.current_status}</Badge>
                        <div className="text-xs opacity-70">Attempts: {active.call_attempts}</div>
                      </div>

                      <div className="text-xs opacity-70">Lease</div>
                      <div className="text-sm">
                        {fmtDT(active.lease_expires_at)}
                        {!leaseValid && <span className="ml-2 text-red-600">(expired)</span>}
                      </div>

                      <div className="text-xs opacity-70">Last called</div>
                      <div className="text-sm">{fmtDT(active.last_called_at)}</div>

                      <div className="text-xs opacity-70 mt-3">Previous result</div>
                      <div className="text-sm">
                        {active.last_result_id && resultMap[active.last_result_id] ? (
                          <span className="font-medium">
                            {resultMap[active.last_result_id].group} / {resultMap[active.last_result_id].detail}
                          </span>
                        ) : (
                          "—"
                        )}
                      </div>

                      <div className="text-xs opacity-70 mt-2">Previous note</div>
                      <div className="text-sm whitespace-pre-wrap">{active.last_note_text ?? "—"}</div>
                    </div>
                  </div>

                  {/* Agent Edit */}
                  <div className="rounded-lg border p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="font-medium">Agent Edit (log-only)</div>
                      <div className="text-xs opacity-60">Export will show edited_* columns</div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <div className="text-xs opacity-70">Field</div>
                        <Select value={editField} onValueChange={(v) => setEditField(v as any)} disabled={busy || !leaseValid}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select field" />
                          </SelectTrigger>
                          <SelectContent>
                            {EDIT_FIELDS.map((f) => (
                              <SelectItem key={f.key} value={f.key}>
                                {f.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1 md:col-span-2">
                        <div className="text-xs opacity-70">New value</div>
                        <div className="flex gap-2">
                          <Input
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            disabled={busy || !leaseValid}
                            placeholder="Type new value..."
                          />
                          <Button onClick={applyEdit} disabled={busy || !leaseValid}>
                            {busy ? "Saving..." : "Apply"}
                          </Button>
                        </div>
                        <div className="text-xs opacity-60">
                          Current (effective):{" "}
                          <span className="font-medium">{getEffective(active, editField) || "—"}</span>
                        </div>
                      </div>
                    </div>

                    {recentEdits.length > 0 && (
                      <div className="pt-2 border-t">
                        <div className="text-xs font-medium mb-2">Recent edits</div>
                        <div className="space-y-1">
                          {recentEdits.map((x, i) => (
                            <div key={i} className="text-xs opacity-80">
                              <span className="font-medium">{x.field_name}</span>:{" "}
                              <span className="opacity-60">{x.old_value ?? "—"}</span> →{" "}
                              <span className="font-medium">{x.new_value}</span>{" "}
                              <span className="opacity-60">({fmtDT(x.edited_at)})</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Call Result */}
                  <div className="rounded-lg border p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="font-medium">Call Result</div>
                      <div className="flex items-center gap-2 text-xs opacity-70">
                        <span>Final status:</span>
                        {finalStatusBadge(selectedFinalStatus)}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <div className="text-sm font-medium">Note 1</div>
                        <Select
                          value={note1}
                          onValueChange={(v) => {
                            setNote1(v);
                            setNote2("");
                            updateDraftState(active.id, { note1: v, note2Id: "" });
                          }}
                          disabled={busy || !leaseValid}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select Note 1" />
                          </SelectTrigger>
                          <SelectContent>
                            {note1Options.map((g) => (
                              <SelectItem key={g} value={g}>
                                {g}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <div className="text-sm font-medium">Note 2</div>
                        <Select
                          value={note2}
                          onValueChange={(v) => {
                            setNote2(v);
                            updateDraftState(active.id, { note2Id: v });
                          }}
                          disabled={busy || !leaseValid || !note1 || note2Options.length === 0}
                        >
                          <SelectTrigger>
                            <SelectValue
                              placeholder={
                                !note1
                                  ? "Choose Note 1 first"
                                  : note2Options.length === 0
                                  ? "No Note 2 (admin must seed)"
                                  : "Select Note 2"
                              }
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {note2Options.map((d) => (
                              <SelectItem key={d.id} value={d.id}>
                                {d.detail_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <div className="text-xs opacity-60">
                          Auto-pick: prefers <span className="font-medium">(general)</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="text-sm font-medium">Other note</div>
                      <Textarea
                        placeholder="Detail note..."
                        value={noteText}
                        onChange={(e) => {
                          const v = e.target.value;
                          setNoteText(v);
                          updateDraftState(active.id, { noteText: v, note1, note2Id: note2 });
                        }}
                        rows={3}
                        disabled={busy || !leaseValid}
                      />
                      <div className="text-xs opacity-60">Auto-save draft: enabled (debounce 300ms). Shortcut: Ctrl+Enter to submit.</div>
                    </div>

                    <div className="flex items-center justify-end gap-2">
                      <Button variant="outline" onClick={loadQueue} disabled={busy}>
                        Refresh
                      </Button>
                      <Button onClick={submitCall} disabled={busy || !leaseValid || !note1 || !note2}>
                        {busy ? "Saving..." : "Submit call"}
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}