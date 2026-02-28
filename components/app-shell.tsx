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
    // ✅ Lock full viewport. Prevent body scrolling.
    <div className="h-screen flex flex-col overflow-hidden">
      {/* ✅ Fixed header height (sticky OK, but shrink-0 is key) */}
      <header className="shrink-0 sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div className="font-semibold">{title}</div>
            <nav className="hidden md:flex gap-2 text-sm">
              {nav.map((x) => (
                <Link
                  key={x.href}
                  href={x.href}
                  className="opacity-80 hover:opacity-100"
                >
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

      {/* ✅ Main becomes the scroll/viewport container; children scroll internally */}
      <main className="flex-1 min-h-0 overflow-hidden">
        <div className="mx-auto max-w-7xl px-4 py-6 h-full min-h-0">
          {children}
        </div>
      </main>
    </div>
  );
}