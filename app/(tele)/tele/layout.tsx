import { AuthGuard } from "@/components/auth-guard";
import { RoleGuard } from "@/components/role-guard";
import { AppShell } from "@/components/app-shell";

export default function TeleLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <RoleGuard allow={["TELE", "ADMIN"]} redirectTo="/admin">
        <AppShell
          title="Tele"
          nav={[
            { href: "/tele", label: "Campaigns" },
            { href: "/tele/workspace", label: "Workspace" },
          ]}
        >
          {children}
        </AppShell>
      </RoleGuard>
    </AuthGuard>
  );
}