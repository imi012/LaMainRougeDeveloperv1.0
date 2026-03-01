"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import AppShell from "./app-shell";
import type { AppView } from "../_config/menu";

type Profile = {
  user_id: string;
  ic_name: string | null;
  status: "preinvite" | "pending" | "active" | "leadership" | "inactive" | null;
  invite_redeemed_at: string | null;
  site_role: "user" | "admin" | "owner" | null;
};

export default function AppGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<AppView>("member");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { data: userData, error: userErr } = await supabase.auth.getUser();
        const user = userData?.user;

        if (userErr) console.error("auth.getUser error:", userErr);

        if (!user) {
          if (!cancelled) router.replace("/login");
          return;
        }

        // ✅ Mindig user_id alapján olvasunk profilt
        const { data, error } = await supabase
          .from("profiles")
          .select("user_id,ic_name,status,invite_redeemed_at,site_role")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) {
          console.error("profiles read error:", error);
          if (!cancelled) router.replace("/login");
          return;
        }

        // Ha még nincs profil sor (pl. trigger előtt), küldjük onboardingra
        if (!data) {
          console.warn("profiles missing for user:", user.id);
          if (!cancelled) router.replace("/onboarding");
          return;
        }

        const p: Profile = {
          user_id: data.user_id,
          ic_name: data.ic_name ?? null,
          status: (data.status as any) ?? null,
          invite_redeemed_at: data.invite_redeemed_at ?? null,
          site_role: (data.site_role as any) ?? "user",
        };

        if (!p.ic_name) {
          if (!cancelled) router.replace("/onboarding");
          return;
        }

        if (!p.invite_redeemed_at) {
          if (!cancelled) router.replace("/invite");
          return;
        }

        if (p.status === "inactive") {
          if (!cancelled) router.replace("/login");
          return;
        }

        // View döntés
        if (p.status === "pending") setView("tgf");
        else if (p.status === "leadership" || p.site_role === "admin" || p.site_role === "owner")
          setView("leadership");
        else setView("member");

        if (!cancelled) setLoading(false);
      } catch (e) {
        console.error("AppGate fatal:", e);
        if (!cancelled) router.replace("/login");
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <div className="p-6">Betöltés…</div>;

  return <AppShell view={view}>{children}</AppShell>;
}