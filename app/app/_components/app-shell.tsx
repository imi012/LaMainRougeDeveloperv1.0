"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
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

        if (!cancelled) setRankName(rankRow?.name ?? null);
      } else if (!cancelled) {
        setRankName(null);
      }
    }

    void loadProfile();

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
    `group rounded-2xl px-3.5 py-2.5 text-sm transition-all duration-200 ${
      isActive
        ? "bg-white/10 text-white"
        : "text-white/70 hover:bg-white/5 hover:text-white"
    }`;

  return (
    <div className="lmr-app relative flex min-h-screen flex-col overflow-x-hidden text-white">
      <div className="fixed inset-0 -z-30" />
      <div className="fixed inset-0 -z-20 bg-[radial-gradient(circle_at_center,rgba(120,0,0,0.10),rgba(0,0,0,0.52)_45%,rgba(0,0,0,0.80)_100%)]" />
      <div className="fixed inset-0 -z-10 bg-black/28" />

      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/8 bg-black/18 backdrop-blur-xl">
        <div className="lmr-shell-container flex h-[70px] items-center gap-3 px-4 md:px-6">
          <button
            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] transition hover:bg-white/[0.06]"
            onClick={() => setOpen((v) => !v)}
            aria-label="Menü"
            type="button"
          >
            <div className="flex flex-col gap-1">
              <span className="block h-[2px] w-5 rounded-full bg-white/85" />
              <span className="block h-[2px] w-5 rounded-full bg-white/85" />
              <span className="block h-[2px] w-5 rounded-full bg-white/85" />
            </div>
          </button>

          <div className="flex items-center gap-3">
            <div className="relative h-10 w-10 overflow-hidden rounded-full border border-white/10 bg-black/30">
              <Image
                src="/logo.png"
                alt="La Main Rouge logó"
                fill
                className="object-cover"
                sizes="40px"
                priority
              />
            </div>

            <div className="leading-tight">
              <div className="text-[11px] font-medium uppercase tracking-[0.34em] text-white/42">
                La Main Rouge
              </div>
              <div className="text-[1rem] font-semibold tracking-tight text-white">
                Belső kezelőpanel
              </div>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-3 text-xs text-white/72">
            {headerRight}
            <span className="rounded-full border border-white/8 bg-black/18 px-3 py-1.5 font-medium text-white/80 backdrop-blur-md">
              Státusz: {viewLabel}
            </span>
          </div>
        </div>
      </header>

      <div className="lmr-shell-container flex flex-1 items-start px-2 pb-6 pt-[82px] md:px-4 md:pt-[86px]">
        <aside
          className={`fixed z-40 overflow-hidden rounded-[28px] backdrop-blur-xl transition-all duration-300 ${
            open
              ? "w-72 border border-white/6 bg-black/14 p-3 opacity-100"
              : "pointer-events-none w-0 border-0 bg-transparent p-0 opacity-0 shadow-none"
          }`}
          style={{
            top: "90px",
            left: "max(8px, calc((100vw - min(1440px, 100vw)) / 2 + 8px))",
            height: "calc(100vh - 110px)",
          }}
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
                    <div className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/34">
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

              <div className="mt-4 h-px bg-white/8" />

              <button
                onClick={logout}
                type="button"
                className="mt-3 w-full rounded-2xl bg-white/[0.04] px-3.5 py-2.5 text-left text-sm text-white/82 transition hover:bg-red-500/[0.08] hover:text-white"
              >
                Kijelentkezés
              </button>
            </nav>
          </div>
        </aside>

        <main
          className={`min-w-0 flex-1 px-2 py-2 md:px-4 md:py-4 ${
            open ? "md:pl-[304px]" : ""
          }`}
        >
          {children}

          <footer className="mt-16 border-t border-white/8 pt-6 text-center text-sm leading-6 text-white/50">
            <p>© 2026 La Main Rouge — Minden jog fenntartva.</p>
            <p>Fiktív játékbeli szervezet.</p>
            <p>Weboldal fejlesztés: Thiba</p>
          </footer>
        </main>
      </div>
    </div>
  );
}