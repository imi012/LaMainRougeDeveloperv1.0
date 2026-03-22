"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type MyProfile = {
  user_id: string;
  ic_name: string | null;
  status: string | null;
  site_role: string | null;
};

type AuditRow = {
  id: string;
  created_at: string;
  actor_user_id: string | null;
  actor_ic_name: string | null;
  actor_site_role: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  target_label: string | null;
  details: Record<string, any> | null;
};

function fmt(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd} ${hh}:${mi}`;
}

function prettifyAction(action: string) {
  const map: Record<string, string> = {
    invite_generate: "Meghívókód generálása",
    invite_revoke: "Meghívókód visszavonása",
    user_update: "Felhasználó módosítása",
    user_update_ic: "IC név módosítása",
    leadando_approve: "Leadandó jóváhagyása",
    leadando_unapprove: "Leadandó jóváhagyás visszavonása",
    leadando_delete: "Leadandó törlése",
    ticket_update: "Ticket státusz módosítása",
    ticket_delete: "Ticket törlése",
    warning_create: "Figyelmeztetés létrehozása",
    warning_delete: "Figyelmeztetés törlése",
    service_update: "Szereltetés módosítása",
    service_delete: "Szereltetés törlése",
    lore_approve: "Karaktertörténet elfogadása",
    lore_unapprove: "Karaktertörténet elfogadás visszavonása",
    lore_delete: "Karaktertörténet törlése",
    rules_update: "Szabályzat mentése",
    blacklist_create: "Blacklist felvétel",
    blacklist_delete: "Blacklist törlés",
  };
  return map[action] || action;
}

function roleBadgeStyle(role: string | null | undefined) {
  switch ((role || "").toLowerCase()) {
    case "owner":
      return "border-red-500/30 bg-red-500/15 text-red-200";
    case "admin":
      return "border-violet-500/30 bg-violet-500/15 text-violet-200";
    default:
      return "border-white/10 bg-white/5 text-white/80";
  }
}

export default function AuditLogPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [me, setMe] = useState<MyProfile | null>(null);
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [limit, setLimit] = useState(100);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError) throw new Error(authError.message || "Auth hiba.");
        if (!user) {
          router.replace("/login");
          return;
        }

        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token ?? null;
        if (!cancelled) setToken(accessToken);

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("user_id,ic_name,status,site_role")
          .eq("user_id", user.id)
          .maybeSingle();

        if (profileError) throw new Error(profileError.message || "Profil hiba.");
        if (!cancelled) setMe((profile ?? null) as MyProfile | null);

        if (profile?.site_role !== "admin" && profile?.site_role !== "owner") {
          if (!cancelled) {
            setLoading(false);
          }
          return;
        }

        const res = await fetch(`/api/admin/audit/list?limit=${limit}`, {
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
        });
        const json = await res.json().catch(() => ({}));

        if (!res.ok || json?.ok === false) {
          throw new Error(json?.message || "Nem sikerült betölteni az audit logot.");
        }

        if (!cancelled) {
          setRows((json.rows ?? []) as AuditRow[]);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Hiba történt.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [limit, router, supabase]);

  if (loading) {
    return (
      <div className="lmr-page">
        <div className="px-1 py-6 text-sm text-white/70">Betöltés...</div>
      </div>
    );
  }

  if (me?.site_role !== "admin" && me?.site_role !== "owner") {
    return (
      <div className="lmr-page space-y-6">
        <section className="space-y-4">
          <div>
            <h1 className="text-3xl font-bold text-white md:text-4xl">Audit log</h1>
            <div className="mt-4 h-[2px] w-12 rounded-full bg-red-600/80" />
          </div>
          <p className="text-sm text-white/80">
            Ehhez az oldalhoz csak site_role: admin vagy owner jogosultsággal lehet hozzáférni.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="lmr-page lmr-page-wide space-y-8">
      <section className="space-y-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <span className="lmr-chip inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
              Audit
            </span>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-white md:text-4xl">
              Audit log
            </h1>
            <div className="mt-4 h-[2px] w-12 rounded-full bg-red-600/80" />
            <p className="mt-4 max-w-3xl text-sm leading-7 text-white/75">
              Itt látod a vezetőségi és admin műveletek naplózását.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={String(limit)}
              onChange={(e) => setLimit(Number(e.target.value) || 100)}
              className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none"
            >
              <option value="50">Utolsó 50</option>
              <option value="100">Utolsó 100</option>
              <option value="250">Utolsó 250</option>
            </select>
            <button
              onClick={() => router.refresh()}
              className="lmr-btn rounded-2xl px-4 py-2.5 text-sm"
            >
              Frissítés
            </button>
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      ) : null}

      <section className="space-y-5">
        <div>
          <h2 className="text-xl font-semibold text-white">Naplózott műveletek</h2>
          <div className="mt-3 h-[2px] w-10 rounded-full bg-red-600/80" />
        </div>

        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full text-sm text-white/85">
            <thead>
              <tr className="border-b border-white/10 text-left text-white/60">
                <th className="px-3 py-3 font-medium">Idő</th>
                <th className="px-3 py-3 font-medium">Ki</th>
                <th className="px-3 py-3 font-medium">Jog</th>
                <th className="px-3 py-3 font-medium">Művelet</th>
                <th className="px-3 py-3 font-medium">Cél</th>
                <th className="px-3 py-3 font-medium">Részletek</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-white/60" colSpan={6}>
                    Még nincs naplózott admin művelet.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-b border-white/10 align-top last:border-b-0">
                    <td className="px-3 py-3 whitespace-nowrap">{fmt(row.created_at)}</td>
                    <td className="px-3 py-3">
                      <div className="font-medium text-white">{row.actor_ic_name || "—"}</div>
                      <div className="mt-1 text-xs text-white/50">{row.actor_user_id || "—"}</div>
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2 py-1 text-xs ${roleBadgeStyle(row.actor_site_role)}`}
                      >
                        {row.actor_site_role || "—"}
                      </span>
                    </td>
                    <td className="px-3 py-3">{prettifyAction(row.action)}</td>
                    <td className="px-3 py-3">
                      <div>{row.target_type || "—"}</div>
                      <div className="mt-1 text-xs text-white/50">
                        {row.target_label || row.target_id || "—"}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <pre className="whitespace-pre-wrap break-words text-xs text-white/75">
                        {row.details ? JSON.stringify(row.details, null, 2) : "—"}
                      </pre>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}