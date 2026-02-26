import { AuthGuard } from "@/components/auth-guard";
import { RoleGuard } from "@/components/role-guard";
import { AppShell } from "@/components/app-shell";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <RoleGuard allow={["ADMIN"]} redirectTo="/tele">
        <AppShell
          title="Admin"
          nav={[
            { href: "/admin", label: "Dashboard" },
            { href: "/admin/uploads", label: "Uploads" },
          ]}
        >
          {children}
        </AppShell>
      </RoleGuard>
    </AuthGuard>
  );
}