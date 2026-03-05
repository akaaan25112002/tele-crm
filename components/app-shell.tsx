"use client";

import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function AppShell({
  title,
  nav,
  children,
}: {
  title: string;
  nav: { href: string; label: string }[];
  children: React.ReactNode;
}) {
  const logout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <div className="h-screen flex flex-col">
      <header className="shrink-0 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div className="font-semibold">{title}</div>
            <nav className="hidden md:flex gap-2 text-sm">
              {nav.map((x) => (
                <Link key={x.href} href={x.href} className="opacity-80 hover:opacity-100">
                  {x.label}
                </Link>
              ))}
            </nav>
          </div>

          <Button variant="outline" size="sm" onClick={logout}>
            Logout
          </Button>
        </div>
      </header>

      {/* Single scroll container for ALL pages */}
      <div className="flex-1 overflow-y-auto">
        <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
      </div>
    </div>
  );
}