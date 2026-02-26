"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, EyeOff } from "lucide-react";

type Role = "ADMIN" | "TELE";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    return email.trim().length > 3 && password.length > 0 && !loading;
  }, [email, password, loading]);

  const redirectByRole = async (uid: string) => {
    // profile role có thể bị trễ nếu vừa tạo user -> fallback TELE
    const { data, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", uid)
      .single();

    if (error) {
      window.location.href = "/tele";
      return;
    }

    const role = (data?.role as Role | undefined) ?? "TELE";
    window.location.href = role === "ADMIN" ? "/admin" : "/tele";
  };

  // Auto-redirect nếu đã login (remember session)
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user.id;
      if (uid) {
        await redirectByRole(uid);
        return;
      }
      setBooting(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async () => {
    if (!canSubmit) return;

    setLoading(true);
    setErr(null);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setLoading(false);
      setErr(error.message);
      return;
    }

    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user.id;

    if (!uid) {
      setLoading(false);
      window.location.href = "/tele";
      return;
    }

    await redirectByRole(uid);
  };

  if (booting) return null; // tránh flash login form khi đã có session

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Tele CRM Login</CardTitle>
        </CardHeader>

        <CardContent>
          <form
            className="space-y-3"
            autoComplete="on"
            onSubmit={(e) => {
              e.preventDefault();
              login(); // Enter submit
            }}
          >
            <div className="space-y-1">
              <div className="text-sm font-medium">Email</div>
              <Input
                name="email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                inputMode="email"
                disabled={loading}
              />
            </div>

            <div className="space-y-1">
              <div className="text-sm font-medium">Password</div>
              <div className="relative">
                <Input
                  name="password"
                  type={showPw ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  disabled={loading}
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 opacity-70 hover:opacity-100"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {err && <div className="text-sm text-red-500">{err}</div>}

            <Button className="w-full" type="submit" disabled={!canSubmit}>
              {loading ? "Signing in..." : "Sign in"}
            </Button>

          </form>
        </CardContent>
      </Card>
    </div>
  );
}