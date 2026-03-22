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

type ParkingRequestRow = {
  id: string;
  user_id: string;
  garage_slots: string[] | null;
  hangar_slots: string[] | null;
  status: "pending" | "approved" | "rejected" | string;
  review_note: string | null;
  created_at: string | null;
  updated_at: string | null;
  approved_at: string | null;
  approved_by: string | null;
  rejected_at: string | null;
  rejected_by: string | null;
};

type ParkingResponse = {
  ok: boolean;
  message?: string;
  viewer: ViewerProfile;
  settings: ParkingSettings;
  assignments: ParkingAssignment[];
  members: MemberRow[];
  my_request?: ParkingRequestRow | null;
  available_slots?: {
    garage: string[];
    hangar: string[];
  };
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
const GARAGE_SLOTS = GARAGE_LETTERS.flatMap((letter) => GARAGE_ROWS.map((row) => `${letter}${row}`));

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

function parkingRequestStatusLabel(status: string | null | undefined) {
  switch ((status || "").toLowerCase()) {
    case "approved":
      return "Elfogadva";
    case "rejected":
      return "Elutasítva";
    case "pending":
      return "Függőben";
    default:
      return "Nincs igénylés";
  }
}

function parkingRequestStatusClass(status: string | null | undefined) {
  switch ((status || "").toLowerCase()) {
    case "approved":
      return "border-emerald-500/30 bg-emerald-500/15 text-emerald-200";
    case "rejected":
      return "border-red-500/30 bg-red-500/15 text-red-200";
    case "pending":
      return "border-yellow-500/30 bg-yellow-500/15 text-yellow-200";
    default:
      return "border-white/10 bg-white/5 text-white/70";
  }
}

function uniq(values: string[]) {
  return Array.from(new Set(values));
}

function RequestSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm text-white/75">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border px-3.5 py-3 text-sm"
      >
        <option value="">— nincs kiválasztva —</option>
        {options.map((slot) => (
          <option key={slot} value={slot}>
            {slot}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function ParkolasPage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingError, setSavingError] = useState<string | null>(null);
  const [viewer, setViewer] = useState<ViewerProfile | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [assignments, setAssignments] = useState<ParkingAssignment[]>([]);
  const [myRequest, setMyRequest] = useState<ParkingRequestRow | null>(null);
  const [occupiedRequestSlots, setOccupiedRequestSlots] = useState<{ garage: string[]; hangar: string[] }>({
    garage: [],
    hangar: [],
  });
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
  const [requestOpen, setRequestOpen] = useState(false);
  const [savingRequest, setSavingRequest] = useState(false);
  const [requestGarageSlots, setRequestGarageSlots] = useState<string[]>(["", ""]);
  const [requestHangarSlots, setRequestHangarSlots] = useState<string[]>(["", "", ""]);

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

  const myAssignedGarage = useMemo(
    () => assignments.filter((item) => item.area === "garage" && item.user_id === viewer?.user_id).map((item) => item.slot_key),
    [assignments, viewer?.user_id]
  );
  const myAssignedHangar = useMemo(
    () => assignments.filter((item) => item.area === "hangar" && item.user_id === viewer?.user_id).map((item) => item.slot_key),
    [assignments, viewer?.user_id]
  );

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
      setMyRequest(json.my_request || null);
      setOccupiedRequestSlots({
        garage: json.available_slots?.garage || [],
        hangar: json.available_slots?.hangar || [],
      });
      setSettings(json.settings);
      setDraftSettings({
        parking_house_info: json.settings?.parking_house_info || "",
        hangar_info: json.settings?.hangar_info || "",
      });

      const nextGarage = ["", ""];
      const nextHangar = ["", "", ""];
      (json.my_request?.garage_slots || []).slice(0, 2).forEach((slot, index) => {
        nextGarage[index] = slot;
      });
      (json.my_request?.hangar_slots || []).slice(0, 3).forEach((slot, index) => {
        nextHangar[index] = slot;
      });
      setRequestGarageSlots(nextGarage);
      setRequestHangarSlots(nextHangar);
    } catch (e: any) {
      setError(e?.message || "Nem sikerült betölteni a parkolási rendet.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPage();
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

  async function submitParkingRequest() {
    const garageSlots = uniq(requestGarageSlots.map((slot) => slot.trim()).filter(Boolean)).sort(sortSlotKeys);
    const hangarSlots = uniq(requestHangarSlots.map((slot) => slot.trim()).filter(Boolean)).sort(sortSlotKeys);

    if (garageSlots.length === 0 && hangarSlots.length === 0) {
      setSavingError("Legalább egy parkolóhelyet ki kell választani.");
      return;
    }

    setSavingRequest(true);
    setSavingError(null);

    try {
      const json = await apiFetch("/api/parking/request-upsert", {
        method: "POST",
        body: JSON.stringify({
          garage_slots: garageSlots,
          hangar_slots: hangarSlots,
        }),
      });
      setMyRequest(json.row || null);
      setRequestOpen(false);
      await loadPage();
    } catch (e: any) {
      setSavingError(e?.message || "Nem sikerült elmenteni a parkolás igénylést.");
    } finally {
      setSavingRequest(false);
    }
  }

  const memberOptions = useMemo(
    () => members.map((member) => ({ value: member.user_id, label: member.ic_name || "Névtelen tag" })),
    [members]
  );

  const availableGarageRequestSlots = useMemo(() => {
    const currentRequested = requestGarageSlots.filter(Boolean);
    return GARAGE_SLOTS.filter((slot) => {
      const item = assignmentMap.get(`garage:${slot}`);
      if (item?.user_id) {
        return item.user_id === viewer?.user_id || currentRequested.includes(slot);
      }

      const occupiedByPending = occupiedRequestSlots.garage.includes(slot);
      if (!occupiedByPending) return true;

      return currentRequested.includes(slot);
    }).sort(sortSlotKeys);
  }, [assignmentMap, occupiedRequestSlots.garage, requestGarageSlots, viewer?.user_id]);

  const availableHangarRequestSlots = useMemo(() => {
    const currentRequested = requestHangarSlots.filter(Boolean);
    return HANGAR_SLOTS.filter((slot) => {
      const item = assignmentMap.get(`hangar:${slot}`);
      if (item?.user_id) {
        return item.user_id === viewer?.user_id || currentRequested.includes(slot);
      }

      const occupiedByPending = occupiedRequestSlots.hangar.includes(slot);
      if (!occupiedByPending) return true;

      return currentRequested.includes(slot);
    }).sort(sortSlotKeys);
  }, [assignmentMap, occupiedRequestSlots.hangar, requestHangarSlots, viewer?.user_id]);

  if (loading) {
    return (
      <div className="lmr-page">
        <div className="px-1 py-6 text-sm text-white/70">Betöltés...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="lmr-page">
        <div className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="lmr-page lmr-page-wide space-y-8">
      <section className="space-y-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <span className="lmr-chip inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white/70">
              Parkolás
            </span>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-white md:text-4xl">
              Parkolási rend
            </h1>
            <div className="mt-4 h-[2px] w-12 rounded-full bg-red-600/80" />
            <p className="mt-4 max-w-3xl text-sm leading-7 text-white/75">
              Az oldal aktív és vezetőségi tagoknak olvasható. Vezetőség szerkesztő módban azonnal tudja menteni a
              parkolóhelyek hozzárendelését.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setRequestOpen((value) => !value)}
              className="lmr-btn lmr-btn-primary rounded-2xl px-4 py-2.5 text-sm font-semibold"
            >
              {requestOpen ? "Igénylés bezárása" : "Parkolás igénylés"}
            </button>

            {canEdit ? (
              <button
                type="button"
                onClick={() => setEditMode((value) => !value)}
                className={cn(
                  "lmr-btn rounded-2xl px-4 py-2.5 text-sm font-semibold",
                  editMode
                    ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/20"
                    : ""
                )}
              >
                {editMode ? "Szerkesztés bezárása" : "Szerkesztés"}
              </button>
            ) : null}
          </div>
        </div>
      </section>

      {savingError ? (
        <div className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {savingError}
        </div>
      ) : null}

      {requestOpen ? (
        <section className="space-y-5">
          <div>
            <h2 className="text-xl font-semibold text-white">Parkolás igénylés</h2>
            <div className="mt-3 h-[2px] w-10 rounded-full bg-red-600/80" />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-4">
              <div className="text-sm text-white/70">
                Itt tudsz szabad parkolóhelyeket igényelni. Ha módosítod a kérelmet, azt a vezetőségnek újra el kell fogadnia.
              </div>
              <div className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${parkingRequestStatusClass(myRequest?.status)}`}>
                Állapot: {parkingRequestStatusLabel(myRequest?.status)}
              </div>
              {myRequest?.review_note ? (
                <div className="text-sm text-white/70">Vezetőségi megjegyzés: {myRequest.review_note}</div>
              ) : null}
              <div className="text-xs text-white/50">
                Utolsó frissítés: {formatDateTime(myRequest?.updated_at)}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <div className="mb-3 text-sm font-semibold text-white">Jelenlegi helyeid</div>
                <div className="space-y-1 text-sm text-white/70">
                  <div>Parkolóház: {myAssignedGarage.length > 0 ? myAssignedGarage.sort(sortSlotKeys).join(", ") : "—"}</div>
                  <div>Hangár: {myAssignedHangar.length > 0 ? myAssignedHangar.sort(sortSlotKeys).join(", ") : "—"}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-white">Parkolóház igénylés</h3>
                <p className="mt-2 text-sm text-white/60">Maximum 2 hely kérhető.</p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <RequestSelect
                  label="Parkolóház hely #1"
                  value={requestGarageSlots[0] || ""}
                  options={availableGarageRequestSlots}
                  onChange={(value) =>
                    setRequestGarageSlots((prev) => [value, prev[1] || ""])
                  }
                />
                <RequestSelect
                  label="Parkolóház hely #2"
                  value={requestGarageSlots[1] || ""}
                  options={availableGarageRequestSlots}
                  onChange={(value) =>
                    setRequestGarageSlots((prev) => [prev[0] || "", value])
                  }
                />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-white">Hangár igénylés</h3>
                <p className="mt-2 text-sm text-white/60">Maximum 3 hely kérhető.</p>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
                <RequestSelect
                  label="Hangár hely #1"
                  value={requestHangarSlots[0] || ""}
                  options={availableHangarRequestSlots}
                  onChange={(value) =>
                    setRequestHangarSlots((prev) => [value, prev[1] || "", prev[2] || ""])
                  }
                />
                <RequestSelect
                  label="Hangár hely #2"
                  value={requestHangarSlots[1] || ""}
                  options={availableHangarRequestSlots}
                  onChange={(value) =>
                    setRequestHangarSlots((prev) => [prev[0] || "", value, prev[2] || ""])
                  }
                />
                <RequestSelect
                  label="Hangár hely #3"
                  value={requestHangarSlots[2] || ""}
                  options={availableHangarRequestSlots}
                  onChange={(value) =>
                    setRequestHangarSlots((prev) => [prev[0] || "", prev[1] || "", value])
                  }
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void submitParkingRequest()}
              disabled={savingRequest}
              className="lmr-btn lmr-btn-primary rounded-2xl px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
            >
              {savingRequest ? "Mentés..." : myRequest ? "Igénylés frissítése" : "Igénylés beküldése"}
            </button>
            <button
              type="button"
              onClick={() => setRequestOpen(false)}
              className="lmr-btn rounded-2xl px-4 py-2.5 text-sm"
            >
              Bezárás
            </button>
          </div>
        </section>
      ) : null}

      <section className="space-y-5">
        <div>
          <h2 className="text-xl font-semibold text-white">Információk</h2>
          <div className="mt-3 h-[2px] w-10 rounded-full bg-red-600/80" />
        </div>

        {canEdit && editMode ? (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void saveInfo()}
              disabled={savingInfo}
              className="lmr-btn lmr-btn-primary rounded-2xl px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
            >
              {savingInfo ? "Mentés..." : "Mentés"}
            </button>
          </div>
        ) : null}

        <div className="grid gap-8 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6 text-sm text-white/80">
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
                  onBlur={() => void saveInfo()}
                  rows={4}
                  className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition focus:border-white/20"
                />
              ) : (
                <div className="whitespace-pre-wrap text-white/80">
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
                  onBlur={() => void saveInfo()}
                  rows={3}
                  className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition focus:border-white/20"
                />
              ) : (
                <div className="whitespace-pre-wrap text-white/80">
                  {settings.hangar_info || "—"}
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="mb-2 text-base font-semibold text-white">Térkép</div>
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/18 p-2">
              <img
                src={settings.image_path || "/parkolasrend.png"}
                alt="Hangár parkolási rend"
                className="h-auto w-full rounded-xl object-contain"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-5">
        <div>
          <h2 className="text-xl font-semibold text-white">Aktív hozzárendelések</h2>
          <div className="mt-3 h-[2px] w-10 rounded-full bg-red-600/80" />
        </div>

        <div className="overflow-x-auto rounded-2xl border border-white/10">
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
                    <td className="px-3 py-3">{row.garage_slots.length > 0 ? row.garage_slots.join(", ") : "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-8 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="space-y-5">
          <div>
            <h2 className="text-xl font-semibold text-white">Parkolóház</h2>
            <div className="mt-3 h-[2px] w-10 rounded-full bg-red-600/80" />
            <p className="mt-4 text-sm text-white/60">
              A–P, betűnként 1–5 hely, táblázatos nézetben.
            </p>
            <p className="mt-1 text-xs text-white/50">
              A kiválasztás után a mentés automatikus. Egy felhasználóhoz legfeljebb 2 parkolóházas hely tartozhat.
            </p>
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/10">
            <table className="min-w-full border-collapse text-sm text-white/85">
              <tbody>
                {GARAGE_LETTERS.map((letter) =>
                  GARAGE_ROWS.map((rowNumber, index) => {
                    const slotKey = `${letter}${rowNumber}`;
                    const key = `garage:${slotKey}`;
                    const assignment = assignmentMap.get(key);
                    const selectedUserId = assignment?.user_id || "";
                    const selectedMember = selectedUserId ? memberMap.get(selectedUserId) : null;

                    return (
                      <tr key={slotKey} className="border-b border-white/10 last:border-b-0">
                        {index === 0 ? (
                          <td
                            rowSpan={GARAGE_ROWS.length}
                            className="w-16 border-r border-white/10 bg-white/[0.05] px-4 py-3 text-center text-lg font-bold align-middle text-white"
                          >
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
                                onChange={(e) => void updateSlot("garage", slotKey, e.target.value)}
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
                              <div className="min-h-[46px] w-full px-1 py-3 text-base text-white">
                                {selectedMember?.ic_name || "—"}
                              </div>
                            )}
                            {savingSlotKey === key ? (
                              <div className="shrink-0 text-xs text-white/50">Mentés...</div>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-5">
          <div>
            <h2 className="text-xl font-semibold text-white">Hangár</h2>
            <div className="mt-3 h-[2px] w-10 rounded-full bg-red-600/80" />
            <p className="mt-4 text-sm text-white/60">1–67 parkolóhely, listás nézetben.</p>
            <p className="mt-1 text-xs text-white/50">
              Egy felhasználóhoz legfeljebb 3 hangárhely rendelhető.
            </p>
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/10">
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
                              onChange={(e) => void updateSlot("hangar", slotKey, e.target.value)}
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
                            <div className="min-h-[46px] w-full px-1 py-3 text-base text-white">
                              {selectedMember?.ic_name || "—"}
                            </div>
                          )}
                          {savingSlotKey === key ? (
                            <div className="shrink-0 text-xs text-white/50">Mentés...</div>
                          ) : null}
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

      <section className="space-y-3">
        <div>
          <h2 className="text-xl font-semibold text-white">Tudnivalók</h2>
          <div className="mt-3 h-[2px] w-10 rounded-full bg-red-600/80" />
        </div>

        <div className="space-y-1 text-sm text-white/70">
          <div>Az aktív és vezetőségi tagok látják az oldalt.</div>
          <div>A parkolás igénylés módosítható, de minden módosítást a vezetőségnek újra el kell fogadnia.</div>
          <div>Vezetőség szerkesztő módban azonnal tud parkolóhelyet hozzárendelni.</div>
          <div>A parkolóházban egy taghoz legfeljebb 2 hely tartozhat, a hangárban legfeljebb 3.</div>
          <div>Utolsó frissítés ideje a mentett rekordok alapján: {formatDateTime(assignments[0]?.updated_at)}</div>
        </div>
      </section>
    </div>
  );
}