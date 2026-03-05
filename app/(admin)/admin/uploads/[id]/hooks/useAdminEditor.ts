"use client";

import { useMemo, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";
import type { CallLogRow, CallResult, ContactEditRow, ContactRow } from "../lib/types";
import { asStringOrNull } from "../lib/utils";

export function useAdminEditor() {
  const [editOpen, setEditOpen] = useState(false);
  const [editBusy, setEditBusy] = useState(false);
  const [editTarget, setEditTarget] = useState<ContactRow | null>(null);

  // form fields
  const [f_given, setF_given] = useState("");
  const [f_family, setF_family] = useState("");
  const [f_company, setF_company] = useState("");
  const [f_email, setF_email] = useState("");
  const [f_tel, setF_tel] = useState("");
  const [f_mobile_cc, setF_mobile_cc] = useState("");
  const [f_mobile_no, setF_mobile_no] = useState("");
  const [f_job, setF_job] = useState("");
  const [f_dept, setF_dept] = useState("");
  const [f_addr1, setF_addr1] = useState("");
  const [f_addr2, setF_addr2] = useState("");
  const [f_addr3, setF_addr3] = useState("");
  const [f_city, setF_city] = useState("");
  const [f_state, setF_state] = useState("");
  const [f_country, setF_country] = useState("");
  const [f_status, setF_status] = useState<string>("NEW");

  const [note1Options, setNote1Options] = useState<string[]>([]);
  const [note2Options, setNote2Options] = useState<CallResult[]>([]);
  const [note1, setNote1] = useState("");
  const [note2, setNote2] = useState("");
  const [noteText, setNoteText] = useState("");

  const [editHistory, setEditHistory] = useState<ContactEditRow[]>([]);
  const [callHistory, setCallHistory] = useState<CallLogRow[]>([]);
  const [snapshot, setSnapshot] = useState<Record<string, any> | null>(null);

  const editedFields = useMemo(() => {
    const s = new Set<string>();
    for (const e of editHistory) s.add(String(e.field_name));
    return s;
  }, [editHistory]);

  const loadCallMeta = useCallback(async () => {
    const { data: groups, error } = await supabase.from("call_results").select("group_name").eq("is_active", true);
    if (error) {
      console.warn("loadCallMeta error:", error);
      setNote1Options([]);
      return;
    }
    const uniq = Array.from(new Set(((groups as any[]) ?? []).map((x) => String(x.group_name))));
    uniq.sort((a, b) => a.localeCompare(b));
    setNote1Options(uniq);
  }, []);

  const loadNote2Options = useCallback(async (groupName: string) => {
    if (!groupName) {
      setNote2Options([]);
      return;
    }
    const { data, error } = await supabase
      .from("call_results")
      .select("id,group_name,detail_name,sort_order,final_status,is_terminal")
      .eq("group_name", groupName)
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (error) {
      console.error(error);
      setNote2Options([]);
      return;
    }
    setNote2Options(((data as any[]) ?? []) as CallResult[]);
  }, []);

  const loadEditHistory = useCallback(async (contactId: string) => {
    try {
      const base = supabase
        .from("v_contact_edits_admin")
        .select("field_name,old_value,new_value,edited_at,edited_by,edited_by_name");

      let r = await base.eq("contact_id", contactId).order("edited_at", { ascending: false }).limit(50);
      if (r.error) r = await base.eq("contactid", contactId).order("edited_at", { ascending: false }).limit(50);
      if (r.error) r = await base.eq("id", contactId).order("edited_at", { ascending: false }).limit(50);
      if (r.error) throw r.error;

      const rows = ((r.data as any[]) ?? []).map((x) => ({
        field_name: String(x.field_name),
        old_value: x.old_value ? String(x.old_value) : null,
        new_value: String(x.new_value ?? ""),
        edited_at: String(x.edited_at),
        edited_by: x.edited_by ? String(x.edited_by) : null,
        edited_by_name: x.edited_by_name ? String(x.edited_by_name) : null,
      })) as ContactEditRow[];

      setEditHistory(rows);
      return;
    } catch {
      // fallback table
    }

    const { data, error } = await supabase
      .from("contact_edits")
      .select("field_name,old_value,new_value,edited_at,edited_by")
      .eq("contact_id", contactId)
      .order("edited_at", { ascending: false })
      .limit(50);

    if (error) {
      console.warn("loadEditHistory fallback error:", error);
      setEditHistory([]);
      return;
    }

    setEditHistory(
      ((data as any[]) ?? []).map((x) => ({
        field_name: String(x.field_name),
        old_value: x.old_value ? String(x.old_value) : null,
        new_value: String(x.new_value ?? ""),
        edited_at: String(x.edited_at),
        edited_by: x.edited_by ? String(x.edited_by) : null,
      }))
    );
  }, []);

  const loadCallLogs = useCallback(async (contactId: string) => {
    try {
      const { data, error } = await supabase
        .from("v_call_logs_admin")
        .select("called_at,result_group,result_detail,note_text,created_by,created_by_name")
        .eq("contact_id", contactId)
        .order("called_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      setCallHistory(
        ((data as any[]) ?? []).map((x) => ({
          called_at: String(x.called_at),
          result_group: x.result_group ? String(x.result_group) : null,
          result_detail: x.result_detail ? String(x.result_detail) : null,
          note_text: x.note_text ? String(x.note_text) : null,
          created_by: x.created_by ? String(x.created_by) : null,
          created_by_name: x.created_by_name ? String(x.created_by_name) : null,
        }))
      );
      return;
    } catch {
      // fallback call_logs
    }

    const { data: logs, error: lgErr } = await supabase
      .from("call_logs")
      .select("called_at,result_id,note_text,created_by")
      .eq("contact_id", contactId)
      .order("called_at", { ascending: false })
      .limit(50);

    if (lgErr) {
      console.warn("loadCallLogs fallback error:", lgErr);
      setCallHistory([]);
      return;
    }

    const rows = (logs as any[]) ?? [];
    const ids = Array.from(new Set(rows.map((x) => x.result_id).filter(Boolean))) as string[];

    const resultMap = new Map<string, { group_name: string; detail_name: string }>();
    if (ids.length) {
      const { data: rs } = await supabase.from("call_results").select("id,group_name,detail_name").in("id", ids);
      for (const r of (rs as any[]) ?? []) {
        resultMap.set(String(r.id), { group_name: String(r.group_name), detail_name: String(r.detail_name) });
      }
    }

    setCallHistory(
      rows.map((x) => {
        const rid = x.result_id ? String(x.result_id) : "";
        const meta = rid ? resultMap.get(rid) : undefined;
        return {
          called_at: String(x.called_at),
          result_group: meta?.group_name ?? null,
          result_detail: meta?.detail_name ?? null,
          note_text: x.note_text ? String(x.note_text) : null,
          created_by: x.created_by ? String(x.created_by) : null,
        } as CallLogRow;
      })
    );
  }, []);

  const openEditor = useCallback(
    async (c: ContactRow) => {
      setEditTarget(c);
      setEditOpen(true);
      setEditBusy(false);

      // reset editor state
      setNote1("");
      setNote2("");
      setNoteText("");
      setEditHistory([]);
      setCallHistory([]);
      setSnapshot(null);
      setNote2Options([]);

      try {
        const fields = [
          "given_name",
          "family_name",
          "company_name",
          "email",
          "telephone_number",
          "mobile_country_code",
          "mobile_number",
          "job_title",
          "department",
          "address_line1",
          "address_line2",
          "address_line3",
          "city_ward",
          "state",
          "country",
          "current_status",
          "last_result_id",
          "last_note_text",
          "assigned_to",
          "assigned_at",
          "lease_expires_at",
          "call_attempts",
          "last_called_at",
        ];

        const { data, error } = await supabase.from("contacts").select(fields.join(",")).eq("id", c.id).single();
        if (error) throw error;

        setSnapshot((data as any) ?? null);

        setF_given(String((data as any)?.given_name ?? ""));
        setF_family(String((data as any)?.family_name ?? ""));
        setF_company(String((data as any)?.company_name ?? ""));
        setF_email(String((data as any)?.email ?? ""));
        setF_tel(String((data as any)?.telephone_number ?? ""));
        setF_mobile_cc(String((data as any)?.mobile_country_code ?? ""));
        setF_mobile_no(String((data as any)?.mobile_number ?? ""));
        setF_job(String((data as any)?.job_title ?? ""));
        setF_dept(String((data as any)?.department ?? ""));
        setF_addr1(String((data as any)?.address_line1 ?? ""));
        setF_addr2(String((data as any)?.address_line2 ?? ""));
        setF_addr3(String((data as any)?.address_line3 ?? ""));
        setF_city(String((data as any)?.city_ward ?? ""));
        setF_state(String((data as any)?.state ?? ""));
        setF_country(String((data as any)?.country ?? ""));
        setF_status(String((data as any)?.current_status ?? c.current_status ?? "NEW"));

        setNoteText(String((data as any)?.last_note_text ?? ""));
        const lastResultId = String((data as any)?.last_result_id ?? "").trim();
        setNote2(lastResultId);

        await loadCallMeta();

        if (lastResultId) {
          const { data: cr } = await supabase.from("call_results").select("group_name").eq("id", lastResultId).maybeSingle();
          if (cr?.group_name) {
            const groupName = String(cr.group_name);
            setNote1(groupName);
            await loadNote2Options(groupName);
          }
        }

        await Promise.all([loadEditHistory(c.id), loadCallLogs(c.id)]);
      } catch (e: any) {
        console.error(e);
        alert(e?.message ?? "Load contact failed");
      }
    },
    [loadCallMeta, loadNote2Options, loadEditHistory, loadCallLogs]
  );

  const closeEditor = useCallback(() => setEditOpen(false), []);

  const changeNote1 = useCallback(
    async (v: string) => {
      setNote1(v);
      setNote2("");
      await loadNote2Options(v);
    },
    [loadNote2Options]
  );

  const saveEditor = useCallback(async () => {
    if (!editTarget) return;
    setEditBusy(true);

    try {
      const { data: cur, error: curErr } = await supabase
        .from("contacts")
        .select(
          [
            "given_name",
            "family_name",
            "company_name",
            "email",
            "telephone_number",
            "mobile_country_code",
            "mobile_number",
            "job_title",
            "department",
            "address_line1",
            "address_line2",
            "address_line3",
            "city_ward",
            "state",
            "country",
            "current_status",
            "last_result_id",
            "last_note_text",
          ].join(",")
        )
        .eq("id", editTarget.id)
        .single();

      if (curErr) throw curErr;

      const next: any = {
        given_name: asStringOrNull(f_given),
        family_name: asStringOrNull(f_family),
        company_name: asStringOrNull(f_company),
        email: asStringOrNull(f_email),
        telephone_number: asStringOrNull(f_tel),
        mobile_country_code: asStringOrNull(f_mobile_cc),
        mobile_number: asStringOrNull(f_mobile_no),
        job_title: asStringOrNull(f_job),
        department: asStringOrNull(f_dept),
        address_line1: asStringOrNull(f_addr1),
        address_line2: asStringOrNull(f_addr2),
        address_line3: asStringOrNull(f_addr3),
        city_ward: asStringOrNull(f_city),
        state: asStringOrNull(f_state),
        country: asStringOrNull(f_country),
        current_status: f_status,
        last_note_text: asStringOrNull(noteText),
        last_result_id: note2 ? note2 : null,
      };

      const changes: Array<{ field_name: string; old_value: string | null; new_value: string | null }> = [];
      for (const [k, v] of Object.entries(next)) {
        const oldV = (cur as any)[k];
        const oldS = oldV === null || oldV === undefined ? null : String(oldV);
        const newS = v === null || v === undefined ? null : String(v);
        if (oldS !== newS) changes.push({ field_name: k, old_value: oldS, new_value: newS });
      }

      const { error: upErr } = await supabase.from("contacts").update(next).eq("id", editTarget.id);
      if (upErr) throw upErr;

      if (changes.length) {
        const { data: sess } = await supabase.auth.getSession();
        const me = sess.session?.user.id ?? null;

        const rows = changes.map((c) => ({
          contact_id: editTarget.id,
          field_name: c.field_name,
          old_value: c.old_value,
          new_value: c.new_value ?? "",
          edited_by: me,
        }));

        const { error: insErr } = await supabase.from("contact_edits").insert(rows);
        if (insErr) console.warn("contact_edits insert failed:", insErr);
      }

      try {
        await supabase.rpc("refresh_upload_status", { p_upload_id: editTarget.upload_id });
      } catch {}

      setEditOpen(false);
      return true;
    } catch (e: any) {
      console.error(e);
      alert(e?.message ?? "Save failed");
      return false;
    } finally {
      setEditBusy(false);
    }
  }, [
    editTarget,
    f_given,
    f_family,
    f_company,
    f_email,
    f_tel,
    f_mobile_cc,
    f_mobile_no,
    f_job,
    f_dept,
    f_addr1,
    f_addr2,
    f_addr3,
    f_city,
    f_state,
    f_country,
    f_status,
    noteText,
    note2,
  ]);

  return {
    // dialog
    editOpen,
    editBusy,
    editTarget,
    openEditor,
    closeEditor,
    setEditOpen,

    // snapshot + histories
    snapshot,
    editedFields,
    editHistory,
    callHistory,

    // form fields
    f_given,
    setF_given,
    f_family,
    setF_family,
    f_company,
    setF_company,
    f_email,
    setF_email,
    f_tel,
    setF_tel,
    f_mobile_cc,
    setF_mobile_cc,
    f_mobile_no,
    setF_mobile_no,
    f_job,
    setF_job,
    f_dept,
    setF_dept,
    f_addr1,
    setF_addr1,
    f_addr2,
    setF_addr2,
    f_addr3,
    setF_addr3,
    f_city,
    setF_city,
    f_state,
    setF_state,
    f_country,
    setF_country,
    f_status,
    setF_status,

    // notes
    note1Options,
    note2Options,
    note1,
    changeNote1,
    note2,
    setNote2,
    noteText,
    setNoteText,

    // save
    saveEditor,
  };
}

export type AdminEditorVM = ReturnType<typeof useAdminEditor>;