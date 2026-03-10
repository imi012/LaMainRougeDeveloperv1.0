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
    `group relative overflow-hidden rounded-2xl px-3.5 py-2.5 text-sm border transition-all duration-200 ${
      isActive
        ? "border-red-500/30 bg-red-500/12 text-white shadow-[0_10px_30px_rgba(120,0,0,0.22)]"
        : "border-transparent bg-transparent text-white/74 hover:border-white/10 hover:bg-white/6 hover:text-white"
    }`;

  return (
    <div className="relative min-h-screen overflow-x-hidden text-white flex flex-col">
      {/* BACKGROUND */}
      <div
        className="fixed inset-0 -z-30"
        style={{
          backgroundImage: "url('/background.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          backgroundAttachment: "fixed",
        }}
      />

      <div className="fixed inset-0 -z-20 bg-[radial-gradient(circle_at_center,rgba(120,0,0,0.12),rgba(0,0,0,0.55)_45%,rgba(0,0,0,0.82)_100%)]" />
      <div className="fixed inset-0 -z-10 bg-black/35" />

      {/* HEADER */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-red-900/20 bg-black/20 backdrop-blur-xl">
        <div className="mx-auto flex h-[70px] max-w-[1600px] items-center gap-3 px-4 md:px-6">
          <button
            className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/12 bg-white/[0.04] shadow-[0_10px_30px_rgba(0,0,0,0.22)] transition hover:bg-white/[0.07]"
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

          {/* LOGO */}
          <div className="flex items-center gap-3">
            <div className="relative h-11 w-11 overflow-hidden rounded-full border border-white/12 bg-black/30 shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
              <Image
                src="/logo.png"
                alt="La Main Rouge logó"
                fill
                className="object-cover"
                sizes="44px"
                priority
              />
            </div>

            <div className="leading-tight">
              <div className="text-[11px] font-medium uppercase tracking-[0.34em] text-white/48">
                La Main Rouge
              </div>
              <div className="text-[1.05rem] font-semibold tracking-tight text-white">
                Belső kezelőpanel
              </div>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-3 text-xs text-white/78">
            {headerRight}
            <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 font-medium text-white/82 backdrop-blur-md">
              Státusz: {viewLabel}
            </span>
          </div>
        </div>
      </header>

      {/* CONTENT WRAPPER */}
      <div className="mx-auto flex flex-1 max-w-[1600px] items-start px-2 pb-6 pt-[82px] md:px-4 md:pt-[86px]">

        {/* SIDEBAR */}
        <aside
          className={`fixed z-40 overflow-hidden rounded-[28px] backdrop-blur-xl transition-all duration-300 ${
            open
              ? "w-72 border border-white/8 bg-black/18 p-3 opacity-100 shadow-[0_22px_80px_rgba(0,0,0,0.38)]"
              : "pointer-events-none w-0 border-0 bg-transparent p-0 opacity-0 shadow-none"
          }`}
          style={{
            top: "90px",
            left: "max(8px, calc((100vw - 1600px) / 2 + 8px))",
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
                    <div className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/38">
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
                className="mt-3 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-left text-sm text-white/82 transition hover:border-red-500/20 hover:bg-red-500/[0.08] hover:text-white"
              >
                Kijelentkezés
              </button>
            </nav>
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <main
          className={`min-w-0 flex-1 px-2 py-2 md:px-4 md:py-4 ${
            open ? "md:pl-[304px]" : ""
          }`}
        >
          {children}

          {/* FOOTER */}
          <footer className="mt-16 border-t border-white/10 pt-6 text-center text-sm text-white/55 leading-6">
            <p>© 2026 La Main Rouge — Minden jog fenntartva.</p>
            <p>Fiktív játékbeli szervezet.</p>
            <p>Weboldal fejlesztés: Thiba</p>
          </footer>
        </main>
      </div>
    </div>
  );
}