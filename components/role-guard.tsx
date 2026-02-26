"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export function RoleGuard({
  allow,
  children,
  redirectTo = "/tele",
}: {
  allow: ("ADMIN" | "TELE")[];
  children: React.ReactNode;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [ok, setOk] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user.id;

      if (!uid) {
        if (alive) setOk(false);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", uid)
        .single();

      if (!alive) return;

      if (error || !data?.role) return setOk(false);
      setOk(allow.includes(data.role));
    })();

    return () => {
      alive = false;
    };
  }, [allow]);

  useEffect(() => {
    if (ok === false) router.replace(redirectTo);
  }, [ok, redirectTo, router]);

  if (ok === null) return null;
  if (ok === false) return null; // đang redirect
  return <>{children}</>;
}