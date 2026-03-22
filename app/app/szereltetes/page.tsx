"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import DecisionBadge from "@/app/app/_components/decision-badge";

type VehicleRow = {
  id: string;
  vehicle_type: string;
  plate: string | null;
};

type MyRequestRow = {
  id: string;
  user_id: string;
  vehicle_id: string | null;
  vehicle_type: string | null;
  plate: string | null;
  event_name: string | null;
  amount: string | null;
  imgur_url: string | null;
  status: string;
  created_at: string;
  reviewed_at: string | null;
};

type ProfileRow = {
  user_id: string;
  status: string | null;
};

type EventOptionRow = {
  value: string;
  label: string;
  source: "event" | "action";
  created_at: string | null;
  is_closed: boolean;
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

function normalizeUrl(u: string) {
  const s = (u || "").trim();
  if (!s) return s;
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  return `https://${s}`;
}

function looksLikeImgurUrl(v: string) {
  const s = (v || "").trim();
  if (!s) return false;
  return /(^https?:\/\/)?(www\.)?imgur\.com\//i.test(s) || /(^https?:\/\/)?i\.imgur\.com\//i.test(s);
}

function formatMoney(value: string | null | undefined) {
  const digits = (value || "").replace(/\D/g, "");
  if (!digits) return "—";
  return `${digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}$`;
}

function getEventOptionLabel(option: EventOptionRow) {
  const prefix = option.source === "event" ? "Esemény" : "Akció";
  const closedSuffix = option.is_closed ? " (lezárt)" : "";
  return `${prefix} — ${option.label}${closedSuffix}`;
}

export default function SzereltetesPage() {
  const supabase = useMemo(() => createClient(), []);

  const [token, setToken] = useState<string | null>(null);
  const [me, setMe] = useState<ProfileRow | null>(null);
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [mine, setMine] = useState<MyRequestRow[]>([]);
  const [eventOptions, setEventOptions] = useState<EventOptionRow[]>([]);

  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [eventName, setEventName] = useState("");
  const [amount, setAmount] = useState("");
  const [imgurUrl, setImgurUrl] = useState("");

  const [busy, setBusy] = useState(false);
  const [loadingMine, setLoadingMine] = useState(true);
  const [loadingVehicles, setLoadingVehicles] = useState(true);
  const [loadingEventOptions, setLoadingEventOptions] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const selectedVehicle = useMemo(
    () => vehicles.find((v) => v.id === selectedVehicleId) ?? null,
    [vehicles, selectedVehicleId]
  );

  async function loadAuthAndProfile() {
    const { data: userData } = await supabase.auth.getUser();
    const authUser = userData?.user;

    if (!authUser) {
      setToken(null);
      setMe(null);
      return null;
    }

    const { data: sess } = await supabase.auth.getSession();
    setToken(sess.session?.access_token ?? null);

    const { data: myProfile, error: profileErr } = await supabase
      .from("profiles")
      .select("user_id,status")
      .eq("user_id", authUser.id)
      .maybeSingle();

    if (profileErr) {
      setError(profileErr.message);
    }

    setMe((myProfile ?? null) as ProfileRow | null);
    return authUser.id;
  }

  async function loadVehicles() {
    setLoadingVehicles(true);

    const { data, error } = await supabase
      .from("faction_vehicles")
      .select("id,vehicle_type,plate")
      .order("vehicle_type", { ascending: true });

    if (error) {
      setError(error.message);
      setVehicles([]);
    } else {
      setVehicles((data ?? []) as VehicleRow[]);
    }

    setLoadingVehicles(false);
  }

  async function loadEventOptions() {
    setLoadingEventOptions(true);

    try {
      const { data: sessData, error: sessErr } = await supabase.auth.getSession();
      if (sessErr) throw new Error(sessErr.message);
      const accessToken = sessData.session?.access_token;
      if (!accessToken) {
        setEventOptions([]);
        setLoadingEventOptions(false);
        return;
      }

      const res = await fetch("/api/service/event-options", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.message || "Nem sikerült betölteni az esemény opciókat.");
      }

      setEventOptions((json.rows ?? []) as EventOptionRow[]);
    } catch (e: any) {
      setEventOptions([]);
      setError(e?.message ?? "Nem sikerült betölteni az esemény opciókat.");
    } finally {
      setLoadingEventOptions(false);
    }
  }

  async function loadMine(userId: string | null) {
    setLoadingMine(true);

    try {
      if (!userId) {
        setMine([]);
        setLoadingMine(false);
        return;
      }

      const { data, error } = await supabase
        .from("service_requests")
        .select(
          "id,user_id,vehicle_id,vehicle_type,plate,event_name,amount,imgur_url,status,created_at,reviewed_at"
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        throw new Error(error.message);
      }

      setMine((data ?? []) as MyRequestRow[]);
    } catch (e: any) {
      setMine([]);
      setError(e?.message ?? "Nem sikerült betölteni a szereltetés igényléseket.");
    } finally {
      setLoadingMine(false);
    }
  }

  async function initPage() {
    setError(null);
    const userId = await loadAuthAndProfile();
    await Promise.all([loadVehicles(), loadEventOptions(), loadMine(userId)]);
  }

  useEffect(() => {
    void initPage();
  }, []);

  async function submit() {
    setError(null);
    setOkMsg(null);

    if (!selectedVehicle) {
      setError("Válassz járművet.");
      return;
    }

    if (!eventName.trim()) {
      setError("Válaszd ki, melyik eseményen vagy akción tört meg a jármű.");
      return;
    }

    if (!amount.trim()) {
      setError("Az összeg megadása kötelező.");
      return;
    }

    if (!imgurUrl.trim()) {
      setError("Az Imgur link megadása kötelező.");
      return;
    }

    if (!looksLikeImgurUrl(imgurUrl)) {
      setError("Kérlek, érvényes Imgur linket adj meg.");
      return;
    }

    if (!token) {
      setError("Nincs bejelentkezve.");
      return;
    }

    setBusy(true);

    try {
      const res = await fetch("/api/service/create", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          vehicle_id: selectedVehicle.id,
          event_name: eventName.trim(),
          amount: amount.trim(),
          imgur_url: imgurUrl.trim(),
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.message || "Nem sikerült beküldeni az igénylést.");
      }

      setOkMsg("Sikeres beküldés! A vezetőség látja a kezelőpanelen és az adatlapodon.");
      setSelectedVehicleId("");
      setEventName("");
      setAmount("");
      setImgurUrl("");

      await initPage();
    } catch (e: any) {
      setError(e?.message ?? "Hiba történt.");
    } finally {
      setBusy(false);
    }
  }

  if (me?.status === "pending") {
    return (
      <div className="lmr-page lmr-page-wide space-y-6">
        <section className="space-y-4">
          <div>
            <span className="lmr-chip inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
              Szereltetés
            </span>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-white md:text-4xl">
              Szereltetés igénylés
            </h1>
            <div className="mt-4 h-[2px] w-12 rounded-full bg-red-600/80" />
            <p className="mt-4 max-w-3xl text-sm leading-7 text-white/75">
              Itt lehet leadni a frakciós járművek javítási költségeit, miután a szereltetés megtörtént és megvan róla az igazoló kép.
            </p>
          </div>
        </section>

        <section className="text-sm text-white/82">
          Ehhez az oldalhoz jelenleg nincs hozzáférésed.
        </section>
      </div>
    );
  }

  return (
    <div className="lmr-page lmr-page-wide space-y-8">
      <section className="space-y-4">
        <div>
          <span className="lmr-chip inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
            Szereltetés
          </span>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-white md:text-4xl">
            Szereltetés igénylés
          </h1>
          <div className="mt-4 h-[2px] w-12 rounded-full bg-red-600/80" />
          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/75">
            Itt tudod leadni a frakciós járművek szereltetési igénylését. A jármű kiválasztása után válaszd ki, melyik eseményen vagy akción tört meg, add meg a javítás összegét és az igazoló Imgur linket.
          </p>
        </div>
      </section>

      {error ? (
        <div className="rounded-[24px] border border-red-500/25 bg-red-500/10 px-5 py-4 text-sm text-red-100">
          {error}
        </div>
      ) : null}

      {okMsg ? (
        <div className="rounded-[24px] border border-emerald-500/25 bg-emerald-500/10 px-5 py-4 text-sm text-emerald-100">
          {okMsg}
        </div>
      ) : null}

      <section className="space-y-5">
        <div>
          <h2 className="text-xl font-semibold text-white">Kérdőív</h2>
          <div className="mt-3 h-[2px] w-10 rounded-full bg-red-600/80" />
        </div>

        <div className="text-sm text-white/70">
          A jármű lista a Járművek menüből töltődik be, és a beküldött igény a vezetőségi panelen is meg fog jelenni.
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-white/82">Jármű típusa</label>
            <select
              className="w-full rounded-2xl border px-4 py-3 text-sm"
              value={selectedVehicleId}
              onChange={(e) => setSelectedVehicleId(e.target.value)}
              disabled={busy || loadingVehicles}
            >
              <option value="">{loadingVehicles ? "Járművek betöltése..." : "Válassz járművet"}</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.vehicle_type}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-white/82">Jármű rendszáma</label>
            <select
              className="w-full rounded-2xl border px-4 py-3 text-sm"
              value={selectedVehicleId}
              onChange={(e) => setSelectedVehicleId(e.target.value)}
              disabled={busy || loadingVehicles}
            >
              <option value="">{loadingVehicles ? "Járművek betöltése..." : "Válassz járművet"}</option>
              {vehicles.map((v) => (
                <option key={`plate-${v.id}`} value={v.id}>
                  {v.plate || "—"}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2">
            <label className="mb-2 block text-sm font-medium text-white/82">Melyik eseményen tört meg a jármű?</label>
            <select
              className="w-full rounded-2xl border px-4 py-3 text-sm"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              disabled={busy || loadingEventOptions}
            >
              <option value="">
                {loadingEventOptions ? "Események és akciók betöltése..." : "Válassz eseményt vagy akciót"}
              </option>
              {eventOptions.map((option) => (
                <option key={option.value} value={option.label}>
                  {getEventOptionLabel(option)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-white/82">Összeg</label>
            <input
              className="w-full rounded-2xl border px-4 py-3 text-sm"
              placeholder="pl. 150000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onBlur={() => {
                const formatted = formatMoney(amount);
                setAmount(formatted === "—" ? "" : formatted);
              }}
              disabled={busy}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-white/82">Szereltetésről készült kép (Imgur link)</label>
            <input
              className="w-full rounded-2xl border px-4 py-3 text-sm"
              placeholder="Ide imgur linket kell feltölteni."
              value={imgurUrl}
              onChange={(e) => setImgurUrl(e.target.value)}
              disabled={busy}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={submit}
            disabled={busy || !token || loadingVehicles || loadingEventOptions}
            className="lmr-btn lmr-btn-primary rounded-2xl px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-55"
          >
            {busy ? "Küldés..." : "Igénylés beküldése"}
          </button>

          <span className="text-sm text-white/55">A beküldés után az igénylés automatikusan megjelenik a saját listádban.</span>
        </div>
      </section>

      <section className="space-y-5">
        <div>
          <h2 className="text-xl font-semibold text-white">Saját igényléseim</h2>
          <div className="mt-3 h-[2px] w-10 rounded-full bg-red-600/80" />
        </div>

        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="text-left">
                <th>Beküldve</th>
                <th>Jármű</th>
                <th>Rendszám</th>
                <th>Esemény / Akció</th>
                <th>Összeg</th>
                <th>Imgur</th>
                <th>Állapot</th>
              </tr>
            </thead>
            <tbody>
              {loadingMine ? (
                <tr>
                  <td className="text-white/60" colSpan={7}>
                    Betöltés...
                  </td>
                </tr>
              ) : mine.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-sm text-white/60">
                    Még nincs beküldött szereltetés igénylésed.
                  </td>
                </tr>
              ) : (
                mine.map((row) => (
                  <tr key={row.id}>
                    <td>{fmt(row.created_at)}</td>
                    <td>{row.vehicle_type || "—"}</td>
                    <td>{row.plate || "—"}</td>
                    <td>{row.event_name || "—"}</td>
                    <td>{formatMoney(row.amount)}</td>
                    <td>
                      {row.imgur_url ? (
                        <a
                          className="text-white underline decoration-white/35 underline-offset-4 hover:text-white/80"
                          target="_blank"
                          rel="noreferrer"
                          href={normalizeUrl(row.imgur_url)}
                        >
                          Megnyitás
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      <DecisionBadge value={row.status} />
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
