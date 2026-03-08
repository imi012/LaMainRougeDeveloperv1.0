"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isLeadershipProfile } from "@/lib/permissions";

type ViewerProfile = {
  user_id: string;
  status: string | null;
  site_role: string | null;
};

type MemberRow = {
  user_id: string;
  ic_name: string | null;
  discord_name: string | null;
  status: string | null;
  site_role: string | null;
};

type ParkingSettings = {
  id: number;
  parking_house_info: string | null;
  hangar_info: string | null;
  image_path: string | null;
};

type ParkingAssignment = {
  id: string;
  area: "garage" | "hangar";
  slot_key: string;
  user_id: string | null;
  updated_at: string | null;
};

type ParkingResponse = {
  ok: boolean;
  message?: string;
  viewer: ViewerProfile;
  settings: ParkingSettings;
  assignments: ParkingAssignment[];
  members: MemberRow[];
};

type SummaryRow = {
  user_id: string;
  ic_name: string;
  discord_name: string | null;
  hangar_slots: string[];
  garage_slots: string[];
};

const GARAGE_LETTERS = "ABCDEFGHIJKLMNOP".split("");
const GARAGE_ROWS = [1, 2, 3, 4, 5];
const HANGAR_SLOTS = Array.from({ length: 67 }, (_, index) => String(index + 1));

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function sortSlotKeys(a: string, b: string) {
  const parse = (value: string) => {
    const match = value.match(/^([A-Z]?)(\d+)$/);
    return {
      letter: match?.[1] || "",
      num: Number(match?.[2] || 0),
    };
  };
  const left = parse(a);
  const right = parse(b);
  if (left.letter !== right.letter) return left.letter.localeCompare(right.letter, "hu");
  return left.num - right.num;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("hu-HU");
}

export default function ParkolasPage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingError, setSavingError] = useState<string | null>(null);
  const [viewer, setViewer] = useState<ViewerProfile | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [assignments, setAssignments] = useState<ParkingAssignment[]>([]);
  const [settings, setSettings] = useState<ParkingSettings>({
    id: 1,
    parking_house_info:
      "A parkoló számozások a betű jelzéssel szemben állva, balról kezdődik. A betűs parkolókból mindenki maximum 2-t kérhet.",
    hangar_info: "",
    image_path: "/parkolasrend.png",
  });
  const [draftSettings, setDraftSettings] = useState({
    parking_house_info:
      "A parkoló számozások a betű jelzéssel szemben állva, balról kezdődik. A betűs parkolókból mindenki maximum 2-t kérhet.",
    hangar_info: "",
  });
  const [editMode, setEditMode] = useState(false);
  const [savingSlotKey, setSavingSlotKey] = useState<string | null>(null);
  const [savingInfo, setSavingInfo] = useState(false);

  const canEdit = useMemo(() => isLeadershipProfile(viewer), [viewer]);

  const memberMap = useMemo(() => {
    const map = new Map<string, MemberRow>();
    for (const member of members) {
      map.set(member.user_id, member);
    }
    return map;
  }, [members]);

  const assignmentMap = useMemo(() => {
    const map = new Map<string, ParkingAssignment>();
    for (const item of assignments) {
      map.set(`${item.area}:${item.slot_key}`, item);
    }
    return map;
  }, [assignments]);

  const summaryRows = useMemo<SummaryRow[]>(() => {
    const rows = new Map<string, SummaryRow>();

    for (const member of members) {
      rows.set(member.user_id, {
        user_id: member.user_id,
        ic_name: member.ic_name || "Névtelen tag",
        discord_name: member.discord_name,
        hangar_slots: [],
        garage_slots: [],
      });
    }

    for (const assignment of assignments) {
      if (!assignment.user_id) continue;
      const row = rows.get(assignment.user_id);
      if (!row) continue;
      if (assignment.area === "hangar") {
        row.hangar_slots.push(assignment.slot_key);
      } else {
        row.garage_slots.push(assignment.slot_key);
      }
    }

    return Array.from(rows.values())
      .map((row) => ({
        ...row,
        hangar_slots: [...row.hangar_slots].sort(sortSlotKeys),
        garage_slots: [...row.garage_slots].sort(sortSlotKeys),
      }))
      .filter((row) => row.hangar_slots.length > 0 || row.garage_slots.length > 0)
      .sort((a, b) => a.ic_name.localeCompare(b.ic_name, "hu"));
  }, [assignments, members]);

  async function apiFetch(input: string, init?: RequestInit) {
    const { data: sessData, error: sessErr } = await supabase.auth.getSession();
    if (sessErr) throw new Error(sessErr.message);
    const token = sessData.session?.access_token;
    if (!token) throw new Error("Nincs bejelentkezve.");

    const res = await fetch(input, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(init?.headers || {}),
      },
      cache: "no-store",
    });

    const text = await res.text();
    const json = text ? JSON.parse(text) : null;

    if (!res.ok || json?.ok === false) {
      throw new Error(json?.message || text || "Hiba történt.");
    }

    return json;
  }

  async function loadPage() {
    setLoading(true);
    setError(null);

    try {
      const json = (await apiFetch("/api/parking/get")) as ParkingResponse;
      setViewer(json.viewer);
      setMembers(json.members || []);
      setAssignments(json.assignments || []);
      setSettings(json.settings);
      setDraftSettings({
        parking_house_info: json.settings?.parking_house_info || "",
        hangar_info: json.settings?.hangar_info || "",
      });
    } catch (e: any) {
      setError(e?.message || "Nem sikerült betölteni a parkolási rendet.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveInfo() {
    if (!canEdit || !editMode) return;
    setSavingInfo(true);
    setSavingError(null);

    try {
      await apiFetch("/api/parking/update-info", {
        method: "POST",
        body: JSON.stringify(draftSettings),
      });
      setSettings((prev) => ({
        ...prev,
        parking_house_info: draftSettings.parking_house_info,
        hangar_info: draftSettings.hangar_info,
      }));
    } catch (e: any) {
      setSavingError(e?.message || "Nem sikerült menteni az információs panelt.");
    } finally {
      setSavingInfo(false);
    }
  }

  async function updateSlot(area: "garage" | "hangar", slotKey: string, userId: string) {
    if (!canEdit || !editMode) return;

    const normalizedUserId = userId || null;
    const previous = assignments;
    setSavingSlotKey(`${area}:${slotKey}`);
    setSavingError(null);

    setAssignments((current) => {
      const withoutCurrent = current.filter((item) => !(item.area === area && item.slot_key === slotKey));
      if (!normalizedUserId) return withoutCurrent;
      return [
        ...withoutCurrent,
        {
          id: `${area}:${slotKey}`,
          area,
          slot_key: slotKey,
          user_id: normalizedUserId,
          updated_at: new Date().toISOString(),
        },
      ];
    });

    try {
      await apiFetch("/api/parking/update-slot", {
        method: "POST",
        body: JSON.stringify({ area, slot_key: slotKey, user_id: normalizedUserId }),
      });
    } catch (e: any) {
      setAssignments(previous);
      setSavingError(e?.message || "Nem sikerült menteni a parkolóhelyet.");
    } finally {
      setSavingSlotKey(null);
    }
  }

  const memberOptions = useMemo(
    () => members.map((member) => ({ value: member.user_id, label: member.ic_name || "Névtelen tag" })),
    [members]
  );

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl rounded-[28px] border border-white/10 bg-white/[0.035] p-6 text-sm text-white/70 shadow-[0_18px_60px_rgba(0,0,0,0.24)] backdrop-blur-xl">
        Betöltés...
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-5xl rounded-[28px] border border-red-500/25 bg-red-500/10 p-6 text-sm text-red-100 shadow-[0_18px_60px_rgba(0,0,0,0.24)] backdrop-blur-xl">
        {error}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 rounded-[28px] border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-6 md:p-8 shadow-[0_18px_60px_rgba(0,0,0,0.24)] backdrop-blur-xl">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-white">Parkolási rend</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-white/72 md:text-base">
              Az oldal aktív és vezetőségi tagoknak olvasható. Vezetőség szerkesztő módban azonnal tudja menteni a
              parkolóhelyek hozzárendelését.
            </p>
          </div>
          {canEdit ? (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setEditMode((value) => !value)}
                className={cn(
                  "rounded-2xl border px-4 py-2.5 text-sm font-semibold transition",
                  editMode
                    ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-100"
                    : "border-white/10 bg-white/[0.05] text-white hover:bg-white/[0.08]"
                )}
              >
                {editMode ? "Szerkesztés bezárása" : "Szerkesztés"}
              </button>
            </div>
          ) : null}
        </div>

        {savingError ? (
          <div className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {savingError}
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.035] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="text-lg font-semibold">Információs panel</div>
              {canEdit && editMode ? (
                <button
                  type="button"
                  onClick={saveInfo}
                  disabled={savingInfo}
                  className="rounded-2xl border border-white/14 bg-white/[0.07] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/[0.11] disabled:opacity-60"
                >
                  {savingInfo ? "Mentés..." : "Mentés"}
                </button>
              ) : null}
            </div>

            <div className="space-y-5 text-sm text-white/80">
              <div>
                <div className="mb-2 text-base font-semibold text-white">Parkolóház</div>
                {canEdit && editMode ? (
                  <textarea
                    value={draftSettings.parking_house_info}
                    onChange={(e) =>
                      setDraftSettings((prev) => ({
                        ...prev,
                        parking_house_info: e.target.value,
                      }))
                    }
                    onBlur={saveInfo}
                    rows={4}
                    className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition focus:border-white/20"
                  />
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 whitespace-pre-wrap">
                    {settings.parking_house_info || "—"}
                  </div>
                )}
              </div>

              <div>
                <div className="mb-2 text-base font-semibold text-white">Hangár</div>
                {canEdit && editMode ? (
                  <textarea
                    value={draftSettings.hangar_info}
                    onChange={(e) =>
                      setDraftSettings((prev) => ({
                        ...prev,
                        hangar_info: e.target.value,
                      }))
                    }
                    onBlur={saveInfo}
                    rows={3}
                    className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition focus:border-white/20"
                  />
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 whitespace-pre-wrap">
                    {settings.hangar_info || "—"}
                  </div>
                )}

                <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-black/18 p-2">
                  <img
                    src={settings.image_path || "/parkolasrend.png"}
                    alt="Hangár parkolási rend"
                    className="h-auto w-full rounded-xl object-contain"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.035] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl">
            <div className="mb-3 text-lg font-semibold">Aktív hozzárendelések</div>
            <div className="overflow-x-auto rounded-2xl border border-white/10 bg-black/14">
              <table className="min-w-full text-sm text-white/80">
                <thead>
                  <tr className="border-b border-white/10 text-left text-white/60">
                    <th className="px-3 py-2 font-medium">IC név</th>
                    <th className="px-3 py-2 font-medium">Hangár parkolóhely</th>
                    <th className="px-3 py-2 font-medium">Parkolóház parkolóhely</th>
                  </tr>
                </thead>
                <tbody>
                  {summaryRows.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-3 py-4 text-white/50">
                        Még nincs rögzített parkolóhely.
                      </td>
                    </tr>
                  ) : (
                    summaryRows.map((row) => (
                      <tr key={row.user_id} className="border-b border-white/5 last:border-b-0">
                        <td className="px-3 py-3 font-medium text-white">{row.ic_name}</td>
                        <td className="px-3 py-3">{row.hangar_slots.length > 0 ? row.hangar_slots.join(", ") : "—"}</td>
                        <td className="px-3 py-3">
                          {row.garage_slots.length > 0 ? row.garage_slots.join(", ") : "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.035] p-5 md:p-6 shadow-[0_18px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Parkolóház</h2>
              <p className="text-sm text-white/60">A–P, betűnként 1–5 hely, táblázatos nézetben.</p>
            </div>
            <div className="text-xs text-white/50">A kiválasztás után a mentés automatikus. Egy felhasználóhoz legfeljebb 2 parkolóházas hely tartozhat.</div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/14">
            <table className="min-w-full border-collapse text-sm text-white/85">
              <tbody>
                {GARAGE_LETTERS.map((letter) => (
                  GARAGE_ROWS.map((rowNumber, index) => {
                    const slotKey = `${letter}${rowNumber}`;
                    const key = `garage:${slotKey}`;
                    const assignment = assignmentMap.get(key);
                    const selectedUserId = assignment?.user_id || "";
                    const selectedMember = selectedUserId ? memberMap.get(selectedUserId) : null;

                    return (
                      <tr key={slotKey} className="border-b border-white/10 last:border-b-0">
                        {index === 0 ? (
                          <td rowSpan={GARAGE_ROWS.length} className="w-16 border-r border-white/10 bg-white/[0.05] px-4 py-3 text-center text-lg font-bold align-middle text-white">
                            {letter}
                          </td>
                        ) : null}
                        <td className="w-16 border-r border-white/10 bg-white/[0.03] px-4 py-3 text-center font-semibold text-white">
                          {rowNumber}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-3">
                            {canEdit && editMode ? (
                              <select
                                value={selectedUserId}
                                onChange={(e) => updateSlot("garage", slotKey, e.target.value)}
                                className="w-full rounded-2xl border px-4 py-3 text-sm text-white"
                              >
                                <option value="">— Nincs kijelölve —</option>
                                {memberOptions.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <div className="min-h-[46px] w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-base text-white">
                                {selectedMember?.ic_name || "—"}
                              </div>
                            )}
                            {savingSlotKey === key ? <div className="shrink-0 text-xs text-white/50">Mentés...</div> : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.035] p-5 md:p-6 shadow-[0_18px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold">Hangár</h2>
              <p className="text-sm text-white/60">1–67 parkolóhely, listás nézetben.</p>
            </div>
            <div className="text-xs text-white/50">Egy felhasználóhoz legfeljebb 3 hangárhely rendelhető.</div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/14">
            <table className="min-w-full border-collapse text-sm text-white/85">
              <tbody>
                {HANGAR_SLOTS.map((slotKey) => {
                  const key = `hangar:${slotKey}`;
                  const assignment = assignmentMap.get(key);
                  const selectedUserId = assignment?.user_id || "";
                  const selectedMember = selectedUserId ? memberMap.get(selectedUserId) : null;

                  return (
                    <tr key={slotKey} className="border-b border-white/10 last:border-b-0">
                      <td className="w-20 border-r border-white/10 bg-white/[0.03] px-4 py-3 text-center font-semibold text-white">
                        {slotKey}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-3">
                          {canEdit && editMode ? (
                            <select
                              value={selectedUserId}
                              onChange={(e) => updateSlot("hangar", slotKey, e.target.value)}
                              className="w-full rounded-2xl border px-4 py-3 text-sm text-white"
                            >
                              <option value="">— Nincs kijelölve —</option>
                              {memberOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <div className="min-h-[46px] w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-base text-white">
                              {selectedMember?.ic_name || "—"}
                            </div>
                          )}
                          {savingSlotKey === key ? <div className="shrink-0 text-xs text-white/50">Mentés...</div> : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
