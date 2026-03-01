"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getMenuFor, type AppView } from "../_config/menu";

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
  const supabase = createClient();

  const sections = getMenuFor(view);

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  const viewLabel = view === "tgf" ? "TGF (pending)" : view === "leadership" ? "Vezetőség" : "Aktív";

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Topbar */}
      <div className="h-14 border-b border-white/10 flex items-center px-4 gap-3">
        <button
          className="h-10 w-10 rounded-xl border border-white/15 flex items-center justify-center"
          onClick={() => setOpen((v) => !v)}
          aria-label="Menü"
        >
          <div className="flex flex-col gap-1">
            <span className="block h-[2px] w-5 bg-white/80" />
            <span className="block h-[2px] w-5 bg-white/80" />
            <span className="block h-[2px] w-5 bg-white/80" />
          </div>
        </button>

        <div className="font-semibold">LaMainRouge Panel</div>

        <div className="ml-auto flex items-center gap-4 text-xs opacity-80">
          {headerRight}
          <span>Státusz: {viewLabel}</span>
        </div>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={`border-r border-white/10 bg-white/5 transition-all duration-200
          ${open ? "w-72" : "w-0"} overflow-hidden`}
        >
          <div className="p-4">
            <nav className="grid gap-1">
              <Link
                href="/app"
                className={`rounded-xl px-3 py-2 border border-transparent hover:border-white/15 hover:bg-white/5
                ${pathname === "/app" ? "bg-white/10 border-white/15" : ""}`}
                onClick={() => setOpen(false)}
              >
                Főoldal
              </Link>

              {sections.map((sec, idx) => (
                <div key={idx} className="mt-3">
                  {sec.title && (
                    <div className="px-3 text-xs font-semibold opacity-60 mb-2">
                      {sec.title}
                    </div>
                  )}
                  <div className="grid gap-1">
                    {sec.items.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`rounded-xl px-3 py-2 border border-transparent hover:border-white/15 hover:bg-white/5
                        ${pathname === item.href ? "bg-white/10 border-white/15" : ""}`}
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
                className="w-full rounded-xl px-3 py-2 border border-white/15 hover:bg-white/5 text-left mt-3"
              >
                Kijelentkezés
              </button>
            </nav>
          </div>
        </aside>

        {/* Content */}
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}