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

  // Szankció
  const [sanctionImgur, setSanctionImgur] = useState("");
  const [sanctionReason, setSanctionReason] = useState("");

  // Inaktivitás
  const [inactiveFrom, setInactiveFrom] = useState("");
  const [inactiveTo, setInactiveTo] = useState("");

  // Névváltás
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
    } catch (e: any) {
      if (!isLockAbortError(e)) console.error(e);
      setToken(null);
    }
  }

  useEffect(() => {
    loadSessionStable();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit() {
    setErr(null);
    setMsg(null);

    if (!token) {
      setErr("Nincs bejelentkezve.");
      return;
    }

    if (type === "sanction") {
      if (!sanctionImgur.trim() || !sanctionReason.trim()) {
        setErr("Szankcióhoz kötelező a kép (imgur link) és az ok.");
        return;
      }
    }
    if (type === "inactivity") {
      if (!inactiveFrom || !inactiveTo) {
        setErr("Inaktivitásnál kötelező mettől–meddig.");
        return;
      }
    }
    if (type === "namechange") {
      if (!oldName.trim() || !newName.trim() || !nameReason.trim()) {
        setErr("Névváltásnál kötelező: előző név, új név, indok.");
        return;
      }
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
      if (!res.ok || json?.ok === false) throw new Error(json?.message || "Hiba történt.");

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
    <div className="p-6 max-w-3xl">
      <h1 className="text-3xl font-bold">Ticket nyitás</h1>
      <p className="mt-2 text-sm opacity-80">
        Válaszd ki a ticket típusát, majd töltsd ki a szükséges mezőket.
      </p>

      {err && (
        <div className="mt-4 rounded-xl border border-red-500/30 bg-red-900/20 p-3 text-sm text-red-200">
          {err}
        </div>
      )}
      {msg && (
        <div className="mt-4 rounded-xl border border-green-500/30 bg-green-900/20 p-3 text-sm text-green-200">
          {msg}
        </div>
      )}

      <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="text-sm opacity-80">Ticket típusa</div>
        <select
          className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
          value={type}
          onChange={(e) => setType(e.target.value as TicketType)}
        >
          <option value="sanction">Szankciók</option>
          <option value="inactivity">Inaktivitás</option>
          <option value="namechange">Névváltás</option>
        </select>

        {type === "sanction" && (
          <div className="mt-4 grid gap-3">
            <div>
              <div className="text-sm opacity-80">Szankcióról készült kép (imgur link)</div>
              <input
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                value={sanctionImgur}
                onChange={(e) => setSanctionImgur(e.target.value)}
                placeholder="https://imgur.com/..."
              />
            </div>
            <div>
              <div className="text-sm opacity-80">Ok</div>
              <textarea
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm min-h-[90px]"
                value={sanctionReason}
                onChange={(e) => setSanctionReason(e.target.value)}
                placeholder="Írd le röviden az okot..."
              />
            </div>
          </div>
        )}

        {type === "inactivity" && (
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <div>
              <div className="text-sm opacity-80">Mettől</div>
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                value={inactiveFrom}
                onChange={(e) => setInactiveFrom(e.target.value)}
              />
            </div>
            <div>
              <div className="text-sm opacity-80">Meddig</div>
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                value={inactiveTo}
                onChange={(e) => setInactiveTo(e.target.value)}
              />
            </div>
          </div>
        )}

        {type === "namechange" && (
          <div className="mt-4 grid gap-3">
            <div className="grid gap-3 lg:grid-cols-2">
              <div>
                <div className="text-sm opacity-80">Előző neved</div>
                <input
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                  value={oldName}
                  onChange={(e) => setOldName(e.target.value)}
                  placeholder="Pl. Kovács Béla"
                />
              </div>
              <div>
                <div className="text-sm opacity-80">Új neved</div>
                <input
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Pl. Nagy Béla"
                />
              </div>
            </div>
            <div>
              <div className="text-sm opacity-80">Indok</div>
              <textarea
                className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm min-h-[90px]"
                value={nameReason}
                onChange={(e) => setNameReason(e.target.value)}
                placeholder="Miért szeretnél nevet váltani?"
              />
            </div>
          </div>
        )}

        <button
          onClick={submit}
          disabled={busy || !token}
          className="mt-6 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold hover:bg-red-500 disabled:opacity-50"
        >
          {busy ? "..." : "Ticket leadása"}
        </button>
      </div>
    </div>
  );
}