"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { useUploadDetail } from "./hooks/useUploadDetail";
import { useAdminEditor } from "./hooks/useAdminEditor";

import CampaignHeader from "./components/CampaignHeader";
import CampaignKpis from "./components/CampaignKpis";
import TeleAccessCard from "./components/TeleAccessCard";
import ContactsConsole from "./components/ContactsConsole";
import EditorDialog from "./components/EditorDialog";

export default function UploadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const vm = useUploadDetail(id);
  const editor = useAdminEditor();

  useEffect(() => {
    if (!id) return;
    vm.refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // reload contacts when filters change (tách khỏi refreshAll)
  useEffect(() => {
    (async () => {
      if (!id) return;
      try {
        await vm.loadContacts();
      } catch (e: any) {
        console.error(e);
        alert(e?.message ?? "Load contacts failed");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vm.page, vm.q, vm.filterStatus, vm.filterAssignee.type, (vm.filterAssignee as any).teleId, vm.sortKey, vm.sortDir]);

  if (!vm.upload) return null;

  return (
    <div className="space-y-4">
      <CampaignHeader vm={vm} />
      <CampaignKpis vm={vm} />
      <TeleAccessCard vm={vm} />
      <ContactsConsole vm={vm} editor={editor} />

      {/* ✅ OPTIMAL: EditorDialog at page level */}
      <EditorDialog
        vm={editor}
        onSaved={async () => {
          await Promise.all([vm.loadKpis(), vm.loadContacts(), vm.loadUpload()]);
        }}
      />
    </div>
  );
}