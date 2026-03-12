"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { hasEventManagerPermission, isLeadershipProfile } from "@/lib/permissions";

type MyProfile = {
  user_id: string;
  ic_name: string | null;
  status: "preinvite" | "pending" | "active" | "leadership" | "inactive";
  site_role: "user" | "admin" | "owner";
  rank_id?: string | null;
};

type ProfileRow = {
  user_id: string;
  ic_name: string | null;
  status: "preinvite" | "pending" | "active" | "leadership" | "inactive";
  site_role?: "user" | "admin" | "owner";
};

type EventRow = {
  id: string;
  name: string | null;
  holder_user_id: string | null;
  is_closed: boolean;
  created_by: string | null;
  created_at: string;
};

type PendingFeedback = "jo" | "semleges" | "rossz" | "nagyon_rossz" | null;

type EventParticipantRow = {
  event_id: string;
  user_id: string;
  was_online: boolean;
  attended: boolean;
  pending_feedback: PendingFeedback;
};

type EventImageRow = {
  id: string;
  event_id: string;
  imgur_url: string;
  uploaded_by: string | null;
  created_at: string;
};

const PENDING_FEEDBACK_OPTIONS: { value: Exclude<PendingFeedback, null>; label: string }[] = [
  { value: "jo", label: "Jó" },
  { value: "semleges", label: "Semleges" },
  { value: "rossz", label: "Rossz" },
  { value: "nagyon_rossz", label: "Nagyon rossz" },
];

function formatDateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd} ${hh}:${mi}`;
}

function normalizeImgurUrl(value: string) {
  const raw = value.trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

function isAllowedImgurUrl(value: string) {
  return /^(https?:\/\/)?(i\.)?imgur\.com\//i.test(value.trim());
}

function pendingFeedbackLabel(value: PendingFeedback) {
  return PENDING_FEEDBACK_OPTIONS.find((option) => option.value === value)?.label || "—";
}

export default function EsemenyekPage() {
  const supabase = createClient();

  const [me, setMe] = useState<MyProfile | null>(null);
  const [members, setMembers] = useState<ProfileRow[]>([]);
  const [myRankName, setMyRankName] = useState<string | null>(null);

  const [events, setEvents] = useState<EventRow[]>([]);
  const [participants, setParticipants] = useState<EventParticipantRow[]>([]);
  const [images, setImages] = useState<EventImageRow[]>([]);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newHolder, setNewHolder] = useState<string>("");
  const [imgurDraft, setImgurDraft] = useState<Record<string, string>>({});

  const memberName = useMemo(() => {
    const map = new Map<string, string>();
    members.forEach((m) => map.set(m.user_id, m.ic_name || "(nincs név)"));
    return map;
  }, [members]);

  const memberStatus = useMemo(() => {
    const map = new Map<string, string>();
    members.forEach((m) => map.set(m.user_id, m.status || ""));
    return map;
  }, [members]);

  const importableMembers = useMemo(() => {
    return members
      .filter(
        (m) =>
          m.status === "pending" ||
          m.status === "active" ||
          m.status === "leadership" ||
          m.site_role === "admin" ||
          m.site_role === "owner"
      )
      .sort((a, b) => (a.ic_name || "").localeCompare(b.ic_name || ""));
  }, [members]);

  const holderMembers = useMemo(() => {
    return members
      .filter(
        (m) =>
          m.status === "active" ||
          m.status === "leadership" ||
          m.site_role === "admin" ||
          m.site_role === "owner"
      )
      .sort((a, b) => (a.ic_name || "").localeCompare(b.ic_name || ""));
  }, [members]);

  const canAccessEvents = useMemo(() => {
    return hasEventManagerPermission(me, myRankName);
  }, [me, myRankName]);

  const isLeadership = useMemo(() => isLeadershipProfile(me), [me]);

  function canManageEvent(event: EventRow) {
    if (!me) return false;
    if (!canAccessEvents) return false;
    if (isLeadership) return true;
    return event.created_by === me.user_id;
  }

  async function apiFetch(path: string, init?: RequestInit) {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const token = session?.access_token;
    if (!token) {
      throw new Error("Nincs bejelentkezve.");
    }

    const res = await fetch(path, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(init?.headers || {}),
      },
    });

    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok) {
      throw new Error(json?.message || "Szerver hiba.");
    }

    return json;
  }

  async function loadAll() {
    setLoading(true);
    setError(null);

    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) {
      setError("Nincs bejelentkezve.");
      setLoading(false);
      return;
    }

    const { data: myProfile, error: myErr } = await supabase
      .from("profiles")
      .select("user_id,ic_name,status,site_role,rank_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (myErr || !myProfile) {
      setError("Nem sikerült betölteni a profilodat.");
      setLoading(false);
      return;
    }

    setMe(myProfile as MyProfile);

    let currentRankName: string | null = null;

    if ((myProfile as MyProfile).rank_id) {
      const { data: myRankRow } = await supabase
        .from("ranks")
        .select("name")
        .eq("id", (myProfile as MyProfile).rank_id)
        .maybeSingle();

      currentRankName = myRankRow?.name ?? null;
      setMyRankName(currentRankName);
    } else {
      setMyRankName(null);
    }

    const { data: mData, error: mErr } = await supabase
      .from("profiles")
      .select("user_id,ic_name,status,site_role")
      .in("status", ["active", "leadership", "pending", "inactive", "preinvite"]);

    if (mErr) {
      setMembers([]);
      setError("Nem sikerült betölteni a taglistát.");
      setLoading(false);
      return;
    }

    setMembers((mData as ProfileRow[]) ?? []);

    if (!hasEventManagerPermission(myProfile as MyProfile, currentRankName)) {
      setEvents([]);
      setParticipants([]);
      setImages([]);
      setLoading(false);
      return;
    }

    try {
      const json = await apiFetch("/api/events/list", { method: "GET" });
      const eventRows = ((json?.events as EventRow[] | null) ?? []).map((row) => ({
        ...row,
        is_closed: !!row.is_closed,
      }));

      setEvents(eventRows);
      setParticipants((json?.participants as EventParticipantRow[] | null) ?? []);
      setImages((json?.images as EventImageRow[] | null) ?? []);
      setLoading(false);
    } catch (e: any) {
      setError(e?.message || "Nem sikerült betölteni az eseményeket.");
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function participantsFor(eventId: string) {
    return participants.filter((p) => p.event_id === eventId);
  }

  function imagesFor(eventId: string) {
    return images.filter((i) => i.event_id === eventId);
  }

  function totalsFor(eventId: string) {
    const ps = participantsFor(eventId);
    return {
      attendedCount: ps.filter((p) => p.attended).length,
      onlineCount: ps.filter((p) => p.was_online).length,
      totalCount: ps.length,
      pendingRatedCount: ps.filter((p) => p.pending_feedback).length,
    };
  }

  async function createEvent() {
    setError(null);

    if (!me) return setError("Nincs bejelentkezve.");
    if (!canAccessEvents) return setError("Nincs jogosultságod eseményt létrehozni.");
    if (!newName.trim()) return setError("Add meg az esemény címét.");
    if (importableMembers.length === 0) return setError("Nincs importálható tag a taglistából.");

    setBusy("create");

    try {
      const json = await apiFetch("/api/events/create", {
        method: "POST",
        body: JSON.stringify({ name: newName.trim(), holder_user_id: newHolder || null }),
      });

      const data = (json?.row as EventRow) ?? null;
      if (!data) {
        setBusy(null);
        setError("Nem sikerült létrehozni az eseményt.");
        return;
      }

      setNewName("");
      setNewHolder("");
      setExpandedId(data.id);
      await loadAll();
    } catch (error: any) {
      setError(error?.message || "Nem sikerült létrehozni az eseményt.");
    }

    setBusy(null);
  }

  async function setAttended(eventId: string, userId: string, attended: boolean) {
    const event = events.find((x) => x.id === eventId);
    if (!event || !canManageEvent(event)) return setError("Nincs jogosultságod a résztvevők módosításához.");
    if (event.is_closed) return setError("Ez az esemény le van zárva.");

    setError(null);
    setBusy(`att:${eventId}:${userId}`);

    try {
      await apiFetch("/api/events/set-participant", {
        method: "POST",
        body: JSON.stringify({ event_id: eventId, user_id: userId, attended }),
      });

      setParticipants((prev) =>
        prev.map((p) =>
          p.event_id === eventId && p.user_id === userId ? { ...p, attended } : p
        )
      );
    } catch (error: any) {
      setError(error?.message || "Nem sikerült menteni a részvételt.");
    }

    setBusy(null);
  }

  async function setWasOnline(eventId: string, userId: string, wasOnline: boolean) {
    const event = events.find((x) => x.id === eventId);
    if (!event || !canManageEvent(event)) return setError("Nincs jogosultságod az online jelölés módosításához.");
    if (event.is_closed) return setError("Ez az esemény le van zárva.");

    setError(null);
    setBusy(`on:${eventId}:${userId}`);

    try {
      await apiFetch("/api/events/set-participant", {
        method: "POST",
        body: JSON.stringify({ event_id: eventId, user_id: userId, was_online: wasOnline }),
      });

      setParticipants((prev) =>
        prev.map((p) =>
          p.event_id === eventId && p.user_id === userId ? { ...p, was_online: wasOnline } : p
        )
      );
    } catch (error: any) {
      setError(error?.message || "Nem sikerült menteni az online jelölést.");
    }

    setBusy(null);
  }

  async function setPendingFeedback(eventId: string, userId: string, value: PendingFeedback) {
    const event = events.find((x) => x.id === eventId);
    if (!event || !canManageEvent(event)) return setError("Nincs jogosultságod az értékelés módosításához.");
    if (event.is_closed) return setError("Ez az esemény le van zárva.");

    setError(null);
    setBusy(`pf:${eventId}:${userId}`);

    try {
      await apiFetch("/api/events/set-participant", {
        method: "POST",
        body: JSON.stringify({ event_id: eventId, user_id: userId, pending_feedback: value }),
      });

      setParticipants((prev) =>
        prev.map((p) =>
          p.event_id === eventId && p.user_id === userId ? { ...p, pending_feedback: value } : p
        )
      );
    } catch (error: any) {
      setError(error?.message || "Nem sikerült menteni az értékelést.");
    }

    setBusy(null);
  }

  async function setClosed(eventId: string, value: boolean) {
    const event = events.find((x) => x.id === eventId);
    if (!event || !canManageEvent(event)) return setError("Nincs jogosultságod lezárni az eseményt.");

    setError(null);
    setBusy(`close:${eventId}`);

    try {
      const json = await apiFetch("/api/events/set-closed", {
        method: "POST",
        body: JSON.stringify({ event_id: eventId, is_closed: value }),
      });
      const data = json?.row as EventRow;
      setEvents((prev) => prev.map((x) => (x.id === eventId ? { ...data, is_closed: !!data.is_closed } : x)));
    } catch (error: any) {
      setError(error?.message || "Nem sikerült menteni a lezárást.");
    }

    setBusy(null);
  }

  async function addImgur(eventId: string) {
    const event = events.find((x) => x.id === eventId);
    if (!event || !canManageEvent(event)) return setError("Nincs jogosultságod képet hozzáadni.");

    const url = normalizeImgurUrl(imgurDraft[eventId] ?? "");
    if (!url) return setError("Adj meg egy Imgur linket.");
    if (!isAllowedImgurUrl(url)) return setError("Csak Imgur link engedélyezett.");
    if (event.is_closed) return setError("Ez az esemény le van zárva. Nem lehet képet hozzáadni.");

    setError(null);
    setBusy(`img:${eventId}`);

    try {
      const json = await apiFetch("/api/events/add-image", {
        method: "POST",
        body: JSON.stringify({ event_id: eventId, imgur_url: url }),
      });
      const data = json?.row as EventImageRow;
      setImages((prev) => [data, ...prev]);
      setImgurDraft((prev) => ({ ...prev, [eventId]: "" }));
    } catch (error: any) {
      setError(error?.message || "Nem sikerült hozzáadni a képet.");
    }

    setBusy(null);
  }

  async function deleteImgur(imageId: string) {
    const image = images.find((img) => img.id === imageId);
    const event = image ? events.find((x) => x.id === image.event_id) : null;

    if (!event || !canManageEvent(event)) return setError("Nincs jogosultságod képet törölni.");
    if (!confirm("Biztosan törlöd ezt a képlinket?")) return;

    setError(null);
    setBusy(`dimg:${imageId}`);

    try {
      await apiFetch("/api/events/delete-image", {
        method: "POST",
        body: JSON.stringify({ image_id: imageId }),
      });
      setImages((prev) => prev.filter((i) => i.id !== imageId));
    } catch (error: any) {
      setError(error?.message || "Nem sikerült törölni a képlinket.");
    }

    setBusy(null);
  }

  async function deleteEvent(eventId: string) {
    const event = events.find((x) => x.id === eventId);
    if (!event || !canManageEvent(event)) return setError("Nincs jogosultságod eseményt törölni.");
    if (!confirm("Biztosan törlöd ezt az eseményt? (Vissza nem vonható)")) return;

    setError(null);
    setBusy(`del:${eventId}`);

    try {
      await apiFetch("/api/events/delete", {
        method: "POST",
        body: JSON.stringify({ event_id: eventId }),
      });
      setEvents((prev) => prev.filter((e) => e.id !== eventId));
      setParticipants((prev) => prev.filter((p) => p.event_id !== eventId));
      setImages((prev) => prev.filter((i) => i.event_id !== eventId));
      setExpandedId((cur) => (cur === eventId ? null : cur));
    } catch (error: any) {
      setError(error?.message || "Nem sikerült törölni az eseményt.");
    }

    setBusy(null);
  }

  if (loading) return <div className="p-6">Betöltés…</div>;

  if (!canAccessEvents) {
    return <div className="p-6 text-white/70">Ehhez az oldalhoz nincs jogosultságod.</div>;
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8">
      <section className="space-y-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/45">La Main Rouge</div>
        <h1 className="text-3xl font-bold tracking-tight text-white">Események</h1>
        <div className="mt-4 h-[2px] w-12 rounded-full bg-red-600/80" />
        <p className="max-w-3xl text-sm leading-7 text-white/70">
         
          Importálható tagok: {importableMembers.length} fő
          {me ? <span className="ml-2 text-white/50"></span> : null}
        </p>

        <div>
          <button
            onClick={() => void loadAll()}
            className="rounded-2xl border border-white/12 bg-white/[0.06] px-4 py-2.5 text-sm font-medium text-white hover:bg-white/[0.09]"
            disabled={busy !== null}
          >
            Frissítés
          </button>
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      )}

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-white">Új esemény</h2>
          <div className="mt-3 h-[2px] w-10 rounded-full bg-red-600/80" />
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Esemény címe"
            className="w-full rounded-2xl border border-white/10 bg-black/20 px-3.5 py-3 text-white outline-none transition focus:border-red-500/50"
          />
          <select
            value={newHolder}
            onChange={(e) => setNewHolder(e.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-black/20 px-3.5 py-3 text-white outline-none transition focus:border-red-500/50"
          >
            <option value="">Szervező</option>
            {holderMembers.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.ic_name || "(nincs név)"}
              </option>
            ))}
          </select>
          <button
            onClick={() => void createEvent()}
            disabled={busy === "create"}
            className="rounded-2xl border border-red-400/20 bg-red-600 px-4 py-3 font-semibold text-white hover:bg-red-500 disabled:opacity-60"
          >
            {busy === "create" ? "Létrehozás…" : "Létrehozás"}
          </button>
        </div>

        <div className="text-xs leading-6 text-white/55">
          
        </div>
      </section>

      <section className="space-y-5">
        <div>
          <h2 className="text-xl font-semibold text-white">Eseménylista</h2>
          <div className="mt-3 h-[2px] w-10 rounded-full bg-red-600/80" />
        </div>

        {events.length === 0 ? (
          <div className="text-white/70">Még nincs esemény.</div>
        ) : (
          <div className="space-y-6">
            {events.map((e) => {
              const isOpen = expandedId === e.id;
              const holderName = e.holder_user_id ? memberName.get(e.holder_user_id) : "—";
              const ps = participantsFor(e.id);
              const ims = imagesFor(e.id);
              const totals = totalsFor(e.id);
              const isLocked = !!e.is_closed;
              const canManageThisEvent = canManageEvent(e);

              return (
                <section key={e.id} className="border-b border-red-900/40 pb-6 last:border-b-0 last:pb-0">
                  <button
                    onClick={() => setExpandedId(isOpen ? null : e.id)}
                    className="flex w-full items-start justify-between gap-4 py-1 text-left"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-lg font-semibold text-white">
                          {e.name || "(Névtelen esemény)"}
                        </h3>
                        {isLocked ? (
                          <span className="rounded-full border border-red-400/20 bg-red-500/10 px-2 py-0.5 text-[11px] font-medium text-red-200">
                            LEZÁRVA
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/60">
                        <span>Szervező: {holderName || "—"}</span>
                        <span>Létrehozva: {formatDateTime(e.created_at)}</span>
                        <span>Létrehozó: {memberName.get(e.created_by || "") || "—"}</span>
                        <span>Részt vett: {totals.attendedCount} fő</span>
                        <span>Online volt: {totals.onlineCount} fő</span>
                        <span>Pending értékelés: {totals.pendingRatedCount} db</span>
                        <span>Képek: {ims.length} db</span>
                      </div>
                    </div>

                    <div className="pt-1 text-sm text-white/70">{isOpen ? "▲" : "▼"}</div>
                  </button>

                  {isOpen && (
                    <div className="space-y-8 pt-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h4 className="text-base font-semibold text-white">Taglista ({ps.length} sor)</h4>
                          <div className="mt-3 h-[2px] w-8 rounded-full bg-red-600/80" />
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                          {!canManageThisEvent && (
                            <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-200">
                              Ezt az eseményt csak olvasni tudod. Sajátként létrehozott eseményt szerkeszthetsz.
                            </div>
                          )}

                          <button
                            onClick={() => void setClosed(e.id, !e.is_closed)}
                            disabled={!canManageThisEvent || busy === `close:${e.id}`}
                            className="rounded-2xl border border-white/12 bg-white/[0.05] px-4 py-2.5 text-sm text-white hover:bg-white/[0.08] disabled:opacity-60"
                          >
                            {busy === `close:${e.id}` ? "Mentés…" : e.is_closed ? "Feloldás" : "Lezárás"}
                          </button>

                          <button
                            onClick={() => void deleteEvent(e.id)}
                            disabled={!canManageThisEvent || busy === `del:${e.id}`}
                            className="rounded-2xl border border-red-400/20 bg-red-600 px-4 py-3 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-60"
                          >
                            {busy === `del:${e.id}` ? "Törlés…" : "Esemény törlése"}
                          </button>
                        </div>
                      </div>

                      {isLocked && (
                        <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/70">
                          Az esemény le van zárva: a pipálás, az értékelés és a képfeltöltés le van tiltva.
                        </div>
                      )}

                      {ps.length === 0 ? (
                        <div className="text-white/70">Még nincs importált névsor ennél az eseménynél.</div>
                      ) : (
                        <div className="overflow-x-auto rounded-2xl border border-white/10">
                          <table className="w-full text-sm">
                            <thead className="bg-white/5 text-white/70">
                              <tr>
                                <th className="p-3 text-left">Név</th>
                                <th className="p-3 text-left">Részt vett</th>
                                <th className="p-3 text-left">Online volt</th>
                                <th className="p-3 text-left">Értékelés</th>
                              </tr>
                            </thead>
                            <tbody>
                              {ps
                                .slice()
                                .sort((x, y) =>
                                  (memberName.get(x.user_id) || "").localeCompare(memberName.get(y.user_id) || "")
                                )
                                .map((p) => {
                                  const n = memberName.get(p.user_id) || "(nincs név)";
                                  const status = memberStatus.get(p.user_id) || "";
                                  const isPending = status === "pending";
                                  const attendingBusy = busy === `att:${e.id}:${p.user_id}`;
                                  const onlineBusy = busy === `on:${e.id}:${p.user_id}`;
                                  const pendingBusy = busy === `pf:${e.id}:${p.user_id}`;

                                  return (
                                    <tr key={p.user_id} className="border-t border-white/10">
                                      <td className="p-3">
                                        <div className="font-medium text-white">{n}</div>
                                        <div className="text-xs text-white/50">Státusz: {status || "—"}</div>
                                      </td>
                                      <td className="p-3">
                                        <label className="inline-flex items-center gap-2">
                                          <input
                                            type="checkbox"
                                            checked={p.attended}
                                            disabled={attendingBusy || isLocked || !canManageThisEvent}
                                            onChange={(ev) => void setAttended(e.id, p.user_id, ev.target.checked)}
                                          />
                                          <span className="text-white/80">{p.attended ? "Igen" : "Nem"}</span>
                                        </label>
                                      </td>
                                      <td className="p-3">
                                        <label className="inline-flex items-center gap-2">
                                          <input
                                            type="checkbox"
                                            checked={p.was_online}
                                            disabled={onlineBusy || isLocked || !canManageThisEvent}
                                            onChange={(ev) => void setWasOnline(e.id, p.user_id, ev.target.checked)}
                                          />
                                          <span className="text-white/80">{p.was_online ? "Igen" : "Nem"}</span>
                                        </label>
                                      </td>
                                      <td className="p-3">
                                        {isPending ? (
                                          <select
                                            value={p.pending_feedback ?? ""}
                                            disabled={pendingBusy || isLocked || !canManageThisEvent}
                                            onChange={(ev) =>
                                              void setPendingFeedback(
                                                e.id,
                                                p.user_id,
                                                (ev.target.value || null) as PendingFeedback
                                              )
                                            }
                                            className="w-full max-w-[220px] rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-white"
                                          >
                                            <option value="">Nincs megadva</option>
                                            {PENDING_FEEDBACK_OPTIONS.map((option) => (
                                              <option key={option.value} value={option.value}>
                                                {option.label}
                                              </option>
                                            ))}
                                          </select>
                                        ) : (
                                          <span className="text-white/50">
                                            {pendingFeedbackLabel(p.pending_feedback)}
                                          </span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                            </tbody>
                          </table>
                        </div>
                      )}

                      <div className="space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <h4 className="text-base font-semibold text-white">Képek / Imgur linkek</h4>
                            <div className="mt-3 h-[2px] w-8 rounded-full bg-red-600/80" />
                          </div>
                          <div className="text-xs leading-6 text-white/55">{ims.length} db</div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
                          <input
                            value={imgurDraft[e.id] ?? ""}
                            onChange={(ev) => setImgurDraft((prev) => ({ ...prev, [e.id]: ev.target.value }))}
                            placeholder="https://imgur.com/..."
                            className="w-full rounded-2xl border border-white/10 bg-black/20 px-3.5 py-3 text-white outline-none transition focus:border-red-500/50"
                            disabled={isLocked || !canManageThisEvent}
                          />
                          <button
                            onClick={() => void addImgur(e.id)}
                            disabled={busy === `img:${e.id}` || isLocked || !canManageThisEvent}
                            className="rounded-2xl border border-red-400/20 bg-red-600 px-4 py-3 font-semibold text-white hover:bg-red-500 disabled:opacity-60"
                          >
                            {busy === `img:${e.id}` ? "Mentés…" : "Imgur link hozzáadása"}
                          </button>
                        </div>

                        {ims.length === 0 ? (
                          <div className="text-white/70">Még nincs képlink rögzítve.</div>
                        ) : (
                          <div className="overflow-x-auto rounded-2xl border border-white/10">
                            <table className="w-full text-sm">
                              <thead className="bg-white/5 text-white/70">
                                <tr>
                                  <th className="p-3 text-left">Idő</th>
                                  <th className="p-3 text-left">Link</th>
                                  <th className="p-3 text-right">Művelet</th>
                                </tr>
                              </thead>
                              <tbody>
                                {ims.map((img) => (
                                  <tr key={img.id} className="border-t border-white/10">
                                    <td className="p-3 text-white/70">{formatDateTime(img.created_at)}</td>
                                    <td className="p-3">
                                      <a
                                        href={img.imgur_url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="break-all text-blue-300 underline hover:text-blue-200"
                                      >
                                        {img.imgur_url}
                                      </a>
                                    </td>
                                    <td className="p-3 text-right">
                                      <button
                                        onClick={() => void deleteImgur(img.id)}
                                        disabled={busy === `dimg:${img.id}` || isLocked || !canManageThisEvent}
                                        className="rounded-xl bg-white/10 px-3 py-1.5 text-white hover:bg-white/15 disabled:opacity-50"
                                      >
                                        {busy === `dimg:${img.id}` ? "Törlés…" : "Törlés"}
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}