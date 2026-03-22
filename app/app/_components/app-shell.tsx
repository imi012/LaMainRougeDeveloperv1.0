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
    `group rounded-[20px] px-3.5 py-2.5 text-sm transition-all duration-200 ${
      isActive
        ? "border border-[#c4ab7840] bg-gradient-to-r from-[#7f1d1d]/55 via-[#341111]/70 to-[#120d0d]/85 text-white shadow-[0_12px_34px_rgba(0,0,0,0.22)]"
        : "border border-transparent text-[#f4eee2]/72 hover:border-[#c4ab7822] hover:bg-white/[0.04] hover:text-white"
    }`;

  return (
    <div className="lmr-app relative flex min-h-screen flex-col overflow-x-hidden text-white">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-[#c4ab7824] bg-[rgba(10,8,8,0.54)] backdrop-blur-xl">
        <div className="mx-auto flex h-[74px] w-full max-w-[1440px] items-center gap-3 px-4 md:px-6">
          <button
            className="flex h-11 w-11 items-center justify-center rounded-[20px] border border-[#c4ab7826] bg-white/[0.03] transition hover:border-[#c4ab7844] hover:bg-white/[0.06]"
            onClick={() => setOpen((v) => !v)}
            aria-label="Menü"
            type="button"
          >
            <div className="flex flex-col gap-1">
              <span className="block h-[2px] w-5 rounded-full bg-[#f4eee2]/85" />
              <span className="block h-[2px] w-5 rounded-full bg-[#f4eee2]/85" />
              <span className="block h-[2px] w-5 rounded-full bg-[#f4eee2]/85" />
            </div>
          </button>

          <div className="flex items-center gap-3">
            <div className="relative h-10 w-10 overflow-hidden rounded-full border border-[#c4ab7828] bg-black/30">
              <Image
                src="/logo-tetsuryu.png"
                alt="Tetsuryū-kai logó"
                fill
                className="object-cover"
                sizes="40px"
                priority
              />
            </div>

            <div className="leading-tight">
              <div className="text-[11px] font-semibold uppercase tracking-[0.34em] text-[#f4eee2]/38">
                Tetsuryu-Kai
              </div>
              <div className="text-[1.02rem] font-semibold tracking-[0.01em] text-[#f4eee2]">
                Belső kezelőpanel
              </div>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-3 text-xs text-[#f4eee2]/72">
            {headerRight}
            <span className="rounded-full border border-[#c4ab7828] bg-[rgba(18,14,14,0.56)] px-3 py-1.5 font-medium text-[#f4eee2]/82 backdrop-blur-md">
              Státusz: {viewLabel}
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1440px] flex-1 items-start px-2 pb-6 pt-[84px] md:px-4 md:pt-[88px]">
        <aside
          className={`fixed z-40 overflow-hidden rounded-[28px] backdrop-blur-xl transition-all duration-300 ${
            open
              ? "w-72 border border-[#c4ab7824] bg-[rgba(12,9,9,0.48)] p-3 opacity-100 shadow-[0_28px_80px_rgba(0,0,0,0.4)]"
              : "pointer-events-none w-0 border-0 bg-transparent p-0 opacity-0 shadow-none"
          }`}
          style={{
            top: "94px",
            left: "max(calc((100vw - 1440px) / 2 + 16px), 8px)",
            height: "calc(100vh - 114px)",
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
                    <div className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#f4eee2]/32">
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

              <div className="mt-4 h-px bg-gradient-to-r from-transparent via-[#c4ab7833] to-transparent" />

              <button
                onClick={logout}
                type="button"
                className="mt-3 w-full rounded-[20px] border border-[#7f1d1d66] bg-gradient-to-b from-[#8b1f1f]/90 to-[#5e1414]/95 px-3.5 py-2.5 text-left text-sm font-semibold text-white transition hover:border-[#c94b4b88] hover:from-[#a12525] hover:to-[#6b1717]"
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

          <footer className="mt-16 border-t border-[#c4ab781f] pt-6 text-center text-sm leading-6 text-[#f4eee2]/48">
            <p>© 2026 Tetsuryu-Kai — Minden jog fenntartva.</p>
            <p>Fiktív játékbeli szervezet.</p>
            <p>Weboldal fejlesztés: Thiba</p>
          </footer>
        </main>
      </div>
    </div>
  );
}