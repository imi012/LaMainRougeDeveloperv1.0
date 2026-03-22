"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

type TicketType = "sanction" | "inactivity" | "namechange";

function isLockAbortError(reason: any) {
  const name = reason?.name || reason?.cause?.name;
  const msg = String(reason?.message || "");
  return name === "AbortError" || msg.toLowerCase().includes("lock request is aborted");
}

export default function TicketPage() {
  const supabase = createClient();
  const router = useRouter();

  const [token, setToken] = useState<string | null>(null);
  const [type, setType] = useState<TicketType>("sanction");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [sanctionImgur, setSanctionImgur] = useState("");
  const [sanctionReason, setSanctionReason] = useState("");
  const [inactiveFrom, setInactiveFrom] = useState("");
  const [inactiveTo, setInactiveTo] = useState("");
  const [oldName, setOldName] = useState("");
  const [newName, setNewName] = useState("");
  const [nameReason, setNameReason] = useState("");

  async function loadSessionStable() {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) {
        router.replace("/login");
        return;
      }

      const { data: sessData } = await supabase.auth.getSession();
      setToken(sessData.session?.access_token ?? null);

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("ic_name")
        .eq("user_id", userData.user.id)
        .single();

      if (profileError) throw profileError;

      setOldName(profileData?.ic_name ?? "");
    } catch (e: any) {
      if (!isLockAbortError(e)) console.error(e);
      setToken(null);
    }
  }

  useEffect(() => {
    void loadSessionStable();
  }, []);

  async function submit() {
    setErr(null);
    setMsg(null);

    if (!token) return setErr("Nincs bejelentkezve.");
    if (type === "sanction" && (!sanctionImgur.trim() || !sanctionReason.trim())) {
      return setErr("Szankcióhoz kötelező a kép (imgur link) és az ok.");
    }
    if (type === "inactivity" && (!inactiveFrom || !inactiveTo)) {
      return setErr("Inaktivitásnál kötelező mettől–meddig.");
    }
    if (type === "namechange" && (!oldName.trim() || !newName.trim() || !nameReason.trim())) {
      return setErr("Névváltásnál kötelező: előző név, új név, indok.");
    }

    setBusy(true);
    try {
      const res = await fetch("/api/tickets/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          type,
          sanction_imgur_url: sanctionImgur.trim(),
          sanction_reason: sanctionReason.trim(),
          inactivity_from: inactiveFrom,
          inactivity_to: inactiveTo,
          old_name: oldName.trim(),
          new_name: newName.trim(),
          namechange_reason: nameReason.trim(),
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.message || "Hiba történt.");
      }

      setMsg("Ticket elküldve!");
      setSanctionImgur("");
      setSanctionReason("");
      setInactiveFrom("");
      setInactiveTo("");
      setOldName("");
      setNewName("");
      setNameReason("");
    } catch (e: any) {
      setErr(e?.message ?? "Hiba történt.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="lmr-page lmr-page-compact space-y-8">
      <section className="space-y-4">
        <div>
          <span className="lmr-chip inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
            Ticket
          </span>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-white md:text-4xl">
            Ticket nyitás
          </h1>
          <div className="mt-4 h-[2px] w-12 rounded-full bg-red-600/80" />
          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/75">
            Válaszd ki a ticket típusát, majd töltsd ki a szükséges mezőket.
          </p>
        </div>
      </section>

      {err && (
        <div className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {err}
        </div>
      )}

      {msg && (
        <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          {msg}
        </div>
      )}

      <section className="space-y-5">
        <div>
          <h2 className="text-xl font-semibold text-white">Ticket típusa</h2>
          <div className="mt-3 h-[2px] w-10 rounded-full bg-red-600/80" />
        </div>

        <div>
          <label className="text-xs uppercase tracking-[0.14em] text-white/55">
            Típus kiválasztása
          </label>
          <select
            className="mt-2 w-full rounded-2xl border px-3 py-2.5 text-sm"
            value={type}
            onChange={(e) => setType(e.target.value as TicketType)}
          >
            <option value="sanction">Szankciók</option>
            <option value="inactivity">Inaktivitás</option>
            <option value="namechange">Névváltás</option>
          </select>
        </div>
      </section>

      {type === "sanction" && (
        <section className="space-y-5">
          <div>
            <h2 className="text-xl font-semibold text-white">Szankció ticket</h2>
            <div className="mt-3 h-[2px] w-10 rounded-full bg-red-600/80" />
          </div>

          <div className="grid gap-4">
            <div>
              <div className="text-sm text-white/72">Szankcióról készült kép, video, log (link)</div>
              <input
                className="mt-2 w-full rounded-2xl border px-3 py-2.5 text-sm"
                value={sanctionImgur}
                onChange={(e) => setSanctionImgur(e.target.value)}
                placeholder=" pl:https://imgur.com/..."
              />
            </div>

            <div>
              <div className="text-sm text-white/72">Ok</div>
              <textarea
                className="mt-2 min-h-[110px] w-full rounded-2xl border px-3 py-2.5 text-sm"
                value={sanctionReason}
                onChange={(e) => setSanctionReason(e.target.value)}
                placeholder="Írd le röviden az okot..."
              />
            </div>
          </div>
        </section>
      )}

      {type === "inactivity" && (
        <section className="space-y-5">
          <div>
            <h2 className="text-xl font-semibold text-white">Inaktivitás ticket</h2>
            <div className="mt-3 h-[2px] w-10 rounded-full bg-red-600/80" />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <div className="text-sm text-white/72">Mettől</div>
              <input
                type="date"
                className="mt-2 w-full rounded-2xl border px-3 py-2.5 text-sm"
                value={inactiveFrom}
                onChange={(e) => setInactiveFrom(e.target.value)}
              />
            </div>

            <div>
              <div className="text-sm text-white/72">Meddig</div>
              <input
                type="date"
                className="mt-2 w-full rounded-2xl border px-3 py-2.5 text-sm"
                value={inactiveTo}
                onChange={(e) => setInactiveTo(e.target.value)}
              />
            </div>
          </div>
        </section>
      )}

      {type === "namechange" && (
        <section className="space-y-5">
          <div>
            <h2 className="text-xl font-semibold text-white">Névváltás ticket</h2>
            <div className="mt-3 h-[2px] w-10 rounded-full bg-red-600/80" />
          </div>

          <div className="grid gap-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <div className="text-sm text-white/72">Előző neved</div>
                <input
                  className="mt-2 w-full rounded-2xl border px-3 py-2.5 text-sm opacity-70"
                  value={oldName}
                  readOnly
                  disabled
                  placeholder="Pl. Kovács Béla"
                />
              </div>

              <div>
                <div className="text-sm text-white/72">Új neved</div>
                <input
                  className="mt-2 w-full rounded-2xl border px-3 py-2.5 text-sm"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Pl. Nagy Béla"
                />
              </div>
            </div>

            <div>
              <div className="text-sm text-white/72">Indok</div>
              <textarea
                className="mt-2 min-h-[110px] w-full rounded-2xl border px-3 py-2.5 text-sm"
                value={nameReason}
                onChange={(e) => setNameReason(e.target.value)}
                placeholder="Miért szeretnél nevet váltani?"
              />
            </div>
          </div>
        </section>
      )}

      <section className="space-y-5">
        <div>
          <h2 className="text-xl font-semibold text-white">Beküldés</h2>
          <div className="mt-3 h-[2px] w-10 rounded-full bg-red-600/80" />
        </div>

        <div>
          <button
            onClick={submit}
            disabled={busy || !token}
            className="lmr-btn lmr-btn-primary rounded-2xl px-4 py-2.5 text-sm font-medium"
          >
            {busy ? "..." : "Ticket leadása"}
          </button>
        </div>
      </section>
    </div>
  );
}