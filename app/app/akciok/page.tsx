"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { hasActionManagerPermission } from "@/lib/permissions";

type MyProfile = {
  user_id: string;
  ic_name: string | null;
  status: "preinvite" | "pending" | "active" | "leadership" | "inactive";
  site_role: "user" | "admin" | "owner";
  rank_id?: string | null;
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

function extractMoneyFromLine(line: string) {
  const normalized = line.replace(/\./g, "");
  const match =
    normalized.match(/([\d\s]+)\s*\$/) ||
    normalized.match(/([\d\s]+)\s*dollárért/i) ||
    normalized.match(/([\d\s]+)\s*dollár/i);

  if (!match) return null;

  const value = Number((match[1] || "").replace(/\s+/g, ""));
  return Number.isFinite(value) ? value : null;
}

function extractAntiqueItemCount(line: string) {
  const normalized = line.replace(/\./g, "");
  const match = normalized.match(/eladtál\s+(\d+)\s+darab\s+tárgyat/i);
  if (!match) return 0;

  const count = Number(match[1]);
  return Number.isFinite(count) ? count : 0;
}

function parseActionLog(raw: string) {
  const lines = raw.split(/\r?\n/);

  let cassetteCount = 0;
  let cassetteGross = 0;

  let antiqueCount = 0;
  let antiqueGross = 0;

  let goldBarCount = 0;
  let goldBarGross = 0;

  const antiqueLines: string[] = [];
  const goldBarLines: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (
      line.includes("A kazettában") &&
      (line.includes("$") || /dollár/i.test(line)) &&
      line.includes("volt")
    ) {
      const value = extractMoneyFromLine(line);
      if (value !== null) {
        cassetteGross += value;
        cassetteCount += 1;
        continue;
      }
    }

    if (
      line.includes("Sikeresen eladtál") &&
      line.toLowerCase().includes("egy aranyrudat") &&
      (/dollárért/i.test(line) || line.includes("$"))
    ) {
      const value = extractMoneyFromLine(line);
      if (value !== null) {
        goldBarGross += value;
        goldBarCount += 1;
        goldBarLines.push(line);
        continue;
      }
    }

    if (
      line.includes("Sikeresen eladtál") &&
      line.includes("darab tárgyat") &&
      (/dollárért/i.test(line) || line.includes("$"))
    ) {
      const value = extractMoneyFromLine(line);
      const itemCount = extractAntiqueItemCount(line);

      if (value !== null) {
        antiqueGross += value;
        antiqueCount += itemCount;
        antiqueLines.push(line);
        continue;
      }
    }
  }

  const gross = cassetteGross + antiqueGross + goldBarGross;
  const net = Math.round(gross * 0.9);

  return {
    cassetteCount,
    cassetteGross,
    antiqueCount,
    antiqueGross,
    antiqueNet: Math.round(antiqueGross * 0.9),
    goldBarCount,
    goldBarGross,
    goldBarNet: Math.round(goldBarGross * 0.9),
    gross,
    net,
    antiqueLines,
    goldBarLines,
  };
}

export default function AkciokPage() {
  const supabase = createClient();

  const [me, setMe] = useState<MyProfile | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [myRankName, setMyRankName] = useState<string | null>(null);

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
  const [selectedLogFileName, setSelectedLogFileName] = useState<Record<string, string>>({});

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

  const hasActionManagerAccess = useMemo(() => {
    return hasActionManagerPermission(me, myRankName);
  }, [me, myRankName]);

  const canCreateActions = hasActionManagerAccess;
  const canManageParticipants = hasActionManagerAccess;
  const canManageCarsChecked = hasActionManagerAccess;
  const canCloseActions = hasActionManagerAccess;
  const canDeleteActions = hasActionManagerAccess;

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
    setMe(myProfile as any);

    if ((myProfile as any)?.rank_id) {
      const { data: myRankRow } = await supabase
        .from("ranks")
        .select("name")
        .eq("id", (myProfile as any).rank_id)
        .maybeSingle();

      setMyRankName(myRankRow?.name ?? null);
    } else {
      setMyRankName(null);
    }

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
    const actionLogs = logsFor(actionId);

    const parsedLogs = actionLogs.map((l) => parseActionLog(l.raw_text));

    const gross = parsedLogs.reduce((acc, l) => acc + l.gross, 0);
    const net = parsedLogs.reduce((acc, l) => acc + l.net, 0);
    const cassetteCount = parsedLogs.reduce((acc, l) => acc + l.cassetteCount, 0);
    const antiqueCount = parsedLogs.reduce((acc, l) => acc + l.antiqueCount, 0);
    const antiqueGross = parsedLogs.reduce((acc, l) => acc + l.antiqueGross, 0);
    const antiqueNet = Math.round(antiqueGross * 0.9);
    const goldBarCount = parsedLogs.reduce((acc, l) => acc + l.goldBarCount, 0);
    const goldBarGross = parsedLogs.reduce((acc, l) => acc + l.goldBarGross, 0);
    const goldBarNet = Math.round(goldBarGross * 0.9);

    const perHead = f > 0 ? Math.floor(net / f) : null;

    return {
      f,
      gross,
      net,
      perHead,
      cassetteCount,
      antiqueCount,
      antiqueGross,
      antiqueNet,
      goldBarCount,
      goldBarGross,
      goldBarNet,
    };
  }

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
    if (!canCreateActions) return setError("Akciót csak vezetőség hozhat létre.");
    if (!newName.trim()) return setError("Adj meg egy akció nevet.");
    if (!me) return setError("Nincs bejelentkezve.");
    if (activeMembers.length === 0) return setError("Nincs aktív tag betöltve — frissíts rá.");

    setBusy("create");

    let data: ActionRow | null = null;

    try {
      const json = await apiFetch("/api/actions/create", {
        method: "POST",
        body: JSON.stringify({ name: newName.trim(), organizer_id: newOrganizer || null }),
      });
      data = (json?.row as ActionRow) ?? null;
    } catch (err: any) {
      setBusy(null);
      return setError(err?.message || "Nem sikerült létrehozni az akciót.");
    }

    if (!data) {
      setBusy(null);
      return setError("Nem sikerült létrehozni az akciót.");
    }

    const actionId = data.id as string;

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
    if (!canManageParticipants) return setError("Résztvevőket csak vezetőség kezelhet.");

    const a = actions.find((x) => x.id === actionId);
    if (a?.is_closed) return setError("Ez az akció le van zárva.");

    setError(null);
    setBusy(`att:${actionId}:${userId}`);

    try {
      await apiFetch("/api/actions/set-participant", {
        method: "POST",
        body: JSON.stringify({ action_id: actionId, user_id: userId, attended }),
      });
    } catch (err: any) {
      setBusy(null);
      return setError(err?.message || "Nem sikerült menteni.");
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
    if (!canManageParticipants) return setError("Résztvevőket csak vezetőség kezelhet.");

    const a = actions.find((x) => x.id === actionId);
    if (a?.is_closed) return setError("Ez az akció le van zárva.");

    setError(null);
    setBusy(`paid:${actionId}:${userId}`);

    try {
      await apiFetch("/api/actions/set-participant", {
        method: "POST",
        body: JSON.stringify({ action_id: actionId, user_id: userId, paid }),
      });
    } catch (err: any) {
      setBusy(null);
      return setError(err?.message || "Nem sikerült menteni.");
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

    try {
      const json = await apiFetch("/api/actions/set-cars", {
        method: "POST",
        body: JSON.stringify({ action_id: actionId, cars_checked: value }),
      });
      const data = json?.row as ActionRow;
      setActions((prev) => prev.map((x) => (x.id === actionId ? data : x)));
    } catch (err: any) {
      setBusy(null);
      return setError(err?.message || "Nem sikerült frissíteni.");
    }
    setBusy(null);
  }

  async function setClosed(actionId: string, value: boolean) {
    if (!canCloseActions) return setError("Nincs jogosultságod lezárni/feloldani.");

    setError(null);
    setBusy(`close:${actionId}`);

    try {
      const json = await apiFetch("/api/actions/set-closed", {
        method: "POST",
        body: JSON.stringify({ action_id: actionId, is_closed: value }),
      });
      const data = json?.row as ActionRow;
      setActions((prev) => prev.map((x) => (x.id === actionId ? data : x)));
    } catch (err: any) {
      setBusy(null);
      return setError(err?.message || "Nem sikerült menteni a lezárást.");
    }
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
    try {
      const json = await apiFetch("/api/actions/upload-log", {
        method: "POST",
        body: JSON.stringify({ action_id: actionId, raw_text: raw }),
      });
      const data = json?.row as ActionLogRow;
      setLogs((prev) => [data, ...prev]);
    } catch (err: any) {
      setBusy(null);
      return setError(err?.message || "Nem sikerült feltölteni a logot.");
    }

    setLogText((prev) => ({ ...prev, [actionId]: "" }));
    setSelectedLogFileName((prev) => ({ ...prev, [actionId]: "" }));
    setBusy(null);
  }

  async function deleteLog(logId: string) {
    if (!confirm("Biztosan törlöd ezt a logot? (Vissza nem vonható)")) return;

    setError(null);
    setBusy(`dlog:${logId}`);

    try {
      await apiFetch("/api/actions/delete-log", {
        method: "POST",
        body: JSON.stringify({ log_id: logId }),
      });
    } catch (err: any) {
      setBusy(null);
      return setError(err?.message || "Nem sikerült törölni a logot.");
    }

    setLogs((prev) => prev.filter((l) => l.id !== logId));
    setBusy(null);
  }

  async function loadLogFile(actionId: string, file: File) {
    const text = await file.text();
    setLogText((prev) => ({ ...prev, [actionId]: text }));
    setSelectedLogFileName((prev) => ({ ...prev, [actionId]: file.name }));
  }

  async function addImgur(actionId: string) {
    if (!me) return setError("Nincs bejelentkezve.");

    const a = actions.find((x) => x.id === actionId);
    if (a?.is_closed) return setError("Ez az akció le van zárva. (Nem lehet képet hozzáadni.)");

    setError(null);
    const url = prompt("Adj meg egy Imgur linket (imgur.com vagy i.imgur.com):")?.trim();
    if (!url) return;
    if (!/^(https?:\/\/)?(i\.)?imgur\.com\//i.test(url)) {
      return setError("Csak Imgur link engedélyezett.");
    }

    setBusy(`img:${actionId}`);

    try {
      const json = await apiFetch("/api/actions/add-image", {
        method: "POST",
        body: JSON.stringify({ action_id: actionId, imgur_url: url }),
      });
      const data = json?.row as ActionImageRow;
      setImages((prev) => [data, ...prev]);
    } catch (err: any) {
      setBusy(null);
      return setError(err?.message || "Nem sikerült hozzáadni a képet.");
    }
    setBusy(null);
  }

  async function deleteImgur(imageId: string) {
    if (!confirm("Biztosan törlöd ezt a képlinket? (Vissza nem vonható)")) return;

    setError(null);
    setBusy(`dimg:${imageId}`);

    try {
      await apiFetch("/api/actions/delete-image", {
        method: "POST",
        body: JSON.stringify({ image_id: imageId }),
      });
    } catch (err: any) {
      setBusy(null);
      return setError(err?.message || "Nem sikerült törölni a képlinket.");
    }

    setImages((prev) => prev.filter((i) => i.id !== imageId));
    setBusy(null);
  }

  async function deleteAction(actionId: string) {
    if (!canDeleteActions) return setError("Akciót csak vezetőség törölhet.");
    if (!confirm("Biztosan törlöd ezt az akciót? (Vissza nem vonható)")) return;

    setError(null);
    setBusy(`del:${actionId}`);

    try {
      await apiFetch("/api/actions/delete", {
        method: "POST",
        body: JSON.stringify({ action_id: actionId }),
      });
    } catch (err: any) {
      setBusy(null);
      return setError(err?.message || "Nem sikerült törölni az akciót.");
    }

    setActions((prev) => prev.filter((a) => a.id !== actionId));
    setParticipants((prev) => prev.filter((p) => p.action_id !== actionId));
    setLogs((prev) => prev.filter((l) => l.action_id !== actionId));
    setImages((prev) => prev.filter((i) => i.action_id !== actionId));
    setExpandedId((cur) => (cur === actionId ? null : cur));

    setBusy(null);
  }

  if (loading) {
    return (
      <div className="lmr-page lmr-page-wide">
        <div className="px-1 py-6 text-sm text-white/70">Betöltés…</div>
      </div>
    );
  }

  return (
    <div className="lmr-page lmr-page-wide">
      <section className="lmr-hero">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-4xl">
            <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/45">
              La Main Rouge
            </div>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-white md:text-4xl">
              Akciók
            </h1>
            <div className="mt-4 h-[2px] w-12 rounded-full bg-red-600/80" />
            <p className="mt-4 max-w-3xl text-sm leading-7 text-white/70">
              Akciók szervezése, logok és képek feltöltése egységesített felületen. Aktív tagok:{" "}
              {activeMembers.length} fő
            </p>
          </div>

          <button
            onClick={loadAll}
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

      {canCreateActions ? (
        <section className="mt-10">
          <h2 className="text-2xl font-semibold text-white">Új akció</h2>
          <div className="mt-4 h-[2px] w-12 rounded-full bg-red-600/80" />

          <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Akció neve"
              className="w-full rounded-2xl border px-3.5 py-3"
            />
            <select
              value={newOrganizer}
              onChange={(e) => setNewOrganizer(e.target.value)}
              className="w-full rounded-2xl border px-3.5 py-3"
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
              className="rounded-2xl border border-red-400/20 bg-red-600 px-4 py-3 font-semibold text-white hover:bg-red-500 disabled:opacity-60"
            >
              {busy === "create" ? "Létrehozás…" : "Létrehozás"}
            </button>
          </div>
        </section>
      ) : (
        <div className="mt-8 text-sm text-white/65">
          Új akciót csak a vezetőség hozhat létre. Te meglévő, nem lezárt akciókhoz tölthetsz fel
          logot és Imgur linket.
        </div>
      )}

      <section className="mt-12">
        <h2 className="text-2xl font-semibold text-white">Akciólista</h2>
        <div className="mt-4 h-[2px] w-12 rounded-full bg-red-600/80" />

        <div className="mt-6 space-y-5">
          {actions.length === 0 ? (
            <div className="text-white/70">Még nincs akció.</div>
          ) : (
            actions.map((a) => {
              const isOpen = expandedId === a.id;
              const organizerName = a.organizer_id ? memberName.get(a.organizer_id) : "—";

              const {
                f,
                gross,
                net,
                perHead,
                cassetteCount,
                antiqueCount,
                antiqueNet,
                goldBarCount,
                goldBarNet,
              } = totalsFor(a.id);

              const ps = participantsFor(a.id);
              const ls = logsFor(a.id);
              const ims = imagesFor(a.id);

              const preview = parseActionLog(logText[a.id] ?? "");
              const isLocked = a.is_closed;

              return (
                <div key={a.id} className="border-b border-white/10 pb-5">
                  <button
                    onClick={() => setExpandedId(isOpen ? null : a.id)}
                    className="flex w-full items-center justify-between gap-3 text-left"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-white">
                        {a.name}
                        {isLocked ? (
                          <span className="ml-2 text-xs text-red-300">(LEZÁRVA)</span>
                        ) : null}
                      </div>

                      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-white/60">
                        <span>Szervező: {organizerName || "—"}</span>
                        <span>Résztvevő: {f} fő</span>
                        <span>Kazetta: {cassetteCount} db</span>
                        <span>Aranyrúd: {goldBarCount} db</span>
                        <span>Antik: {antiqueCount} db</span>
                        <span>Bruttó: {gross.toLocaleString()}$</span>
                        <span>Nettó: {net.toLocaleString()}$</span>
                        {goldBarCount > 0 ? <span>Aranyrúd nettó: {goldBarNet.toLocaleString()}$</span> : null}
                        {antiqueCount > 0 ? <span>Antik nettó: {antiqueNet.toLocaleString()}$</span> : null}
                        <span>/fő: {perHead === null ? "—" : `${perHead.toLocaleString()}$`}</span>
                        <span>Autók: {a.cars_checked ? "✅" : "❌"}</span>
                      </div>
                    </div>

                    <div className="text-sm text-white/70">{isOpen ? "▲" : "▼"}</div>
                  </button>

                  <div className="mt-4 h-[2px] w-10 rounded-full bg-red-600/70" />

                  {isOpen && (
                    <div className="space-y-10 pt-6">
                      <section>
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <h3 className="text-xl font-semibold text-white">
                              Résztvevők ({ps.length} sor)
                              {busy === `sync:${a.id}` ? " — szinkron…" : ""}
                            </h3>
                            <div className="mt-3 h-[2px] w-10 rounded-full bg-red-600/70" />
                          </div>

                          <div className="flex flex-wrap items-center justify-end gap-3">
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
                                className="rounded-2xl border border-white/12 bg-white/[0.05] px-4 py-2.5 text-sm hover:bg-white/[0.08] disabled:opacity-60"
                              >
                                {busy === `close:${a.id}`
                                  ? "Mentés…"
                                  : a.is_closed
                                  ? "Feloldás"
                                  : "Lezárás"}
                              </button>
                            )}

                            {canDeleteActions && (
                              <button
                                onClick={() => deleteAction(a.id)}
                                disabled={busy === `del:${a.id}`}
                                className="rounded-2xl border border-red-400/20 bg-red-600 px-4 py-3 font-semibold text-white hover:bg-red-500 disabled:opacity-60"
                              >
                                {busy === `del:${a.id}` ? "Törlés…" : "Akció törlése"}
                              </button>
                            )}
                          </div>
                        </div>

                        {isLocked && (
                          <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/70">
                            Az akció le van zárva: résztvevő pipálás / log / képek módosítása letiltva.
                          </div>
                        )}

                        {ps.length === 0 ? (
                          <div className="mt-4 text-white/70">
                            Még nincs névsor (ha pár mp múlva sem jelenik meg, akkor a participant
                            upsert RLS tiltja).
                          </div>
                        ) : (
                          <div className="mt-5 overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead className="border-b border-white/10 text-white/70">
                                <tr>
                                  <th className="p-2 text-left">Név</th>
                                  <th className="p-2 text-left">Részt vett</th>
                                  <th className="p-2 text-left">Pénzt átvette</th>
                                </tr>
                              </thead>
                              <tbody>
                                {ps
                                  .slice()
                                  .sort((x, y) =>
                                    (memberName.get(x.user_id) || "").localeCompare(
                                      memberName.get(y.user_id) || ""
                                    )
                                  )
                                  .map((p) => {
                                    const n = memberName.get(p.user_id) || "(nincs név)";
                                    const attendingBusy = busy === `att:${a.id}:${p.user_id}`;
                                    const paidBusy = busy === `paid:${a.id}:${p.user_id}`;

                                    return (
                                      <tr key={p.user_id} className="border-b border-white/8">
                                        <td className="p-2 text-white">{n}</td>
                                        <td className="p-2">
                                          <label className="inline-flex items-center gap-2">
                                            <input
                                              type="checkbox"
                                              checked={p.attended}
                                              disabled={!canManageParticipants || attendingBusy || isLocked}
                                              onChange={(e) =>
                                                setAttended(a.id, p.user_id, e.target.checked)
                                              }
                                            />
                                            <span className="text-white/80">
                                              {p.attended ? "Igen" : "Nem"}
                                            </span>
                                          </label>
                                        </td>
                                        <td className="p-2">
                                          <label className="inline-flex items-center gap-2">
                                            <input
                                              type="checkbox"
                                              checked={p.paid}
                                              disabled={!canManageParticipants || !p.attended || paidBusy || isLocked}
                                              onChange={(e) =>
                                                setPaid(a.id, p.user_id, e.target.checked)
                                              }
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
                      </section>

                      <section>
                        <div>
                          <h3 className="text-xl font-semibold text-white">Logok</h3>
                          <div className="mt-3 h-[2px] w-10 rounded-full bg-red-600/70" />
                          <div className="mt-2 text-xs text-white/60">{ls.length} db</div>
                        </div>

                        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(520px,1fr)_minmax(520px,1fr)]">
                          <div className="min-w-[520px] space-y-3">
                            <textarea
                              value={logText[a.id] ?? ""}
                              onChange={(e) =>
                                setLogText((prev) => ({ ...prev, [a.id]: e.target.value }))
                              }
                              placeholder="Illeszd be a .log tartalmat…"
                              className="h-40 w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-2"
                              disabled={isLocked}
                            />

                            <div className="space-y-1 text-xs text-white/60">
                              <div>
                                Előnézet: kazetta{" "}
                                <span className="text-white/80">{preview.cassetteCount}</span>,
                                aranyrúd <span className="text-white/80">{preview.goldBarCount}</span>,
                                antik <span className="text-white/80">{preview.antiqueCount}</span>,
                                bruttó <span className="text-white/80">{preview.gross.toLocaleString()}$</span>,
                                nettó <span className="text-white/80">{preview.net.toLocaleString()}$</span>
                              </div>
                              {preview.goldBarCount > 0 ? (
                                <div>
                                  Aranyrúd nettó:{" "}
                                  <span className="text-white/80">
                                    {preview.goldBarNet.toLocaleString()}$
                                  </span>
                                </div>
                              ) : null}
                              {preview.antiqueCount > 0 ? (
                                <div>
                                  Antik nettó:{" "}
                                  <span className="text-white/80">
                                    {preview.antiqueNet.toLocaleString()}$
                                  </span>
                                </div>
                              ) : null}
                            </div>

                            <div className="flex flex-wrap items-center gap-3">
                              <input
                                id={`log-file-${a.id}`}
                                type="file"
                                accept=".log"
                                className="hidden"
                                disabled={isLocked}
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) {
                                    void loadLogFile(a.id, f);
                                  } else {
                                    setSelectedLogFileName((prev) => ({ ...prev, [a.id]: "" }));
                                  }
                                }}
                              />

                              <label
                                htmlFor={`log-file-${a.id}`}
                                className={`inline-flex cursor-pointer items-center rounded-2xl border border-white/12 bg-white/[0.05] px-4 py-2.5 text-sm text-white transition hover:bg-white/[0.08] ${
                                  isLocked ? "pointer-events-none opacity-60" : ""
                                }`}
                              >
                                Tallózás
                              </label>

                              <span className="text-sm text-white/60">
                                {selectedLogFileName[a.id] || "Nincs kijelölve fájl."}
                              </span>

                              <button
                                onClick={() => uploadLog(a.id)}
                                disabled={busy === `log:${a.id}` || isLocked}
                                className="rounded-2xl border border-red-400/20 bg-red-600 px-4 py-3 font-semibold text-white hover:bg-red-500 disabled:opacity-60"
                              >
                                {busy === `log:${a.id}` ? "Feltöltés…" : "Log feltöltés"}
                              </button>
                            </div>
                          </div>

                          <div className="min-w-[520px] space-y-3">
                            <div className="text-sm text-white/80">Log lista</div>
                            <div className="max-h-64 overflow-auto border border-white/10">
                              {ls.length === 0 ? (
                                <div className="p-3 text-white/70">Még nincs log feltöltve.</div>
                              ) : (
                                <table className="w-full min-w-[700px] text-sm">
                                  <thead className="border-b border-white/10 text-white/70">
                                    <tr>
                                      <th className="p-2 text-left">Idő</th>
                                      <th className="p-2 text-left">Kazetta</th>
                                      <th className="p-2 text-left">Aranyrúd</th>
                                      <th className="p-2 text-left">Antik</th>
                                      <th className="p-2 text-left">Bruttó</th>
                                      <th className="p-2 text-left">Nettó</th>
                                      <th className="p-2 text-left">Feltöltő</th>
                                      <th className="p-2 text-right">Törlés</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {ls.map((l) => {
                                      const parsedLog = parseActionLog(l.raw_text);

                                      return (
                                        <Fragment key={l.id}>
                                          <tr className="border-b border-white/8 align-top">
                                            <td className="p-2 text-white/70">
                                              {formatDateTime(l.created_at)}
                                            </td>
                                            <td className="p-2">{parsedLog.cassetteCount || "—"}</td>
                                            <td className="p-2">{parsedLog.goldBarCount || "—"}</td>
                                            <td className="p-2">{parsedLog.antiqueCount || "—"}</td>
                                            <td className="p-2">
                                              {parsedLog.gross.toLocaleString()}$
                                            </td>
                                            <td className="p-2">
                                              {parsedLog.net.toLocaleString()}$
                                            </td>
                                            <td className="p-2 text-white/70">
                                              {l.uploaded_by
                                                ? memberName.get(l.uploaded_by) || "—"
                                                : "—"}
                                            </td>
                                            <td className="p-2 text-right">
                                              <button
                                                onClick={() => deleteLog(l.id)}
                                                disabled={busy === `dlog:${l.id}` || isLocked}
                                                className="rounded bg-white/10 px-2 py-1 hover:bg-white/15 disabled:opacity-60"
                                              >
                                                {busy === `dlog:${l.id}` ? "…" : "Törlés"}
                                              </button>
                                            </td>
                                          </tr>

                                          {parsedLog.goldBarLines.map((goldLine, idx) => (
                                            <tr
                                              key={`${l.id}:gold:${idx}`}
                                              className="border-b border-white/8 bg-black/10"
                                            >
                                              <td className="p-2 text-xs text-white/45">Aranyrúd</td>
                                              <td className="p-2 text-xs text-white/45" colSpan={6}>
                                                {goldLine}
                                              </td>
                                              <td className="p-2" />
                                            </tr>
                                          ))}

                                          {parsedLog.antiqueLines.map((antiqueLine, idx) => (
                                            <tr
                                              key={`${l.id}:antique:${idx}`}
                                              className="border-b border-white/8 bg-black/10"
                                            >
                                              <td className="p-2 text-xs text-white/45">Antik</td>
                                              <td className="p-2 text-xs text-white/45" colSpan={6}>
                                                {antiqueLine}
                                              </td>
                                              <td className="p-2" />
                                            </tr>
                                          ))}
                                        </Fragment>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              )}
                            </div>
                          </div>
                        </div>
                      </section>

                      <section>
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-xl font-semibold text-white">Bizonyító képek (Imgur)</h3>
                            <div className="mt-3 h-[2px] w-10 rounded-full bg-red-600/70" />
                          </div>

                          <button
                            onClick={() => addImgur(a.id)}
                            disabled={busy === `img:${a.id}` || isLocked}
                            className="rounded-2xl border border-white/12 bg-white/[0.05] px-4 py-2.5 text-sm hover:bg-white/[0.08] disabled:opacity-60"
                          >
                            {busy === `img:${a.id}` ? "Mentés…" : "Imgur link hozzáadás"}
                          </button>
                        </div>

                        {ims.length === 0 ? (
                          <div className="mt-4 text-white/70">Még nincs kép.</div>
                        ) : (
                          <div className="mt-5 space-y-3">
                            {ims.map((im) => (
                              <div
                                key={im.id}
                                className="flex items-start justify-between gap-3 border-b border-white/8 pb-3"
                              >
                                <div className="min-w-0">
                                  <a
                                    href={im.imgur_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="break-all text-sm hover:underline"
                                  >
                                    {im.imgur_url}
                                  </a>
                                  <div className="mt-1 text-xs text-white/60">
                                    {formatDateTime(im.created_at)} — feltöltötte:{" "}
                                    <span className="text-white/80">
                                      {im.uploaded_by ? memberName.get(im.uploaded_by) || "—" : "—"}
                                    </span>
                                  </div>
                                </div>

                                <button
                                  onClick={() => deleteImgur(im.id)}
                                  disabled={busy === `dimg:${im.id}` || isLocked}
                                  className="shrink-0 rounded bg-white/10 px-2 py-1 hover:bg-white/15 disabled:opacity-60"
                                >
                                  {busy === `dimg:${im.id}` ? "…" : "Törlés"}
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </section>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}