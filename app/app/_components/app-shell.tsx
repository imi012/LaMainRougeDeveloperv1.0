"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getMenuFor, type AppView } from "../_config/menu";
import { getMenuOptionsForProfile } from "@/lib/permissions";

export default function AppShell({
  view,
  headerRight,
  children,
}: {
  view: AppView;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [siteRole, setSiteRole] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [rankName, setRankName] = useState<string | null>(null);

  const menuOptions = useMemo(() => {
    return getMenuOptionsForProfile({ status, site_role: siteRole }, rankName);
  }, [rankName, siteRole, status]);

  const sections = useMemo(() => {
    return getMenuFor(view, menuOptions);
  }, [menuOptions, view]);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("site_role,status,rank_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled) return;

      setSiteRole(profile?.site_role ?? null);
      setStatus(profile?.status ?? null);

      if (profile?.rank_id) {
        const { data: rankRow } = await supabase
          .from("ranks")
          .select("name")
          .eq("id", profile.rank_id)
          .maybeSingle();

        if (!cancelled) {
          setRankName(rankRow?.name ?? null);
        }
      } else if (!cancelled) {
        setRankName(null);
      }
    }

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  const viewLabel =
    view === "tgf" ? "TGF (pending)" : view === "leadership" ? "Vezetőség" : "Aktív";

  const navLinkClass = (isActive: boolean) =>
    `rounded-2xl px-3.5 py-2.5 text-sm border transition ${
      isActive
        ? "border-white/18 bg-white/12 text-white shadow-[0_12px_30px_rgba(0,0,0,0.20)]"
        : "border-transparent bg-transparent text-white/78 hover:border-white/12 hover:bg-white/8 hover:text-white"
    }`;

  return (
    <div className="lmr-app min-h-screen text-white">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-black/24 backdrop-blur-2xl supports-[backdrop-filter]:bg-black/18">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-3 px-4 md:px-6">
          <button
            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/12 bg-white/[0.05] shadow-[0_10px_30px_rgba(0,0,0,0.18)]"
            onClick={() => setOpen((v) => !v)}
            aria-label="Menü"
          >
            <div className="flex flex-col gap-1">
              <span className="block h-[2px] w-5 rounded-full bg-white/85" />
              <span className="block h-[2px] w-5 rounded-full bg-white/85" />
              <span className="block h-[2px] w-5 rounded-full bg-white/85" />
            </div>
          </button>

          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/45">
              La Main Rouge
            </div>
            <div className="text-base font-semibold tracking-tight text-white">
              Belső kezelőpanel
            </div>
          </div>

          <div className="ml-auto flex items-center gap-3 text-xs text-white/78">
            {headerRight}
            <span className="rounded-full border border-white/12 bg-white/[0.06] px-3 py-1.5 font-medium text-white/85">
              Státusz: {viewLabel}
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1600px] items-start px-2 pb-5 pt-3 md:px-4 md:pb-6 md:pt-4">
        <aside
          className={`sticky top-[4.8rem] z-40 h-[calc(100vh-5.4rem)] overflow-hidden rounded-[28px] border border-white/10 bg-black/28 shadow-[0_22px_80px_rgba(0,0,0,0.42)] backdrop-blur-2xl transition-all duration-200 ${
            open ? "mr-4 w-72 p-3" : "mr-0 w-0 border-transparent p-0"
          }`}
        >
          <div className="h-full overflow-y-auto">
            <nav className="grid gap-1.5">
              <Link
                href="/app"
                className={navLinkClass(pathname === "/app")}
                onClick={() => setOpen(false)}
              >
                Főoldal
              </Link>

              {sections.map((sec, idx) => (
                <div key={idx} className="mt-3">
                  {sec.title && (
                    <div className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/42">
                      {sec.title}
                    </div>
                  )}

                  <div className="grid gap-1.5">
                    {sec.items.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={navLinkClass(pathname === item.href)}
                        onClick={() => setOpen(false)}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}

              <div className="mt-4 h-px bg-white/10" />

              <button
                onClick={logout}
                className="mt-3 w-full rounded-2xl border border-white/12 bg-white/[0.05] px-3.5 py-2.5 text-left text-sm text-white/85 hover:border-white/18 hover:bg-white/[0.08]"
              >
                Kijelentkezés
              </button>
            </nav>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="lmr-surface rounded-[30px] px-4 py-5 md:px-6 md:py-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
