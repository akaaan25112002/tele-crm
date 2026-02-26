"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/status-badge";

/** (tạm) normalize giống importer */
function normalizeVNPhone(input?: string | null) {
  if (!input) return null;
  let s = String(input).trim();
  if (!s) return null;
  s = s.replace(/[^\d+]/g, "");
  if (s.startsWith("+84")) s = "0" + s.slice(3);
  if (s.startsWith("84") && s.length >= 10) s = "0" + s.slice(2);
  s = s.replace(/^0+/, "0");
  if (s === "0") return null;
  return s;
}
function buildNormalizedPhone(tel?: string, cc?: string, mobile?: string) {
  const merged = `${cc ?? ""}${mobile ?? ""}`;
  const m = normalizeVNPhone(merged);
  if (m && m.length >= 9) return m;
  const t = normalizeVNPhone(tel ?? "");
  return t;
}

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
};

type CallResult = { id: string; group_name: string; detail_name: string; sort_order: number };

// ✅ draft note theo contact
type Draft = { note1: string; note2Id: string; noteText: string };

// helper: pick default note2 id from options
function pickDefaultNote2Id(rows: CallResult[]) {
  const general = rows.find((x) => x.detail_name?.trim().toLowerCase() === "(general)");
  return (general?.id ?? rows[0]?.id ?? "");
}

export default function TeleWorkspacePage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const [note1Options, setNote1Options] = useState<string[]>([]);
  const [note2Options, setNote2Options] = useState<CallResult[]>([]);

  const [note1, setNote1] = useState("");
  // ✅ note2 = result_id
  const [note2, setNote2] = useState("");
  const [noteText, setNoteText] = useState("");

  const [busy, setBusy] = useState(false);

  // previous note display
  const [prevNote1, setPrevNote1] = useState<string | null>(null);
  const [prevNote2, setPrevNote2] = useState<string | null>(null);
  const [prevOther, setPrevOther] = useState<string | null>(null);

  // draft theo contact id
  const [draftById, setDraftById] = useState<Record<string, Draft>>({});

  // edit dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [edit, setEdit] = useState<Partial<Contact>>({});

  const active = useMemo(
    () => contacts.find((c) => c.id === activeId) ?? null,
    [contacts, activeId]
  );

  const mobileDisplay = useMemo(() => {
    if (!active) return "—";
    const cc = (active.mobile_country_code ?? "").trim();
    const num = (active.mobile_number ?? "").trim();
    if (!cc && !num) return "—";
    return `${cc}${num}` || "—";
  }, [active]);

  const loadQueue = async () => {
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user.id;
    if (!uid) return;

    const { data, error } = await supabase
      .from("contacts")
      .select(
        "id,external_person_id,company_name,given_name,family_name,telephone_number,mobile_country_code,mobile_number,normalized_phone,email,job_title,department,address_line1,address_line2,address_line3,city_ward,state,country,current_status,call_attempts,last_called_at,last_result_id,last_note_text,assigned_at"
      )
      .eq("assigned_to", uid)
      .order("assigned_at", { ascending: true });

    if (!error) {
      const rows = ((data as any[]) ?? []) as Contact[];
      setContacts(rows);
      if (!activeId && rows.length) setActiveId(rows[0].id);
      if (activeId && rows.length && !rows.find((x) => x.id === activeId)) setActiveId(rows[0].id);
    }
  };

  // load note1 groups
  useEffect(() => {
    supabase
      .from("v_call_result_groups")
      .select("group_name")
      .then(({ data }) => setNote1Options(((data as any[]) ?? []).map((x) => x.group_name)));

    loadQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // update draft helper
  const updateDraft = (patch: Partial<Draft>, idOverride?: string) => {
    const id = idOverride ?? activeId;
    if (!id) return;
    setDraftById((m) => {
      const prev = m[id] ?? { note1: "", note2Id: "", noteText: "" };
      return { ...m, [id]: { ...prev, ...patch } };
    });
  };

  // when choose Note1 -> load Note2 options + auto pick default
  useEffect(() => {
    if (!note1) {
      setNote2Options([]);
      setNote2("");
      updateDraft({ note2Id: "" });
      return;
    }

    supabase
      .from("call_results")
      .select("id,group_name,detail_name,sort_order")
      .eq("group_name", note1)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          setNote2Options([]);
          setNote2("");
          updateDraft({ note2Id: "" });
          return;
        }

        let rows = ((data as any[]) ?? []) as CallResult[];

        // ✅ đảm bảo luôn có (general) trong dropdown
        const hasGeneral = rows.some(
          (x) => x.detail_name?.trim().toLowerCase() === "(general)"
        );

        if (!hasGeneral) {
          // UI-only general (không cần DB)
          rows = [
            {
              id: "__general__",
              group_name: note1,
              detail_name: "(general)",
              sort_order: -999,
            },
            ...rows,
          ];
        }

        setNote2Options(rows);

        // ✅ nếu chưa chọn note2 hoặc note2 hiện tại không tồn tại nữa -> auto pick default
        const stillValid = rows.some((x) => x.id === note2);
        if (!note2 || !stillValid) {
          const defId = pickDefaultNote2Id(rows);
          setNote2(defId === "__general__" ? "" : defId);
          updateDraft({ note2Id: defId === "__general__" ? "" : defId });
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note1]);

  // when active contact changes: load draft per-contact + show previous note + prefill from history
  useEffect(() => {
    if (!active) return;

    setPrevOther(active.last_note_text ?? null);

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

    // load history result label
    if (!active.last_result_id) {
      setPrevNote1(null);
      setPrevNote2(null);
      return;
    }

    (async () => {
      const { data: cr } = await supabase
        .from("call_results")
        .select("id,group_name,detail_name")
        .eq("id", active.last_result_id!)
        .single();

      if (cr) {
        setPrevNote1(cr.group_name);
        setPrevNote2(cr.detail_name);

        // if no draft -> prefill from history
        if (!d) {
          setNote1(cr.group_name);
          setNote2(cr.id);
          setNoteText("");

          updateDraft({ note1: cr.group_name, note2Id: cr.id, noteText: "" }, active.id);
        }
      } else {
        setPrevNote1(null);
        setPrevNote2(null);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  const submit = async () => {
    if (!active) return;
    if (!note1) return alert("Please choose Note 1");
    if (!note2) return alert("Missing Note 2 default. Please seed (general) for this Note 1.");

    setBusy(true);
    const { error } = await supabase.rpc("rpc_submit_call", {
      p_contact_id: active.id,
      p_result_id: note2, // ✅ always UUID
      p_note_text: noteText || null,
      p_called_at: new Date().toISOString(),
      p_next_call_at: null,
    });
    setBusy(false);

    if (error) return alert(error.message);

    // keep note1/note2, clear only note text for quick next action
    setNoteText("");
    updateDraft({ noteText: "" });

    await loadQueue();
  };

  const openEdit = () => {
    if (!active) return;
    setEdit({
      given_name: active.given_name,
      family_name: active.family_name,
      company_name: active.company_name,
      email: active.email,
      job_title: active.job_title,
      department: active.department,

      telephone_number: active.telephone_number,
      mobile_country_code: active.mobile_country_code,
      mobile_number: active.mobile_number,

      address_line1: active.address_line1,
      address_line2: active.address_line2,
      address_line3: active.address_line3,
      city_ward: active.city_ward,
      state: active.state,
      country: active.country,
    });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!active) return;

    const normalized_phone = buildNormalizedPhone(
      (edit.telephone_number as string) ?? "",
      (edit.mobile_country_code as string) ?? "",
      (edit.mobile_number as string) ?? ""
    );

    setBusy(true);
    const { error } = await supabase
      .from("contacts")
      .update({
        given_name: edit.given_name ?? null,
        family_name: edit.family_name ?? null,
        company_name: edit.company_name ?? null,
        email: edit.email ?? null,
        job_title: edit.job_title ?? null,
        department: edit.department ?? null,

        telephone_number: edit.telephone_number ?? null,
        mobile_country_code: edit.mobile_country_code ?? null,
        mobile_number: edit.mobile_number ?? null,
        normalized_phone,

        address_line1: edit.address_line1 ?? null,
        address_line2: edit.address_line2 ?? null,
        address_line3: edit.address_line3 ?? null,
        city_ward: edit.city_ward ?? null,
        state: edit.state ?? null,
        country: edit.country ?? null,
      })
      .eq("id", active.id);

    setBusy(false);
    if (error) return alert(error.message);

    setEditOpen(false);
    await loadQueue();
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Queue */}
      <Card className="md:col-span-1">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">My Queue</CardTitle>
          <Button variant="outline" size="sm" onClick={loadQueue} disabled={busy}>
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {contacts.map((c) => {
            const name =
              [c.given_name, c.family_name].filter(Boolean).join(" ").trim() ||
              c.company_name ||
              "(No name)";
            const isActive = c.id === activeId;

            const mobile =
              (c.mobile_country_code ?? "").trim() || (c.mobile_number ?? "").trim()
                ? `${c.mobile_country_code ?? ""}${c.mobile_number ?? ""}`
                : "—";

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
                  <StatusBadge status={c.current_status} />
                </div>

                <div className="text-xs opacity-70 mt-1">
                  Tel: {c.telephone_number ?? "—"} • Mobile: {mobile}
                </div>

                <div className="text-xs opacity-70 mt-1">
                  Normalized: {c.normalized_phone ?? "—"} • attempts: {c.call_attempts}
                </div>
              </button>
            );
          })}
          {!contacts.length && (
            <div className="text-sm opacity-70">No assigned contacts. Go to a campaign and Pull more.</div>
          )}
        </CardContent>
      </Card>

      {/* Call panel */}
      <Card className="md:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Call Panel</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" onClick={openEdit} disabled={!active || busy}>
              Edit contact
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {!active ? (
            <div className="text-sm opacity-70">Select a contact from queue.</div>
          ) : (
            <>
              {/* Info + Previous note */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3 rounded-lg border">
                  <div className="text-xs opacity-70 mt-2">Person ID</div>
                  <div className="font-semibold text-sm">{active.external_person_id ?? "—"}</div>

                  <div className="text-xs opacity-70 mt-2">Company name</div>
                  <div className="font-semibold">{active.company_name ?? "—"}</div>

                  <div className="text-xs opacity-70 mt-2">Customer Name</div>
                  <div className="font-semibold">
                    {[active.given_name, active.family_name].filter(Boolean).join(" ").trim() ||
                      active.company_name ||
                      "—"}
                  </div>

                  <div className="text-xs opacity-70 mt-2">Telephone number</div>
                  <div className="font-semibold">{active.telephone_number ?? "—"}</div>

                  <div className="text-xs opacity-70 mt-2">Mobile number</div>
                  <div className="font-semibold">{active.normalized_phone ?? "—"}</div>

                  <div className="text-xs opacity-70 mt-2">Email</div>
                  <div className="font-semibold text-sm">{active.email ?? "—"}</div>

                  <div className="text-xs opacity-70 mt-2">Adress</div>
                  <div className="font-semibold text-sm">{active.address_line1 ?? "—"}</div>
                </div>

                <div className="p-3 rounded-lg border space-y-2">
                  <div className="text-xs opacity-70">Status</div>
                  <div className="flex gap-2 items-center">
                    <Badge>{active.current_status}</Badge>
                    <div className="text-xs opacity-70">Attempts: {active.call_attempts}</div>
                  </div>

                  <div className="text-xs opacity-70">Last called</div>
                  <div className="text-sm">
                    {active.last_called_at ? new Date(active.last_called_at).toLocaleString() : "—"}
                  </div>

                  <div className="text-xs opacity-70 mt-3">Previous result</div>
                  <div className="text-sm">
                    {prevNote1 && prevNote2 ? (
                      <span className="font-medium">
                        {prevNote1} / {prevNote2}
                      </span>
                    ) : (
                      "—"
                    )}
                  </div>
                  <div className="text-xs opacity-70 mt-2">Previous note</div>
                  <div className="text-sm whitespace-pre-wrap">{prevOther ?? "—"}</div>
                </div>
              </div>

              {/* Notes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <div className="text-sm font-medium">Note 1</div>
                  <Select
                    value={note1}
                    onValueChange={(v) => {
                      setNote1(v);
                      // reset tạm: note2 sẽ được auto pick khi fetch xong
                      setNote2("");
                      updateDraft({ note1: v, note2Id: "" });
                    }}
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
                    value={note2 || undefined}
                    onValueChange={(v) => {
                      setNote2(v);
                      updateDraft({ note2Id: v });
                    }}
                    disabled={!note1 || note2Options.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={!note1 ? "Choose Note 1 first" : "Select Note 2"} />
                    </SelectTrigger>
                    <SelectContent>
                      {note2Options.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.detail_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                    updateDraft({ noteText: v });
                  }}
                  rows={3}
                />
              </div>

              <div className="flex items-center justify-end gap-2">
                <Button onClick={submit} disabled={busy || !note1 || !note2}>
                  {busy ? "Saving..." : "Submit call"}
                </Button>
              </div>

              {/* Edit dialog */}
              <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Edit contact info</DialogTitle>
                  </DialogHeader>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Input
                      placeholder="Given name"
                      value={(edit.given_name as string) ?? ""}
                      onChange={(e) => setEdit((s) => ({ ...s, given_name: e.target.value }))}
                    />
                    <Input
                      placeholder="Family name"
                      value={(edit.family_name as string) ?? ""}
                      onChange={(e) => setEdit((s) => ({ ...s, family_name: e.target.value }))}
                    />

                    <Input
                      placeholder="Company"
                      value={(edit.company_name as string) ?? ""}
                      onChange={(e) => setEdit((s) => ({ ...s, company_name: e.target.value }))}
                    />
                    <Input
                      placeholder="Email"
                      value={(edit.email as string) ?? ""}
                      onChange={(e) => setEdit((s) => ({ ...s, email: e.target.value }))}
                    />

                    <Input
                      placeholder="Telephone Number"
                      value={(edit.telephone_number as string) ?? ""}
                      onChange={(e) => setEdit((s) => ({ ...s, telephone_number: e.target.value }))}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        placeholder="Mobile CC"
                        value={(edit.mobile_country_code as string) ?? ""}
                        onChange={(e) => setEdit((s) => ({ ...s, mobile_country_code: e.target.value }))}
                      />
                      <Input
                        placeholder="Mobile Number"
                        value={(edit.mobile_number as string) ?? ""}
                        onChange={(e) => setEdit((s) => ({ ...s, mobile_number: e.target.value }))}
                      />
                    </div>

                    <Input
                      placeholder="Job title"
                      value={(edit.job_title as string) ?? ""}
                      onChange={(e) => setEdit((s) => ({ ...s, job_title: e.target.value }))}
                    />
                    <Input
                      placeholder="Department"
                      value={(edit.department as string) ?? ""}
                      onChange={(e) => setEdit((s) => ({ ...s, department: e.target.value }))}
                    />

                    <Input
                      placeholder="Address line 1"
                      value={(edit.address_line1 as string) ?? ""}
                      onChange={(e) => setEdit((s) => ({ ...s, address_line1: e.target.value }))}
                    />
                    <Input
                      placeholder="City/Ward"
                      value={(edit.city_ward as string) ?? ""}
                      onChange={(e) => setEdit((s) => ({ ...s, city_ward: e.target.value }))}
                    />

                    <Input
                      placeholder="State"
                      value={(edit.state as string) ?? ""}
                      onChange={(e) => setEdit((s) => ({ ...s, state: e.target.value }))}
                    />
                    <Input
                      placeholder="Country"
                      value={(edit.country as string) ?? ""}
                      onChange={(e) => setEdit((s) => ({ ...s, country: e.target.value }))}
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setEditOpen(false)} disabled={busy}>
                      Cancel
                    </Button>
                    <Button onClick={saveEdit} disabled={busy}>
                      {busy ? "Saving..." : "Save"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}