"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useUploadDetail } from "./hooks/useUploadDetail";
import { useAdminEditor } from "./hooks/useAdminEditor";

import CampaignHeader from "./components/CampaignHeader";
import CampaignKpis from "./components/CampaignKpis";
import TeleAccessCard from "./components/TeleAccessCard";
import ContactsConsole from "./components/ContactsConsole";
import EditorDialog from "./components/EditorDialog";
import ImportAuditConsole from "./components/ImportAuditConsole";
import CampaignDashboard from "./components/CampaignDashboard";
import { CampaignActionBar } from "./components/campaign-action-bar";

type TabKey = "contacts" | "audit";

function normTab(x: string | null): TabKey {
  const t = String(x ?? "").trim().toLowerCase();
  if (t === "audit") return "audit";
  return "contacts";
}

export default function UploadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const sp = useSearchParams();

  const vm = useUploadDetail(id);
  const editor = useAdminEditor();

  const initialTab = useMemo(() => normTab(sp.get("tab")), [sp]);
  const [tab, setTab] = useState<TabKey>(initialTab);

  const [refreshToken, setRefreshToken] = useState(0);
  const bumpRefreshToken = () => setRefreshToken((x) => x + 1);

  useEffect(() => {
    setTab(normTab(sp.get("tab")));
  }, [sp]);

  useEffect(() => {
    if (!id) return;
    vm.refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

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

      <CampaignActionBar
        uploadId={id}
        campaignStatus={vm.upload?.status ?? null}
        onAfterCleanup={async () => {
          await vm.refreshAll();
          bumpRefreshToken();
        }}
        onAfterMutation={async () => {
          await vm.refreshAll();
          bumpRefreshToken();
        }}
      />

      <CampaignDashboard
        uploadId={id}
        campaignName={vm.upload?.campaign_name ?? null}
        campaignStatus={vm.upload?.status ?? null}
        refreshToken={refreshToken}
        onAfterBatchDeleted={async () => {
          await vm.refreshAll();
          bumpRefreshToken();
        }}
      />

      <TeleAccessCard vm={vm} />

      <div className="flex items-center gap-2">
        <button
          className={`px-3 py-1.5 rounded-md border text-sm ${
            tab === "contacts" ? "bg-primary text-primary-foreground border-primary" : "bg-background"
          }`}
          onClick={() => setTab("contacts")}
          type="button"
        >
          Contacts
        </button>
        <button
          className={`px-3 py-1.5 rounded-md border text-sm ${
            tab === "audit" ? "bg-primary text-primary-foreground border-primary" : "bg-background"
          }`}
          onClick={() => setTab("audit")}
          type="button"
        >
          Import Audit
        </button>
        <div className="text-xs opacity-60 ml-2">
          Tip: you can open audit directly via <span className="font-mono">?tab=audit</span>
        </div>
      </div>

      {tab === "audit" ? (
        <ImportAuditConsole uploadId={id} refreshToken={refreshToken} />
      ) : (
        <ContactsConsole vm={vm} editor={editor} />
      )}

      <EditorDialog
        vm={editor}
        onSaved={async () => {
          await Promise.all([vm.loadKpis(), vm.loadContacts(), vm.loadUpload()]);
          bumpRefreshToken();
        }}
      />
    </div>
  );
}