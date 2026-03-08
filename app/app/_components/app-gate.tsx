"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import AppShell from "./app-shell";
import { createClient } from "@/lib/supabase/client";
import { evaluatePermissions } from "@/lib/permissions";
import type { AppView } from "../_config/menu";

type ProfileRow = {
  user_id: string;
  ic_name: string | null;
  status: string | null;
  invite_redeemed_at: string | null;
  site_role: string | null;
  rank_id?: string | null;
};

type GateState =
  | { kind: "loading" }
  | { kind: "redirecting" }
  | { kind: "error"; message: string }
  | { kind: "allowed"; view: AppView };

export default function AppGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = useMemo(() => createClient(), []);
  const [state, setState] = useState<GateState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function runGate() {
      try {
        setState({ kind: "loading" });

        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (cancelled) return;

        if (authError) {
          console.error("auth getUser error:", authError);
          setState({ kind: "redirecting" });
          router.replace("/login");
          return;
        }

        if (!user) {
          setState({ kind: "redirecting" });
          router.replace("/login");
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("user_id, ic_name, status, invite_redeemed_at, site_role, rank_id")
          .eq("user_id", user.id)
          .maybeSingle<ProfileRow>();

        if (cancelled) return;

        if (profileError) {
          console.error("profiles read error:", profileError);
          setState({
            kind: "error",
            message: "Nem sikerült betölteni a profiladatokat.",
          });
          return;
        }

        if (!profile) {
          setState({ kind: "redirecting" });
          router.replace("/onboarding");
          return;
        }

        if (!profile.ic_name || !profile.ic_name.trim()) {
          setState({ kind: "redirecting" });
          router.replace("/onboarding");
          return;
        }

        if (!profile.invite_redeemed_at) {
          setState({ kind: "redirecting" });
          router.replace("/invite");
          return;
        }

        let rankName: string | null = null;

        if (profile.rank_id) {
          const { data: rankRow } = await supabase
            .from("ranks")
            .select("name")
            .eq("id", profile.rank_id)
            .maybeSingle<{ name: string | null }>();

          rankName = rankRow?.name ?? null;
        }

        const permissions = evaluatePermissions(profile, { pathname, rankName });

        if (!permissions.canAccessApp) {
          setState({
            kind: "error",
            message:
              "Nincs jogosultságod az oldal használatához. A tagságod jelenleg inaktív vagy fekete listás állapotban van. Ha úgy gondolod, hogy ez tévedés, keresd a vezetőséget.",
          });
          return;
        }

        if (!permissions.canAccessCurrentPath) {
          setState({
            kind: "error",
            message: "Ehhez az oldalhoz nincs jogosultságod.",
          });
          return;
        }

        setState({ kind: "allowed", view: permissions.appView });
      } catch (error) {
        console.error("AppGate unexpected error:", error);
        if (cancelled) return;

        setState({
          kind: "error",
          message: "Váratlan hiba történt az alkalmazás betöltése közben.",
        });
      }
    }

    runGate();

    return () => {
      cancelled = true;
    };
  }, [pathname, router, supabase]);

  if (state.kind === "loading" || state.kind === "redirecting") {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-white">
        <div className="lmr-surface w-full max-w-md rounded-[28px] p-6 text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-white" />
          <h1 className="text-lg font-semibold tracking-tight">Betöltés...</h1>
          <p className="mt-2 text-sm text-white/70">
            Ellenőrizzük a belépést és a jogosultságokat.
          </p>
        </div>
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-white">
        <div className="w-full max-w-md rounded-[28px] border border-red-400/20 bg-[rgba(53,10,18,0.72)] p-6 shadow-[0_20px_70px_rgba(0,0,0,0.38)] backdrop-blur-xl">
          <h1 className="text-lg font-semibold tracking-tight">Hozzáférés / betöltési hiba</h1>
          <p className="mt-2 text-sm text-white/75">{state.message}</p>

          <div className="mt-4 flex gap-3">
            <button
              onClick={() => router.replace("/app")}
              className="rounded-2xl border border-white/15 bg-white/[0.05] px-4 py-2 text-sm hover:bg-white/[0.08]"
            >
              Vissza a főoldalra
            </button>

            <button
              onClick={() => router.replace("/login")}
              className="rounded-2xl border border-white/15 bg-white/[0.05] px-4 py-2 text-sm hover:bg-white/[0.08]"
            >
              Bejelentkezés
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <AppShell view={state.view}>{children}</AppShell>;
}
