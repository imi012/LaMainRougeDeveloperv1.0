"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type MyProfile = {
  user_id: string;
  ic_name: string | null;
  status: "preinvite" | "pending" | "active" | "leadership" | "inactive";
  site_role: "user" | "admin" | "owner";
};

type MemberRow = {
  user_id: string;
  ic_name: string | null;
  status: "preinvite" | "pending" | "active" | "leadership" | "inactive";
  site_role?: "user" | "admin" | "owner";
};

type ActionRow = {
  id: string;
  name: string;
  organizer_id: string | null;
  cars_checked: boolean;
  is_closed: boolean;
  created_by: string | null;
  created_at: string;
};

type ParticipantRow = {
  action_id: string;
  user_id: string;
  attended: boolean;
  paid: boolean;
};

type ActionLogRow = {
  id: string;
  action_id: string;
  uploaded_by: string | null;
  raw_text: string;
  cassette_count: number | null;
  gross_amount: number | null;
  net_amount: number | null;
  created_at: string;
};

type ActionImageRow = {
  id: string;
  action_id: string;
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

/**
 * [SeeMTA - Siker]: A kazettában 136 404 $ volt.
 * - counts lines with that pattern
 * - gross = sum of all found values
 * - net = gross * 0.9
 */
function parseActionLog(raw: string) {
  const lines = raw.split(/\r?\n/);

  let cassetteCount = 0;
  let gross = 0;

  for (const line of lines) {
    if (!line.includes("A kazettában")) continue;
    if (!line.includes("$")) continue;
    if (!line.includes("volt")) continue;

    const start = line.indexOf("A kazettában");
    if (start < 0) continue;
    const tail = line.slice(start);

    const idxDollar = tail.indexOf("$");
    if (idxDollar < 0) continue;

    const beforeDollar = tail.slice(0, idxDollar);
    const m = beforeDollar.match(/([\d\s]+)\s*$/);
    if (!m) continue;

    const numeric = (m[1] || "").replace(/\s+/g, "");
    const v = Number(numeric);
    if (!Number.isFinite(v)) continue;

    gross += v;
    cassetteCount += 1;
  }

  const net = Math.round(gross * 0.9);
  return { cassetteCount, gross, net };
}

export default function AkciokPage() {
  const supabase = createClient();

  const [me, setMe] = useState<MyProfile | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);

  const [actions, setActions] = useState<ActionRow[]>([]);
  const [participants, setParticipants] = useState<ParticipantRow[]>([]);
  const [logs, setLogs] = useState<ActionLogRow[]>([]);
  const [images, setImages] = useState<ActionImageRow[]>([]);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newOrganizer, setNewOrganizer] = useState<string>("");

  const [logText, setLogText] = useState<Record<string, string>>({});

  const memberName = useMemo(() => {
    const map = new Map<string, string>();
    members.forEach((m) => map.set(m.user_id, m.ic_name || "(nincs név)"));
    return map;
  }, [members]);

  const activeMembers = useMemo(() => {
    const filtered = members.filter(
      (m) =>
        m.status === "active" ||
        m.status === "leadership" ||
        m.site_role === "admin" ||
        m.site_role === "owner"
    );
    filtered.sort((a, b) => (a.ic_name || "").localeCompare(b.ic_name || ""));
    return filtered;
  }, [members]);

  const canManageCarsChecked = useMemo(() => {
    if (!me) return false;
    return me.site_role === "admin" || me.site_role === "owner" || me.status === "leadership";
  }, [me]);

  const canCloseActions = useMemo(() => {
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

    const { data: myProfile, error: myErr } = await supabase
      .from("profiles")
      .select("user_id,ic_name,status,site_role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (myErr || !myProfile) {
      setError("Nem sikerült betölteni a profilodat.");
      setLoading(false);
      return;
    }
    setMe(myProfile as any);

    const { data: mData, error: mErr } = await supabase
      .from("profiles")
      .select("user_id,ic_name,status,site_role")
      .in("status", ["active", "leadership", "pending", "inactive", "preinvite"]);

    if (mErr) {
      setError("Nem sikerült betölteni a taglistát.");
      setMembers([]);
    } else {
      setMembers((mData as any) ?? []);
    }

    const { data: aData, error: aErr } = await supabase
      .from("actions")
      .select("id,name,organizer_id,cars_checked,is_closed,created_by,created_at")
      .order("created_at", { ascending: false })
      .limit(50);

    if (aErr) {
      setError("Nincs jogosultságod az Akciók megtekintéséhez, vagy hiba történt.");
      setLoading(false);
      return;
    }

    setActions((aData as any) ?? []);

    const actionIds = ((aData as any) ?? []).map((a: ActionRow) => a.id);
    if (actionIds.length === 0) {
      setParticipants([]);
      setLogs([]);
      setImages([]);
      setLoading(false);
      return;
    }

    const [{ data: pData }, { data: lData }, { data: iData }] = await Promise.all([
      supabase
        .from("action_participants")
        .select("action_id,user_id,attended,paid")
        .in("action_id", actionIds),
      supabase
        .from("action_logs")
        .select("id,action_id,uploaded_by,raw_text,cassette_count,gross_amount,net_amount,created_at")
        .in("action_id", actionIds)
        .order("created_at", { ascending: false }),
      supabase
        .from("action_images")
        .select("id,action_id,imgur_url,uploaded_by,created_at")
        .in("action_id", actionIds)
        .order("created_at", { ascending: false }),
    ]);

    setParticipants((pData as any) ?? []);
    setLogs((lData as any) ?? []);
    setImages((iData as any) ?? []);

    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function participantsFor(actionId: string) {
    return participants.filter((p) => p.action_id === actionId);
  }
  function logsFor(actionId: string) {
    return logs.filter((l) => l.action_id === actionId);
  }
  function imagesFor(actionId: string) {
    return images.filter((i) => i.action_id === actionId);
  }

  function totalsFor(actionId: string) {
    const ps = participantsFor(actionId);
    const f = ps.filter((p) => p.attended).length;

    const gross = logsFor(actionId).reduce((acc, l) => acc + (Number(l.gross_amount) || 0), 0);
    const net = logsFor(actionId).reduce((acc, l) => acc + (Number(l.net_amount) || 0), 0);

    const perHead = f > 0 ? Math.floor(net / f) : null;
    return { f, gross, net, perHead };
  }

  // Auto roster sync when open
  useEffect(() => {
    (async () => {
      if (!expandedId) return;
      if (activeMembers.length === 0) return;

      const a = actions.find((x) => x.id === expandedId);
      if (!a) return;

      const ps = participantsFor(expandedId);
      if (ps.length > 0) return;

      setBusy(`sync:${expandedId}`);
      const payload = activeMembers.map((m) => ({
        action_id: expandedId,
        user_id: m.user_id,
        attended: false,
        paid: false,
      }));

      const { error: upErr } = await supabase
        .from("action_participants")
        .upsert(payload, { onConflict: "action_id,user_id" });

      if (upErr) {
        console.error("sync participants error:", upErr);
        setError("Nem sikerült a résztvevő-névsort létrehozni. (participant RLS?)");
        setBusy(null);
        return;
      }

      const { data: pData } = await supabase
        .from("action_participants")
        .select("action_id,user_id,attended,paid")
        .eq("action_id", expandedId);

      setParticipants((prev) => {
        const rest = prev.filter((p) => p.action_id !== expandedId);
        return [...rest, ...((pData as any) ?? [])];
      });

      setBusy(null);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedId, activeMembers.length, actions.length]);

  async function createAction() {
    setError(null);
    if (!newName.trim()) return setError("Adj meg egy akció nevet.");
    if (!me) return setError("Nincs bejelentkezve.");
    if (activeMembers.length === 0) return setError("Nincs aktív tag betöltve — frissíts rá.");

    setBusy("create");

    const { data, error: insErr } = await supabase
      .from("actions")
      .insert({
        name: newName.trim(),
        organizer_id: newOrganizer || null,
        created_by: me.user_id,
      })
      .select("id,name,organizer_id,cars_checked,is_closed,created_by,created_at")
      .maybeSingle();

    if (insErr || !data) {
      setBusy(null);
      return setError("Nem sikerült létrehozni az akciót. (RLS?)");
    }

    const actionId = (data as any).id as string;

    const payload = activeMembers.map((m) => ({
      action_id: actionId,
      user_id: m.user_id,
      attended: false,
      paid: false,
    }));

    const { error: upErr } = await supabase
      .from("action_participants")
      .upsert(payload, { onConflict: "action_id,user_id" });

    if (upErr) {
      console.error("Auto-import failed:", upErr);
      setError("Akció létrejött, de a résztvevők importja nem sikerült. (participant RLS?)");
    } else {
      const { data: pData } = await supabase
        .from("action_participants")
        .select("action_id,user_id,attended,paid")
        .eq("action_id", actionId);

      setParticipants((prev) => [...prev, ...((pData as any) ?? [])]);
    }

    setNewName("");
    setNewOrganizer("");
    setActions((prev) => [data as any, ...prev]);
    setExpandedId(actionId);
    setBusy(null);
  }

  async function setAttended(actionId: string, userId: string, attended: boolean) {
    const a = actions.find((x) => x.id === actionId);
    if (a?.is_closed) return setError("Ez az akció le van zárva.");

    setError(null);
    setBusy(`att:${actionId}:${userId}`);

    const payload: Partial<ParticipantRow> = { action_id: actionId, user_id: userId, attended };
    if (!attended) payload.paid = false;

    const { error: upErr } = await supabase
      .from("action_participants")
      .upsert(payload as any, { onConflict: "action_id,user_id" });

    if (upErr) {
      setBusy(null);
      return setError("Nem sikerült menteni. (participant RLS?)");
    }

    setParticipants((prev) =>
      prev.map((p) =>
        p.action_id === actionId && p.user_id === userId
          ? { ...p, attended, paid: attended ? p.paid : false }
          : p
      )
    );
    setBusy(null);
  }

  async function setPaid(actionId: string, userId: string, paid: boolean) {
    const a = actions.find((x) => x.id === actionId);
    if (a?.is_closed) return setError("Ez az akció le van zárva.");

    setError(null);
    setBusy(`paid:${actionId}:${userId}`);

    const { error: upErr } = await supabase
      .from("action_participants")
      .upsert({ action_id: actionId, user_id: userId, paid } as any, {
        onConflict: "action_id,user_id",
      });

    if (upErr) {
      setBusy(null);
      return setError("Nem sikerült menteni. (participant RLS?)");
    }

    setParticipants((prev) =>
      prev.map((p) => (p.action_id === actionId && p.user_id === userId ? { ...p, paid } : p))
    );
    setBusy(null);
  }

  async function setCarsChecked(actionId: string, value: boolean) {
    const a = actions.find((x) => x.id === actionId);
    if (a?.is_closed) return setError("Ez az akció le van zárva.");
    if (!canManageCarsChecked) return setError("Nincs jogosultságod ehhez.");

    setError(null);
    setBusy(`cars:${actionId}`);

    const { data, error: upErr } = await supabase
      .from("actions")
      .update({ cars_checked: value })
      .eq("id", actionId)
      .select("id,name,organizer_id,cars_checked,is_closed,created_by,created_at")
      .maybeSingle();

    if (upErr || !data) {
      setBusy(null);
      return setError("Nem sikerült frissíteni.");
    }

    setActions((prev) => prev.map((x) => (x.id === actionId ? (data as any) : x)));
    setBusy(null);
  }

  async function setClosed(actionId: string, value: boolean) {
    if (!canCloseActions) return setError("Nincs jogosultságod lezárni/feloldani.");

    setError(null);
    setBusy(`close:${actionId}`);

    const { data, error: upErr } = await supabase
      .from("actions")
      .update({ is_closed: value })
      .eq("id", actionId)
      .select("id,name,organizer_id,cars_checked,is_closed,created_by,created_at")
      .maybeSingle();

    if (upErr || !data) {
      setBusy(null);
      return setError("Nem sikerült menteni a lezárást. (RLS?)");
    }

    setActions((prev) => prev.map((x) => (x.id === actionId ? (data as any) : x)));
    setBusy(null);
  }

  async function uploadLog(actionId: string) {
    if (!me) return setError("Nincs bejelentkezve.");

    const a = actions.find((x) => x.id === actionId);
    if (a?.is_closed) return setError("Ez az akció le van zárva. (Nem lehet logot feltölteni.)");

    setError(null);
    const raw = (logText[actionId] ?? "").trim();
    if (!raw) return setError("Illeszd be a log szöveget, vagy tölts fel egy .log fájlt.");

    setBusy(`log:${actionId}`);
    const parsed = parseActionLog(raw);

    const { data, error: insErr } = await supabase
      .from("action_logs")
      .insert({
        action_id: actionId,
        uploaded_by: me.user_id,
        raw_text: raw,
        cassette_count: parsed.cassetteCount,
        gross_amount: parsed.gross,
        net_amount: parsed.net,
      })
      .select("id,action_id,uploaded_by,raw_text,cassette_count,gross_amount,net_amount,created_at")
      .maybeSingle();

    if (insErr || !data) {
      setBusy(null);
      return setError("Nem sikerült feltölteni a logot.");
    }

    setLogs((prev) => [data as any, ...prev]);
    setLogText((prev) => ({ ...prev, [actionId]: "" }));
    setBusy(null);
  }

  async function deleteLog(logId: string) {
    if (!confirm("Biztosan törlöd ezt a logot? (Vissza nem vonható)")) return;

    setError(null);
    setBusy(`dlog:${logId}`);

    const { error: delErr } = await supabase.from("action_logs").delete().eq("id", logId);
    if (delErr) {
      setBusy(null);
      return setError("Nem sikerült törölni a logot. (RLS delete policy?)");
    }

    setLogs((prev) => prev.filter((l) => l.id !== logId));
    setBusy(null);
  }

  async function loadLogFile(actionId: string, file: File) {
    const text = await file.text();
    setLogText((prev) => ({ ...prev, [actionId]: text }));
  }

  async function addImgur(actionId: string) {
    if (!me) return setError("Nincs bejelentkezve.");

    const a = actions.find((x) => x.id === actionId);
    if (a?.is_closed) return setError("Ez az akció le van zárva. (Nem lehet képet hozzáadni.)");

    setError(null);
    const url = prompt("Adj meg egy Imgur linket (imgur.com vagy i.imgur.com):")?.trim();
    if (!url) return;
    if (!/^(https?:\/\/)?(i\.)?imgur\.com\//i.test(url)) return setError("Csak Imgur link engedélyezett.");

    setBusy(`img:${actionId}`);
    const { data, error: insErr } = await supabase
      .from("action_images")
      .insert({ action_id: actionId, imgur_url: url, uploaded_by: me.user_id })
      .select("id,action_id,imgur_url,uploaded_by,created_at")
      .maybeSingle();

    if (insErr || !data) {
      setBusy(null);
      return setError("Nem sikerült hozzáadni a képet.");
    }

    setImages((prev) => [data as any, ...prev]);
    setBusy(null);
  }

  async function deleteImgur(imageId: string) {
    if (!confirm("Biztosan törlöd ezt a képlinket? (Vissza nem vonható)")) return;

    setError(null);
    setBusy(`dimg:${imageId}`);

    const { error: delErr } = await supabase.from("action_images").delete().eq("id", imageId);
    if (delErr) {
      setBusy(null);
      return setError("Nem sikerült törölni a képlinket. (RLS delete policy?)");
    }

    setImages((prev) => prev.filter((i) => i.id !== imageId));
    setBusy(null);
  }

  async function deleteAction(actionId: string) {
    if (!confirm("Biztosan törlöd ezt az akciót? (Vissza nem vonható)")) return;

    setError(null);
    setBusy(`del:${actionId}`);

    const { error: delErr } = await supabase.from("actions").delete().eq("id", actionId);
    if (delErr) {
      setBusy(null);
      return setError("Nem sikerült törölni az akciót. (RLS delete policy?)");
    }

    setActions((prev) => prev.filter((a) => a.id !== actionId));
    setParticipants((prev) => prev.filter((p) => p.action_id !== actionId));
    setLogs((prev) => prev.filter((l) => l.action_id !== actionId));
    setImages((prev) => prev.filter((i) => i.action_id !== actionId));
    setExpandedId((cur) => (cur === actionId ? null : cur));

    setBusy(null);
  }

  if (loading) return <div className="p-6">Betöltés…</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Akciók</h1>
          <p className="text-sm text-white/70">
            Aktív tagok: {activeMembers.length} fő
            {me ? <span className="ml-2 text-white/50">(Te: status={me.status}, role={me.site_role})</span> : null}
          </p>
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
        <div className="p-3 rounded border border-red-500/30 bg-red-500/10 text-red-200">{error}</div>
      )}

      <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
        <h2 className="font-semibold">Új akció</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Akció neve"
            className="w-full px-3 py-2 rounded bg-black/30 border border-white/10"
          />
          <select
            value={newOrganizer}
            onChange={(e) => setNewOrganizer(e.target.value)}
            className="w-full px-3 py-2 rounded bg-black/30 border border-white/10"
          >
            <option value="">Szervező (aktív tagok)</option>
            {activeMembers.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.ic_name || "(nincs név)"}
              </option>
            ))}
          </select>
          <button
            onClick={createAction}
            disabled={busy === "create"}
            className="px-3 py-2 rounded bg-red-600 hover:bg-red-700 disabled:opacity-60"
          >
            {busy === "create" ? "Létrehozás…" : "Létrehozás"}
          </button>
        </div>
        <div className="text-xs text-white/60">
          Az akció létrehozásakor az aktív tagok automatikusan beimportálódnak a résztvevőlistába.
        </div>
      </div>

      <div className="space-y-3">
        {actions.length === 0 ? (
          <div className="text-white/70">Még nincs akció.</div>
        ) : (
          actions.map((a) => {
            const isOpen = expandedId === a.id;
            const organizerName = a.organizer_id ? memberName.get(a.organizer_id) : "—";

            const { f, gross, net, perHead } = totalsFor(a.id);

            const ps = participantsFor(a.id);
            const ls = logsFor(a.id);
            const ims = imagesFor(a.id);

            const preview = parseActionLog(logText[a.id] ?? "");
            const isLocked = a.is_closed;

            return (
              <div key={a.id} className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                <button
                  onClick={() => setExpandedId(isOpen ? null : a.id)}
                  className="w-full text-left p-4 hover:bg-white/5 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="font-semibold truncate">
                      {a.name}{" "}
                      {isLocked ? <span className="text-xs text-red-300 ml-2">(LEZÁRVA)</span> : null}
                    </div>
                    <div className="text-xs text-white/60 mt-1 flex flex-wrap gap-x-3 gap-y-1">
                      <span>Szervező: {organizerName || "—"}</span>
                      <span>Résztvevő: {f} fő</span>
                      <span>Bruttó: {gross.toLocaleString()}$</span>
                      <span>Nettó: {net.toLocaleString()}$</span>
                      <span>/fő: {perHead === null ? "—" : `${perHead.toLocaleString()}$`}</span>
                      <span>Autók: {a.cars_checked ? "✅" : "❌"}</span>
                    </div>
                  </div>
                  <div className="text-sm text-white/70">{isOpen ? "▲" : "▼"}</div>
                </button>

                {isOpen && (
                  <div className="p-4 space-y-6">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-semibold">
                        Résztvevők ({ps.length} sor){busy === `sync:${a.id}` ? " — szinkron…" : ""}
                      </h3>

                      <div className="flex items-center gap-3 flex-wrap justify-end">
                        <label className="inline-flex items-center gap-2 text-sm text-white/80">
                          <span>Autók rendben</span>
                          <input
                            type="checkbox"
                            checked={a.cars_checked}
                            disabled={!canManageCarsChecked || busy === `cars:${a.id}` || isLocked}
                            onChange={(e) => setCarsChecked(a.id, e.target.checked)}
                          />
                        </label>

                        {canCloseActions && (
                          <button
                            onClick={() => setClosed(a.id, !a.is_closed)}
                            disabled={busy === `close:${a.id}`}
                            className="px-3 py-2 rounded bg-white/10 hover:bg-white/15 disabled:opacity-60"
                          >
                            {busy === `close:${a.id}`
                              ? "Mentés…"
                              : a.is_closed
                              ? "Feloldás"
                              : "Lezárás"}
                          </button>
                        )}

                        <button
                          onClick={() => deleteAction(a.id)}
                          disabled={busy === `del:${a.id}`}
                          className="px-3 py-2 rounded bg-red-600 hover:bg-red-700 disabled:opacity-60"
                        >
                          {busy === `del:${a.id}` ? "Törlés…" : "Akció törlése"}
                        </button>
                      </div>
                    </div>

                    {isLocked && (
                      <div className="p-3 rounded border border-white/10 bg-black/20 text-sm text-white/70">
                        Az akció le van zárva: résztvevő pipálás / log / képek módosítása letiltva.
                      </div>
                    )}

                    {ps.length === 0 ? (
                      <div className="text-white/70">
                        Még nincs névsor (ha pár mp múlva sem jelenik meg, akkor a participant upsert RLS tiltja).
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded border border-white/10">
                        <table className="w-full text-sm">
                          <thead className="bg-white/5 text-white/70">
                            <tr>
                              <th className="text-left p-2">Név</th>
                              <th className="text-left p-2">Részt vett</th>
                              <th className="text-left p-2">Pénzt átvette</th>
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
                                const attendingBusy = busy === `att:${a.id}:${p.user_id}`;
                                const paidBusy = busy === `paid:${a.id}:${p.user_id}`;

                                return (
                                  <tr key={p.user_id} className="border-t border-white/10">
                                    <td className="p-2">{n}</td>
                                    <td className="p-2">
                                      <label className="inline-flex items-center gap-2">
                                        <input
                                          type="checkbox"
                                          checked={p.attended}
                                          disabled={attendingBusy || isLocked}
                                          onChange={(e) => setAttended(a.id, p.user_id, e.target.checked)}
                                        />
                                        <span className="text-white/80">{p.attended ? "Igen" : "Nem"}</span>
                                      </label>
                                    </td>
                                    <td className="p-2">
                                      <label className="inline-flex items-center gap-2">
                                        <input
                                          type="checkbox"
                                          checked={p.paid}
                                          disabled={!p.attended || paidBusy || isLocked}
                                          onChange={(e) => setPaid(a.id, p.user_id, e.target.checked)}
                                        />
                                        <span className={p.attended ? "text-white/80" : "text-white/40"}>
                                          {p.paid ? "Igen" : "Nem"}
                                        </span>
                                      </label>
                                    </td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                    )}

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold">Logok</h3>
                        <div className="text-xs text-white/60">{ls.length} db</div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <textarea
                            value={logText[a.id] ?? ""}
                            onChange={(e) => setLogText((prev) => ({ ...prev, [a.id]: e.target.value }))}
                            placeholder="Illeszd be a .log tartalmat…"
                            className="w-full h-40 px-3 py-2 rounded bg-black/30 border border-white/10"
                            disabled={isLocked}
                          />

                          <div className="text-xs text-white/60">
                            Előnézet: talált kazetta{" "}
                            <span className="text-white/80">{preview.cassetteCount}</span>, bruttó{" "}
                            <span className="text-white/80">{preview.gross.toLocaleString()}$</span>, nettó{" "}
                            <span className="text-white/80">{preview.net.toLocaleString()}$</span>
                          </div>

                          <div className="flex flex-wrap gap-2 items-center">
                            <input
                              type="file"
                              accept=".log"
                              className="text-sm"
                              disabled={isLocked}
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) void loadLogFile(a.id, f);
                              }}
                            />
                            <button
                              onClick={() => uploadLog(a.id)}
                              disabled={busy === `log:${a.id}` || isLocked}
                              className="px-3 py-2 rounded bg-red-600 hover:bg-red-700 disabled:opacity-60"
                            >
                              {busy === `log:${a.id}` ? "Feltöltés…" : "Log feltöltés"}
                            </button>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="text-sm text-white/80">Log lista</div>
                          <div className="rounded border border-white/10 max-h-64 overflow-auto">
                            {ls.length === 0 ? (
                              <div className="p-3 text-white/70">Még nincs log feltöltve.</div>
                            ) : (
                              <table className="w-full text-sm">
                                <thead className="bg-white/5 text-white/70">
                                  <tr>
                                    <th className="text-left p-2">Idő</th>
                                    <th className="text-left p-2">Kazetta</th>
                                    <th className="text-left p-2">Bruttó</th>
                                    <th className="text-left p-2">Nettó</th>
                                    <th className="text-left p-2">Feltöltő</th>
                                    <th className="text-right p-2">Törlés</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {ls.map((l) => (
                                    <tr key={l.id} className="border-t border-white/10">
                                      <td className="p-2 text-white/70">{formatDateTime(l.created_at)}</td>
                                      <td className="p-2">{l.cassette_count ?? "—"}</td>
                                      <td className="p-2">{(Number(l.gross_amount) || 0).toLocaleString()}$</td>
                                      <td className="p-2">{(Number(l.net_amount) || 0).toLocaleString()}$</td>
                                      <td className="p-2 text-white/70">
                                        {l.uploaded_by ? memberName.get(l.uploaded_by) || "—" : "—"}
                                      </td>
                                      <td className="p-2 text-right">
                                        <button
                                          onClick={() => deleteLog(l.id)}
                                          disabled={busy === `dlog:${l.id}` || isLocked}
                                          className="px-2 py-1 rounded bg-white/10 hover:bg-white/15 disabled:opacity-60"
                                        >
                                          {busy === `dlog:${l.id}` ? "…" : "Törlés"}
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </div>
                          <div className="text-xs text-white/50">
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold">Bizonyító képek (Imgur)</h3>
                        <button
                          onClick={() => addImgur(a.id)}
                          disabled={busy === `img:${a.id}` || isLocked}
                          className="px-3 py-2 rounded bg-white/10 hover:bg-white/15 disabled:opacity-60"
                        >
                          {busy === `img:${a.id}` ? "Mentés…" : "Imgur link hozzáadás"}
                        </button>
                      </div>

                      {ims.length === 0 ? (
                        <div className="text-white/70">Még nincs kép.</div>
                      ) : (
                        <div className="space-y-2">
                          {ims.map((im) => (
                            <div
                              key={im.id}
                              className="p-3 rounded border border-white/10 bg-black/20 flex items-start justify-between gap-3"
                            >
                              <div className="min-w-0">
                                <a
                                  href={im.imgur_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-sm break-all hover:underline"
                                >
                                  {im.imgur_url}
                                </a>
                                <div className="text-xs text-white/60 mt-1">
                                  {formatDateTime(im.created_at)} — feltöltötte:{" "}
                                  <span className="text-white/80">
                                    {im.uploaded_by ? memberName.get(im.uploaded_by) || "—" : "—"}
                                  </span>
                                </div>
                              </div>

                              <button
                                onClick={() => deleteImgur(im.id)}
                                disabled={busy === `dimg:${im.id}` || isLocked}
                                className="px-2 py-1 rounded bg-white/10 hover:bg-white/15 disabled:opacity-60 shrink-0"
                              >
                                {busy === `dimg:${im.id}` ? "…" : "Törlés"}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
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