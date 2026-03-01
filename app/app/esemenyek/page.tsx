"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type MyProfile = {
  user_id: string;
  ic_name: string | null;
  status: "preinvite" | "pending" | "active" | "leadership" | "inactive";
  site_role: "user" | "admin" | "owner";
};

type ProfileRow = {
  user_id: string;
  ic_name: string | null;
  status: "preinvite" | "pending" | "active" | "leadership" | "inactive";
};

type EventRow = {
  id: string;
  name: string | null;
  holder_user_id: string | null;
  created_by: string | null;
  created_at: string;
};

type EventParticipantRow = {
  event_id: string;
  user_id: string;
  was_online: boolean;
  attended: boolean;
};

type EventImageRow = {
  id: string;
  event_id: string;
  imgur_url: string;
  uploaded_by: string | null;
  created_at: string;
};

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

export default function EsemenyekPage() {
  const supabase = createClient();

  const [me, setMe] = useState<MyProfile | null>(null);
  const [members, setMembers] = useState<ProfileRow[]>([]);

  const [events, setEvents] = useState<EventRow[]>([]);
  const [participants, setParticipants] = useState<EventParticipantRow[]>([]);
  const [images, setImages] = useState<EventImageRow[]>([]);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newHolder, setNewHolder] = useState<string>("");

  const memberName = useMemo(() => {
    const map = new Map<string, string>();
    members.forEach((m) => map.set(m.user_id, m.ic_name || "(nincs név)"));
    return map;
  }, [members]);

  const activeMembers = useMemo(
    () =>
      members
        .filter((m) => m.status === "active" || m.status === "leadership")
        .sort((a, b) => (a.ic_name || "").localeCompare(b.ic_name || "")),
    [members]
  );

  const canAccessEvents = useMemo(() => {
    if (!me) return false;
    return me.site_role === "admin" || me.site_role === "owner" || me.status === "leadership";
  }, [me]);

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

    const { data: myProfile } = await supabase
      .from("profiles")
      .select("user_id,ic_name,status,site_role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!myProfile) {
      setError("Nem sikerült betölteni a profilodat.");
      setLoading(false);
      return;
    }

    setMe(myProfile as any);

    const { data: mData } = await supabase
      .from("profiles")
      .select("user_id,ic_name,status")
      .in("status", ["active", "leadership", "pending", "inactive", "preinvite"]);

    setMembers((mData as any) ?? []);

    const p = myProfile as any as MyProfile;
    const allowed = p.site_role === "admin" || p.site_role === "owner" || p.status === "leadership";
    if (!allowed) {
      setEvents([]);
      setParticipants([]);
      setImages([]);
      setLoading(false);
      return;
    }

    const { data: eData, error: eErr } = await supabase
      .from("events")
      .select("id,name,holder_user_id,created_by,created_at")
      .order("created_at", { ascending: false })
      .limit(25);

    if (eErr) {
      setError("Nem sikerült betölteni az eseményeket.");
      setLoading(false);
      return;
    }

    setEvents((eData as any) ?? []);

    const eventIds = ((eData as any) ?? []).map((e: EventRow) => e.id);
    if (eventIds.length === 0) {
      setParticipants([]);
      setImages([]);
      setLoading(false);
      return;
    }

    const [{ data: pData }, { data: iData }] = await Promise.all([
      supabase
        .from("event_participants")
        .select("event_id,user_id,was_online,attended")
        .in("event_id", eventIds),
      supabase
        .from("event_images")
        .select("id,event_id,imgur_url,uploaded_by,created_at")
        .in("event_id", eventIds)
        .order("created_at", { ascending: false }),
    ]);

    setParticipants((pData as any) ?? []);
    setImages((iData as any) ?? []);

    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function participantsFor(eventId: string) {
    return participants.filter((p) => p.event_id === eventId);
  }
  function imagesFor(eventId: string) {
    return images.filter((i) => i.event_id === eventId);
  }

  async function createEvent() {
    setError(null);
    if (!me) return setError("Nincs bejelentkezve.");
    if (!canAccessEvents) return setError("Nincs jogosultságod eseményt létrehozni.");

    setBusy("create");
    const { data, error: insErr } = await supabase
      .from("events")
      .insert({
        name: newName.trim() ? newName.trim() : null,
        holder_user_id: newHolder || null,
        created_by: me.user_id,
      })
      .select("id,name,holder_user_id,created_by,created_at")
      .maybeSingle();

    if (insErr || !data) {
      setBusy(null);
      setError("Nem sikerült létrehozni az eseményt. (RLS?)");
      return;
    }

    setNewName("");
    setNewHolder("");
    setEvents((prev) => [data as any, ...prev]);
    setExpandedId((data as any).id);
    setBusy(null);
  }

  async function deleteEvent(eventId: string) {
    if (!confirm("Biztosan törlöd ezt az eseményt? (Vissza nem vonható)")) return;

    setError(null);
    setBusy(`del:${eventId}`);

    const { error: delErr } = await supabase.from("events").delete().eq("id", eventId);
    if (delErr) {
      setBusy(null);
      setError("Nem sikerült törölni az eseményt. (RLS delete policy?)");
      return;
    }

    setEvents((prev) => prev.filter((e) => e.id !== eventId));
    setParticipants((prev) => prev.filter((p) => p.event_id !== eventId));
    setImages((prev) => prev.filter((i) => i.event_id !== eventId));
    setExpandedId((cur) => (cur === eventId ? null : cur));

    setBusy(null);
  }

  if (loading) return <div className="p-6">Betöltés…</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Események</h1>
          <p className="text-sm text-white/70">Események kezelése (vezetőség / admin).</p>
        </div>
        <button
          onClick={loadAll}
          className="px-3 py-2 rounded bg-white/10 hover:bg-white/15"
          disabled={busy !== null}
        >
          Frissítés
        </button>
      </div>

      {error && (
        <div className="p-3 rounded border border-red-500/30 bg-red-500/10 text-red-200">
          {error}
        </div>
      )}

      {!canAccessEvents && (
        <div className="p-4 rounded-xl border border-white/10 bg-white/5 text-white/70">
          Ehhez a menühöz csak a vezetőség / admin fér hozzá.
        </div>
      )}

      {canAccessEvents && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
          <h2 className="font-semibold">Új esemény</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Esemény neve (opcionális)"
              className="w-full px-3 py-2 rounded bg-black/30 border border-white/10"
            />
            <select
              value={newHolder}
              onChange={(e) => setNewHolder(e.target.value)}
              className="w-full px-3 py-2 rounded bg-black/30 border border-white/10"
            >
              <option value="">Ki tartotta? (aktív tagok)</option>
              {activeMembers.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.ic_name || "(nincs név)"}
                </option>
              ))}
            </select>
            <button
              onClick={createEvent}
              disabled={busy === "create"}
              className="px-3 py-2 rounded bg-red-600 hover:bg-red-700 disabled:opacity-60"
            >
              {busy === "create" ? "Létrehozás…" : "Létrehozás"}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {events.length === 0 ? (
          <div className="text-white/70">Még nincs esemény.</div>
        ) : (
          events.map((e) => {
            const isOpen = expandedId === e.id;
            const holderName = e.holder_user_id ? memberName.get(e.holder_user_id) : "—";
            const ps = participantsFor(e.id);
            const ims = imagesFor(e.id);

            return (
              <div key={e.id} className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                <button
                  onClick={() => setExpandedId(isOpen ? null : e.id)}
                  className="w-full text-left p-4 hover:bg-white/5 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{e.name || "(Névtelen esemény)"}</div>
                    <div className="text-xs text-white/60 mt-1 flex flex-wrap gap-x-3 gap-y-1">
                      <span>Ki tartotta: {holderName || "—"}</span>
                      <span>Létrehozva: {formatDateTime(e.created_at)}</span>
                      <span>Résztvevők: {ps.length} fő</span>
                      <span>Képek: {ims.length} db</span>
                    </div>
                  </div>
                  <div className="text-sm text-white/70">{isOpen ? "▲" : "▼"}</div>
                </button>

                {isOpen && (
                  <div className="p-4 space-y-4">
                    <div className="flex items-center justify-end">
                      <button
                        onClick={() => deleteEvent(e.id)}
                        disabled={busy === `del:${e.id}`}
                        className="px-3 py-2 rounded bg-red-600 hover:bg-red-700 disabled:opacity-60"
                      >
                        {busy === `del:${e.id}` ? "Törlés…" : "Esemény törlése"}
                      </button>
                    </div>

                    <div className="text-sm text-white/70">
                    
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}