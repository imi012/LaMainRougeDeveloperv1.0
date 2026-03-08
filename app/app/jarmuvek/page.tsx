"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isLeadershipProfile } from "@/lib/permissions";

type ProfileRow = {
  user_id: string;
  ic_name: string | null;
  status: string | null;
  site_role: string | null;
  rank_id: string | null;
};

type RankRow = {
  id: string;
  name: string;
  priority: number;
  is_archived: boolean;
};

type VehicleRow = {
  id: string;
  vehicle_type: string;
  game_vehicle_id: string | null;
  plate: string | null;
  allowed_rank_ids: string[] | null;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
  registration_valid_until: string | null;
  registration_imgur_url: string | null;
};

type VehicleWarningRow = {
  id: string;
  vehicle_id: string;
  reason: string | null;
  created_at: string | null;
  created_by: string | null;
};

type RevocationRow = {
  id: string;
  vehicle_id: string;
  revoked_until: string;
  note: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type VehicleFormState = {
  vehicle_type: string;
  game_vehicle_id: string;
  plate: string;
  notes: string;
  allowed_rank_ids: string[];
  registration_valid_until: string;
  registration_imgur_url: string;
};

type RegistrationFormState = {
  registration_valid_until: string;
  registration_imgur_url: string;
};

type RevocationFormState = {
  revoked_until: string;
  note: string;
};

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("hu-HU");
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("hu-HU");
}

function formatUrl(value: string | null | undefined) {
  return value?.trim() || "";
}

function toDateInputValue(value: string | null | undefined) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function endOfDayIso(dateValue: string) {
  return new Date(`${dateValue}T23:59:59`).toISOString();
}

export default function JarmuvekPage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [me, setMe] = useState<ProfileRow | null>(null);
  const [ranks, setRanks] = useState<RankRow[]>([]);
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [revocations, setRevocations] = useState<RevocationRow[]>([]);
  const [warnings, setWarnings] = useState<VehicleWarningRow[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [expandedVehicleId, setExpandedVehicleId] = useState<string | null>(null);
  const [savingVehicleId, setSavingVehicleId] = useState<string | null>(null);
  const [deletingVehicleId, setDeletingVehicleId] = useState<string | null>(null);
  const [savingRevocationId, setSavingRevocationId] = useState<string | null>(null);
  const [deletingRevocationId, setDeletingRevocationId] = useState<string | null>(null);
  const [creatingVehicle, setCreatingVehicle] = useState(false);
  const [creatingRevocationForVehicleId, setCreatingRevocationForVehicleId] = useState<string | null>(null);
  const [savingRegistrationVehicleId, setSavingRegistrationVehicleId] = useState<string | null>(null);
  const [creatingWarningVehicleId, setCreatingWarningVehicleId] = useState<string | null>(null);
  const [deletingWarningId, setDeletingWarningId] = useState<string | null>(null);

  const [newVehicle, setNewVehicle] = useState<VehicleFormState>({
    vehicle_type: "",
    game_vehicle_id: "",
    plate: "",
    notes: "",
    allowed_rank_ids: [],
    registration_valid_until: "",
    registration_imgur_url: "",
  });

  const [editForms, setEditForms] = useState<Record<string, VehicleFormState>>({});
  const [registrationForms, setRegistrationForms] = useState<Record<string, RegistrationFormState>>({});
  const [newWarningReasons, setNewWarningReasons] = useState<Record<string, string>>({});
  const [newRevocationForms, setNewRevocationForms] = useState<Record<string, RevocationFormState>>({});
  const [editRevocationForms, setEditRevocationForms] = useState<
    Record<string, { revoked_until: string; note: string }>
  >({});

  const canEdit = useMemo(() => isLeadershipProfile(me), [me]);
  const canEditRegistration = useMemo(
    () => !!me && me.status !== "pending" && me.status !== "inactive",
    [me]
  );

  const rankMap = useMemo(() => {
    const map = new Map<string, RankRow>();
    for (const rank of ranks) map.set(rank.id, rank);
    return map;
  }, [ranks]);

  const activeRanks = useMemo(
    () => ranks.filter((rank) => !rank.is_archived).sort((a, b) => a.priority - b.priority),
    [ranks]
  );

  async function apiFetch<T = any>(input: string, init?: RequestInit): Promise<T> {
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

    return json as T;
  }

  async function loadPage() {
    setLoading(true);
    setError(null);

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        throw new Error(authError.message);
      }

      if (!user) {
        throw new Error("Nincs bejelentkezve.");
      }

      const { data: myProfile, error: myProfileError } = await supabase
        .from("profiles")
        .select("user_id, ic_name, status, site_role, rank_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (myProfileError) {
        throw new Error(myProfileError.message);
      }

      const myProfileRow = (myProfile ?? null) as ProfileRow | null;
      setMe(myProfileRow);

      const [ranksRes, vehiclesRes, revocationsRes, warningsJson] = await Promise.all([
        supabase
          .from("ranks")
          .select("id, name, priority, is_archived")
          .order("priority", { ascending: true }),
        supabase
          .from("faction_vehicles")
          .select(
            "id, vehicle_type, game_vehicle_id, plate, allowed_rank_ids, notes, created_at, updated_at, registration_valid_until, registration_imgur_url"
          )
          .order("vehicle_type", { ascending: true }),
        supabase
          .from("vehicle_access_revocations")
          .select("id, vehicle_id, revoked_until, note, created_at, updated_at")
          .order("revoked_until", { ascending: false }),
        apiFetch<{ ok: boolean; warnings: VehicleWarningRow[] }>("/api/vehicles/warnings/list"),
      ]);

      if (ranksRes.error) throw new Error(ranksRes.error.message);
      if (vehiclesRes.error) throw new Error(vehiclesRes.error.message);
      if (revocationsRes.error) throw new Error(revocationsRes.error.message);

      const loadedRanks = (ranksRes.data ?? []) as RankRow[];
      const loadedVehicles = (vehiclesRes.data ?? []) as VehicleRow[];
      const loadedRevocations = (revocationsRes.data ?? []) as RevocationRow[];

      setRanks(loadedRanks);
      setVehicles(loadedVehicles);
      setRevocations(loadedRevocations);
      setWarnings(warningsJson.warnings || []);

      const initialEditForms: Record<string, VehicleFormState> = {};
      const initialRegistrationForms: Record<string, RegistrationFormState> = {};
      for (const vehicle of loadedVehicles) {
        initialEditForms[vehicle.id] = {
          vehicle_type: vehicle.vehicle_type ?? "",
          game_vehicle_id: vehicle.game_vehicle_id ?? "",
          plate: vehicle.plate ?? "",
          notes: vehicle.notes ?? "",
          allowed_rank_ids: Array.isArray(vehicle.allowed_rank_ids) ? vehicle.allowed_rank_ids : [],
          registration_valid_until: toDateInputValue(vehicle.registration_valid_until),
          registration_imgur_url: vehicle.registration_imgur_url ?? "",
        };
        initialRegistrationForms[vehicle.id] = {
          registration_valid_until: toDateInputValue(vehicle.registration_valid_until),
          registration_imgur_url: vehicle.registration_imgur_url ?? "",
        };
      }
      setEditForms(initialEditForms);
      setRegistrationForms(initialRegistrationForms);

      const initialRevocationForms: Record<string, { revoked_until: string; note: string }> = {};
      for (const item of loadedRevocations) {
        initialRevocationForms[item.id] = {
          revoked_until: toDateInputValue(item.revoked_until),
          note: item.note ?? "",
        };
      }
      setEditRevocationForms(initialRevocationForms);

      const blankRevocationForms: Record<string, RevocationFormState> = {};
      for (const vehicle of loadedVehicles) {
        blankRevocationForms[vehicle.id] = {
          revoked_until: "",
          note: "",
        };
      }
      setNewRevocationForms(blankRevocationForms);
    } catch (err: any) {
      setError(err?.message ?? "Nem sikerült betölteni a Járművek oldalt.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function getAllowedRankLabels(vehicle: VehicleRow) {
    const ids = Array.isArray(vehicle.allowed_rank_ids) ? vehicle.allowed_rank_ids : [];
    if (ids.length === 0) {
      return ["Minden tag használhatja"];
    }

    return ids.map((rankId) => {
      const rank = rankMap.get(rankId);
      if (!rank) return "Törölt rang";
      if (rank.is_archived) return `${rank.name} (archivált)`;
      return rank.name;
    });
  }

  function getVehicleRevocations(vehicleId: string) {
    return revocations.filter((item) => item.vehicle_id === vehicleId);
  }

  function getVehicleWarnings(vehicleId: string) {
    return warnings.filter((item) => item.vehicle_id === vehicleId);
  }

  function getCurrentVehicleRevocation(vehicleId: string) {
    const now = Date.now();

    const items = revocations
      .filter((item) => item.vehicle_id === vehicleId)
      .filter((item) => {
        const until = new Date(item.revoked_until).getTime();
        return !Number.isNaN(until) && until >= now;
      })
      .sort(
        (a, b) => new Date(b.revoked_until).getTime() - new Date(a.revoked_until).getTime()
      );

    return items[0] ?? null;
  }

  function updateEditVehicleForm(vehicleId: string, patch: Partial<VehicleFormState>) {
    setEditForms((prev) => ({
      ...prev,
      [vehicleId]: {
        ...prev[vehicleId],
        ...patch,
      },
    }));
  }

  function toggleVehicleRank(vehicleId: string, rankId: string) {
    const current = editForms[vehicleId]?.allowed_rank_ids ?? [];
    const hasRank = current.includes(rankId);

    updateEditVehicleForm(vehicleId, {
      allowed_rank_ids: hasRank
        ? current.filter((id) => id !== rankId)
        : [...current, rankId],
    });
  }

  async function createVehicle() {
    if (!canEdit) return;

    const vehicle_type = newVehicle.vehicle_type.trim();
    if (!vehicle_type) {
      setError("Add meg a jármű típusát.");
      return;
    }

    setCreatingVehicle(true);
    setError(null);

    const payload = {
      vehicle_type,
      game_vehicle_id: newVehicle.game_vehicle_id.trim() || null,
      plate: newVehicle.plate.trim() || null,
      notes: newVehicle.notes.trim() || null,
      allowed_rank_ids: newVehicle.allowed_rank_ids,
      registration_valid_until: newVehicle.registration_valid_until || null,
      registration_imgur_url: formatUrl(newVehicle.registration_imgur_url) || null,
    };

    const { data, error: insertError } = await supabase
      .from("faction_vehicles")
      .insert(payload)
      .select(
        "id, vehicle_type, game_vehicle_id, plate, allowed_rank_ids, notes, created_at, updated_at, registration_valid_until, registration_imgur_url"
      )
      .single();

    setCreatingVehicle(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    const created = data as VehicleRow;

    setVehicles((prev) =>
      [...prev, created].sort((a, b) => a.vehicle_type.localeCompare(b.vehicle_type))
    );
    setEditForms((prev) => ({
      ...prev,
      [created.id]: {
        vehicle_type: created.vehicle_type ?? "",
        game_vehicle_id: created.game_vehicle_id ?? "",
        plate: created.plate ?? "",
        notes: created.notes ?? "",
        allowed_rank_ids: Array.isArray(created.allowed_rank_ids) ? created.allowed_rank_ids : [],
        registration_valid_until: toDateInputValue(created.registration_valid_until),
        registration_imgur_url: created.registration_imgur_url ?? "",
      },
    }));
    setRegistrationForms((prev) => ({
      ...prev,
      [created.id]: {
        registration_valid_until: toDateInputValue(created.registration_valid_until),
        registration_imgur_url: created.registration_imgur_url ?? "",
      },
    }));
    setNewRevocationForms((prev) => ({
      ...prev,
      [created.id]: {
        revoked_until: "",
        note: "",
      },
    }));

    setNewVehicle({
      vehicle_type: "",
      game_vehicle_id: "",
      plate: "",
      notes: "",
      allowed_rank_ids: [],
      registration_valid_until: "",
      registration_imgur_url: "",
    });
    setCreateOpen(false);
  }

  async function saveVehicle(vehicleId: string) {
    if (!canEdit) return;

    const form = editForms[vehicleId];
    if (!form) return;

    const vehicle_type = form.vehicle_type.trim();
    if (!vehicle_type) {
      setError("A jármű típusa nem lehet üres.");
      return;
    }

    setSavingVehicleId(vehicleId);
    setError(null);

    const payload = {
      vehicle_type,
      game_vehicle_id: form.game_vehicle_id.trim() || null,
      plate: form.plate.trim() || null,
      notes: form.notes.trim() || null,
      allowed_rank_ids: form.allowed_rank_ids,
      registration_valid_until: form.registration_valid_until || null,
      registration_imgur_url: formatUrl(form.registration_imgur_url) || null,
    };

    const { data, error: updateError } = await supabase
      .from("faction_vehicles")
      .update(payload)
      .eq("id", vehicleId)
      .select(
        "id, vehicle_type, game_vehicle_id, plate, allowed_rank_ids, notes, created_at, updated_at, registration_valid_until, registration_imgur_url"
      )
      .single();

    setSavingVehicleId(null);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    const updated = data as VehicleRow;

    setVehicles((prev) =>
      prev
        .map((item) => (item.id === vehicleId ? updated : item))
        .sort((a, b) => a.vehicle_type.localeCompare(b.vehicle_type))
    );
    setRegistrationForms((prev) => ({
      ...prev,
      [vehicleId]: {
        registration_valid_until: toDateInputValue(updated.registration_valid_until),
        registration_imgur_url: updated.registration_imgur_url ?? "",
      },
    }));
  }

  async function saveRegistration(vehicleId: string) {
    if (!canEditRegistration) return;

    const form = registrationForms[vehicleId];
    if (!form) return;

    setSavingRegistrationVehicleId(vehicleId);
    setError(null);

    try {
      const json = await apiFetch<{ ok: boolean; vehicle: VehicleRow }>(
        "/api/vehicles/update-registration",
        {
          method: "POST",
          body: JSON.stringify({
            vehicle_id: vehicleId,
            registration_valid_until: form.registration_valid_until || null,
            registration_imgur_url: formatUrl(form.registration_imgur_url) || null,
          }),
        }
      );

      const updated = json.vehicle;
      setVehicles((prev) =>
        prev
          .map((item) => (item.id === vehicleId ? updated : item))
          .sort((a, b) => a.vehicle_type.localeCompare(b.vehicle_type))
      );
      setEditForms((prev) => ({
        ...prev,
        [vehicleId]: {
          ...(prev[vehicleId] ?? {
            vehicle_type: updated.vehicle_type ?? "",
            game_vehicle_id: updated.game_vehicle_id ?? "",
            plate: updated.plate ?? "",
            notes: updated.notes ?? "",
            allowed_rank_ids: Array.isArray(updated.allowed_rank_ids) ? updated.allowed_rank_ids : [],
            registration_valid_until: "",
            registration_imgur_url: "",
          }),
          registration_valid_until: toDateInputValue(updated.registration_valid_until),
          registration_imgur_url: updated.registration_imgur_url ?? "",
        },
      }));
      setRegistrationForms((prev) => ({
        ...prev,
        [vehicleId]: {
          registration_valid_until: toDateInputValue(updated.registration_valid_until),
          registration_imgur_url: updated.registration_imgur_url ?? "",
        },
      }));
    } catch (e: any) {
      setError(e?.message || "Nem sikerült menteni a forgalmi adatokat.");
    } finally {
      setSavingRegistrationVehicleId(null);
    }
  }

  async function createWarning(vehicleId: string) {
    if (!canEdit) return;

    const reason = (newWarningReasons[vehicleId] || "").trim();
    if (!reason) {
      setError("Add meg a figyelmeztetés okát.");
      return;
    }

    setCreatingWarningVehicleId(vehicleId);
    setError(null);

    try {
      const json = await apiFetch<{ ok: boolean; warning: VehicleWarningRow }>(
        "/api/vehicles/warnings/create",
        {
          method: "POST",
          body: JSON.stringify({ vehicle_id: vehicleId, reason }),
        }
      );
      setWarnings((prev) => [json.warning, ...prev]);
      setNewWarningReasons((prev) => ({ ...prev, [vehicleId]: "" }));
    } catch (e: any) {
      setError(e?.message || "Nem sikerült létrehozni a figyelmeztetést.");
    } finally {
      setCreatingWarningVehicleId(null);
    }
  }

  async function deleteWarning(warningId: string) {
    if (!canEdit) return;

    const ok = window.confirm("Biztosan törölni szeretnéd ezt a járműfigyelmeztetést?");
    if (!ok) return;

    setDeletingWarningId(warningId);
    setError(null);

    try {
      await apiFetch("/api/vehicles/warnings/delete", {
        method: "POST",
        body: JSON.stringify({ id: warningId }),
      });
      setWarnings((prev) => prev.filter((item) => item.id !== warningId));
    } catch (e: any) {
      setError(e?.message || "Nem sikerült törölni a figyelmeztetést.");
    } finally {
      setDeletingWarningId(null);
    }
  }

  async function deleteVehicle(vehicleId: string) {
    if (!canEdit) return;

    const ok = window.confirm("Biztosan törölni szeretnéd ezt a járművet?");
    if (!ok) return;

    setDeletingVehicleId(vehicleId);
    setError(null);

    const { error: deleteError } = await supabase.from("faction_vehicles").delete().eq("id", vehicleId);

    setDeletingVehicleId(null);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setVehicles((prev) => prev.filter((item) => item.id !== vehicleId));
    setRevocations((prev) => prev.filter((item) => item.vehicle_id !== vehicleId));
    setExpandedVehicleId((prev) => (prev === vehicleId ? null : prev));
  }

  async function createRevocation(vehicleId: string) {
    if (!canEdit) return;

    if (getCurrentVehicleRevocation(vehicleId)) {
      setError("Ehhez a járműhöz már tartozik aktív jogelvétel.");
      return;
    }

    const form = newRevocationForms[vehicleId];
    if (!form) return;

    if (!form.revoked_until) {
      setError("Add meg, meddig legyen elvéve a jog.");
      return;
    }

    setCreatingRevocationForVehicleId(vehicleId);
    setError(null);

    const payload = {
      vehicle_id: vehicleId,
      revoked_until: endOfDayIso(form.revoked_until),
      note: form.note.trim() || null,
    };

    const { data, error: insertError } = await supabase
      .from("vehicle_access_revocations")
      .insert(payload)
      .select("id, vehicle_id, revoked_until, note, created_at, updated_at")
      .single();

    setCreatingRevocationForVehicleId(null);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    const created = data as RevocationRow;

    setRevocations((prev) => [created, ...prev]);
    setEditRevocationForms((prev) => ({
      ...prev,
      [created.id]: {
        revoked_until: toDateInputValue(created.revoked_until),
        note: created.note ?? "",
      },
    }));
    setNewRevocationForms((prev) => ({
      ...prev,
      [vehicleId]: {
        revoked_until: "",
        note: "",
      },
    }));
  }

  async function saveRevocation(revocationId: string) {
    if (!canEdit) return;

    const form = editRevocationForms[revocationId];
    if (!form) return;

    if (!form.revoked_until) {
      setError("Add meg a jogelvétel végdátumát.");
      return;
    }

    setSavingRevocationId(revocationId);
    setError(null);

    const payload = {
      revoked_until: endOfDayIso(form.revoked_until),
      note: form.note.trim() || null,
    };

    const { data, error: updateError } = await supabase
      .from("vehicle_access_revocations")
      .update(payload)
      .eq("id", revocationId)
      .select("id, vehicle_id, revoked_until, note, created_at, updated_at")
      .single();

    setSavingRevocationId(null);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    const updated = data as RevocationRow;

    setRevocations((prev) => prev.map((item) => (item.id === revocationId ? updated : item)));
    setEditRevocationForms((prev) => ({
      ...prev,
      [revocationId]: {
        revoked_until: toDateInputValue(updated.revoked_until),
        note: updated.note ?? "",
      },
    }));
  }

  async function deleteRevocation(revocationId: string) {
    if (!canEdit) return;

    const ok = window.confirm("Biztosan törölni szeretnéd ezt a jogelvételi bejegyzést?");
    if (!ok) return;

    setDeletingRevocationId(revocationId);
    setError(null);

    const { error: deleteError } = await supabase
      .from("vehicle_access_revocations")
      .delete()
      .eq("id", revocationId);

    setDeletingRevocationId(null);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setRevocations((prev) => prev.filter((item) => item.id !== revocationId));
  }

  if (loading) {
    return <div className="mx-auto w-full max-w-7xl rounded-[28px] border border-white/10 bg-white/[0.04] px-6 py-8 text-sm text-white/75">Betöltés…</div>;
  }

  if (me?.status === "pending") {
    return (
      <div className="max-w-3xl">
        <h1 className="text-3xl font-bold">Járművek</h1>
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm text-white/80">
          Ehhez az oldalhoz jelenleg nincs hozzáférésed.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1550px] space-y-6">
      <section className="lmr-surface-soft rounded-[28px] p-6 md:p-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-start">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/45">La Main Rouge</div>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">Járművek</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-white/70">
              A frakció járműparkja, jogosult rangok, forgalmi adatok, jogelvételek és figyelmeztetések egységesített felületen.
            </p>
          </div>

          {canEdit && (
            <button
              onClick={() => setCreateOpen((prev) => !prev)}
              className="ml-auto rounded-2xl border border-white/12 bg-white/[0.05] px-4 py-2.5 text-sm font-medium hover:bg-white/[0.08]"
            >
              {createOpen ? "Űrlap bezárása" : "Új autó felvétele"}
            </button>
          )}
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      )}

      {canEdit && createOpen && (
        <section className="lmr-surface-soft rounded-[26px] p-5 md:p-6">
          <h2 className="text-xl font-semibold">Új jármű létrehozása</h2>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm text-white/75">Autó típusa</label>
              <input
                value={newVehicle.vehicle_type}
                onChange={(e) =>
                  setNewVehicle((prev) => ({ ...prev, vehicle_type: e.target.value }))
                }
                className="w-full rounded-2xl border px-3.5 py-3"
                placeholder="pl. Sultan RS"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-white/75">Játékbeli ID</label>
              <input
                value={newVehicle.game_vehicle_id}
                onChange={(e) =>
                  setNewVehicle((prev) => ({ ...prev, game_vehicle_id: e.target.value }))
                }
                className="w-full rounded-2xl border px-3.5 py-3"
                placeholder="pl. 241"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-white/75">Rendszám</label>
              <input
                value={newVehicle.plate}
                onChange={(e) =>
                  setNewVehicle((prev) => ({ ...prev, plate: e.target.value }))
                }
                className="w-full rounded-2xl border px-3.5 py-3"
                placeholder="pl. LMR-001"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-white/75">Megjegyzés</label>
              <input
                value={newVehicle.notes}
                onChange={(e) =>
                  setNewVehicle((prev) => ({ ...prev, notes: e.target.value }))
                }
                className="w-full rounded-2xl border px-3.5 py-3"
                placeholder="opcionális"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-white/75">Forgalmi érvényessége</label>
              <input
                type="date"
                value={newVehicle.registration_valid_until}
                onChange={(e) =>
                  setNewVehicle((prev) => ({ ...prev, registration_valid_until: e.target.value }))
                }
                className="w-full rounded-2xl border px-3.5 py-3"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-white/75">Forgalmi Imgur link</label>
              <input
                value={newVehicle.registration_imgur_url}
                onChange={(e) =>
                  setNewVehicle((prev) => ({ ...prev, registration_imgur_url: e.target.value }))
                }
                className="w-full rounded-2xl border px-3.5 py-3"
                placeholder="https://imgur.com/..."
              />
            </div>
          </div>

          <div className="mt-5">
            <div className="mb-2 block text-sm text-white/75">Használható rangok</div>
            <p className="mb-3 text-xs text-white/55">
              Ha itt semmit nem jelölsz be, akkor a jármű minden tag számára használhatónak számít.
            </p>

            <div className="grid gap-2 md:grid-cols-3">
              {activeRanks.map((rank) => {
                const checked = newVehicle.allowed_rank_ids.includes(rank.id);

                return (
                  <label
                    key={rank.id}
                    className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setNewVehicle((prev) => ({
                          ...prev,
                          allowed_rank_ids: checked
                            ? prev.allowed_rank_ids.filter((id) => id !== rank.id)
                            : [...prev.allowed_rank_ids, rank.id],
                        }))
                      }
                    />
                    <span className="text-sm">{rank.name}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="mt-5 flex gap-3">
            <button
              onClick={createVehicle}
              disabled={creatingVehicle}
              className="rounded-2xl border border-white/12 bg-white/[0.05] px-4 py-2.5 text-sm hover:bg-white/[0.08] disabled:opacity-50"
            >
              {creatingVehicle ? "Mentés..." : "Jármű létrehozása"}
            </button>

            <button
              onClick={() => setCreateOpen(false)}
              className="rounded-2xl border border-white/12 bg-white/[0.05] px-4 py-2.5 text-sm hover:bg-white/[0.08]"
            >
              Mégse
            </button>
          </div>
        </section>
      )}

      <section className="lmr-surface-soft overflow-hidden rounded-[26px]">
        <div className="hidden lg:grid lg:grid-cols-[220px_110px_130px_minmax(480px,1fr)_150px] lg:gap-4 border-b border-white/10 bg-white/5 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-white/70">
          <div>Autó típusa</div>
          <div>ID</div>
          <div>Rendszám</div>
          <div>Jogosult rangok / forgalmi / figyelmeztetések</div>
          <div className="text-right">Művelet</div>
        </div>

        {vehicles.length === 0 && (
          <div className="px-4 py-6 text-sm text-white/70">
            Még nincs felvéve egyetlen jármű sem.
          </div>
        )}

        {vehicles.map((vehicle) => {
          const form = editForms[vehicle.id] ?? {
            vehicle_type: vehicle.vehicle_type ?? "",
            game_vehicle_id: vehicle.game_vehicle_id ?? "",
            plate: vehicle.plate ?? "",
            notes: vehicle.notes ?? "",
            allowed_rank_ids: Array.isArray(vehicle.allowed_rank_ids) ? vehicle.allowed_rank_ids : [],
            registration_valid_until: toDateInputValue(vehicle.registration_valid_until),
            registration_imgur_url: vehicle.registration_imgur_url ?? "",
          };

          const currentRevocation = getCurrentVehicleRevocation(vehicle.id);
          const vehicleRevocations = getVehicleRevocations(vehicle.id);
          const vehicleWarnings = getVehicleWarnings(vehicle.id);
          const isExpanded = expandedVehicleId === vehicle.id;
          const isVehicleBusy = savingVehicleId === vehicle.id || deletingVehicleId === vehicle.id;

          return (
            <div key={vehicle.id} className="border-b border-white/10 last:border-b-0">
              <div className="grid gap-4 px-4 py-4 lg:grid-cols-[220px_110px_130px_minmax(480px,1fr)_150px] lg:items-start">
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-white/45 lg:hidden">
                    Autó típusa
                  </div>
                  <div className="font-semibold text-lg lg:text-base">{vehicle.vehicle_type}</div>
                  {vehicle.notes && (
                    <div className="mt-1 text-xs text-white/55">{vehicle.notes}</div>
                  )}
                </div>

                <div className="text-sm text-white/80">
                  <div className="text-[11px] uppercase tracking-wide text-white/45 lg:hidden">
                    ID
                  </div>
                  {vehicle.game_vehicle_id || "—"}
                </div>

                <div className="text-sm text-white/80">
                  <div className="text-[11px] uppercase tracking-wide text-white/45 lg:hidden">
                    Rendszám
                  </div>
                  {vehicle.plate || "—"}
                </div>

                <div className="min-w-0 space-y-3">
                  <div>
                    <div className="mb-2 text-[11px] uppercase tracking-wide text-white/45 lg:hidden">
                      Jogosult rangok / forgalmi / figyelmeztetések
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {getAllowedRankLabels(vehicle).map((label, index) => (
                        <span
                          key={`${vehicle.id}-rank-${index}`}
                          className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-xs text-white/75"
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="w-full rounded-2xl border border-white/10 bg-black/20 p-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-white/60">
                      Forgalmi érvényessége
                    </div>
                    <div className="mt-2 text-sm text-white/85">
                      {formatDate(vehicle.registration_valid_until)}
                    </div>

                    {vehicle.registration_imgur_url ? (
                      <a
                        href={vehicle.registration_imgur_url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex text-xs text-red-300 hover:text-red-200 underline underline-offset-2"
                      >
                        Forgalmi link megnyitása
                      </a>
                    ) : (
                      <div className="mt-2 text-xs text-white/50">Nincs link megadva</div>
                    )}
                  </div>

                  <div className="w-full rounded-2xl border border-white/10 bg-black/20 overflow-hidden">
                    <div className="border-b border-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white/60">
                      Jármű figyelmeztetések
                    </div>

                    {vehicleWarnings.length === 0 ? (
                      <div className="px-3 py-3 text-sm text-white/60">
                        Ehhez a járműhöz nincs figyelmeztetés.
                      </div>
                    ) : (
                      <div className="overflow-hidden">
                        <div className="grid grid-cols-[130px_1fr] border-b border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white/60">
                          <div>Dátum</div>
                          <div>Ok</div>
                        </div>
                        {vehicleWarnings.slice(0, 3).map((item) => (
                          <div
                            key={item.id}
                            className="grid grid-cols-[130px_1fr] border-b border-white/5 px-3 py-2 text-sm last:border-b-0"
                          >
                            <div className="text-white/75">{formatDate(item.created_at)}</div>
                            <div className="break-words text-white/85">{item.reason || "—"}</div>
                          </div>
                        ))}
                        {vehicleWarnings.length > 3 && (
                          <div className="px-3 py-2 text-xs text-white/50">
                            +{vehicleWarnings.length - 3} további figyelmeztetés a részletekben
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {currentRevocation ? (
                    <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-2 text-xs text-red-200">
                      Járműjog elvéve eddig: {formatDate(currentRevocation.revoked_until)}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-2 text-xs text-emerald-200">
                      Nincs aktív jogelvétel ennél a járműnél.
                    </div>
                  )}
                </div>

                <div className="flex flex-col items-stretch gap-2 lg:items-end">
                  <div className="text-[11px] uppercase tracking-wide text-white/45 lg:hidden">
                    Művelet
                  </div>
                  <button
                    onClick={() =>
                      setExpandedVehicleId((prev) => (prev === vehicle.id ? null : vehicle.id))
                    }
                    className="rounded-xl border border-white/15 px-3 py-2 text-sm hover:bg-white/5"
                  >
                    {isExpanded ? "Bezárás" : "Részletek"}
                  </button>

                  {canEdit && (
                    <button
                      onClick={() => deleteVehicle(vehicle.id)}
                      disabled={isVehicleBusy}
                      className="rounded-xl border border-red-500/30 px-3 py-2 text-sm hover:bg-red-500/10 disabled:opacity-50"
                    >
                      Törlés
                    </button>
                  )}
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-white/10 bg-black/20 px-4 py-5">
                  {canEdit ? (
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-lg font-semibold">Jármű szerkesztése</h3>

                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                          <div>
                            <label className="mb-2 block text-sm text-white/75">Autó típusa</label>
                            <input
                              value={form.vehicle_type}
                              onChange={(e) =>
                                updateEditVehicleForm(vehicle.id, { vehicle_type: e.target.value })
                              }
                              className="w-full rounded-2xl border px-3.5 py-3"
                            />
                          </div>

                          <div>
                            <label className="mb-2 block text-sm text-white/75">Játékbeli ID</label>
                            <input
                              value={form.game_vehicle_id}
                              onChange={(e) =>
                                updateEditVehicleForm(vehicle.id, { game_vehicle_id: e.target.value })
                              }
                              className="w-full rounded-2xl border px-3.5 py-3"
                            />
                          </div>

                          <div>
                            <label className="mb-2 block text-sm text-white/75">Rendszám</label>
                            <input
                              value={form.plate}
                              onChange={(e) =>
                                updateEditVehicleForm(vehicle.id, { plate: e.target.value })
                              }
                              className="w-full rounded-2xl border px-3.5 py-3"
                            />
                          </div>

                          <div>
                            <label className="mb-2 block text-sm text-white/75">Megjegyzés</label>
                            <input
                              value={form.notes}
                              onChange={(e) =>
                                updateEditVehicleForm(vehicle.id, { notes: e.target.value })
                              }
                              className="w-full rounded-2xl border px-3.5 py-3"
                            />
                          </div>

                          <div>
                            <label className="mb-2 block text-sm text-white/75">Forgalmi érvényessége</label>
                            <input
                              type="date"
                              value={form.registration_valid_until}
                              onChange={(e) =>
                                updateEditVehicleForm(vehicle.id, {
                                  registration_valid_until: e.target.value,
                                })
                              }
                              className="w-full rounded-2xl border px-3.5 py-3"
                            />
                          </div>

                          <div>
                            <label className="mb-2 block text-sm text-white/75">Forgalmi Imgur link</label>
                            <input
                              value={form.registration_imgur_url}
                              onChange={(e) =>
                                updateEditVehicleForm(vehicle.id, {
                                  registration_imgur_url: e.target.value,
                                })
                              }
                              className="w-full rounded-2xl border px-3.5 py-3"
                            />
                          </div>
                        </div>

                        <div className="mt-5">
                          <div className="mb-2 block text-sm text-white/75">Használható rangok</div>
                          <p className="mb-3 text-xs text-white/55">
                            Archivált rang nem választható újonnan, de ha korábban hozzá volt rendelve,
                            a megjelenítésben továbbra is látszani fog.
                          </p>

                          <div className="grid gap-2 md:grid-cols-3">
                            {activeRanks.map((rank) => {
                              const checked = form.allowed_rank_ids.includes(rank.id);

                              return (
                                <label
                                  key={`${vehicle.id}-${rank.id}`}
                                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2"
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleVehicleRank(vehicle.id, rank.id)}
                                  />
                                  <span className="text-sm">{rank.name}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>

                        <div className="mt-5 flex gap-3">
                          <button
                            onClick={() => saveVehicle(vehicle.id)}
                            disabled={isVehicleBusy}
                            className="rounded-2xl border border-white/12 bg-white/[0.05] px-4 py-2.5 text-sm hover:bg-white/[0.08] disabled:opacity-50"
                          >
                            {savingVehicleId === vehicle.id ? "Mentés..." : "Jármű mentése"}
                          </button>

                          <div className="self-center text-xs text-white/50">
                            Utolsó módosítás: {formatDateTime(vehicle.updated_at)}
                          </div>
                        </div>
                      </div>

                      <div className="h-px bg-white/10" />

                      <div>
                        <h3 className="text-lg font-semibold">Jármű jogelvétel</h3>
                        <p className="mt-2 text-sm text-white/70">
                          Itt tudod rögzíteni, ha az adott jármű jogosultsága egy ideig el van véve.
                          Ez nem személyhez kötött, hanem magára a járműre vonatkozik.
                        </p>

                        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                          {currentRevocation ? (
                            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
                              Ehhez a járműhöz jelenleg aktív jogelvétel tartozik. Új jogelvételt csak
                              az aktív rekord törlése vagy lejárata után tudsz rögzíteni.
                            </div>
                          ) : (
                            <>
                              <div className="grid gap-4 md:grid-cols-2">
                                <div>
                                  <label className="mb-2 block text-sm text-white/75">Elvéve eddig</label>
                                  <input
                                    type="date"
                                    value={newRevocationForms[vehicle.id]?.revoked_until ?? ""}
                                    onChange={(e) =>
                                      setNewRevocationForms((prev) => ({
                                        ...prev,
                                        [vehicle.id]: {
                                          ...(prev[vehicle.id] ?? {
                                            revoked_until: "",
                                            note: "",
                                          }),
                                          revoked_until: e.target.value,
                                        },
                                      }))
                                    }
                                    className="w-full rounded-2xl border px-3.5 py-3"
                                  />
                                </div>

                                <div>
                                  <label className="mb-2 block text-sm text-white/75">Megjegyzés</label>
                                  <input
                                    value={newRevocationForms[vehicle.id]?.note ?? ""}
                                    onChange={(e) =>
                                      setNewRevocationForms((prev) => ({
                                        ...prev,
                                        [vehicle.id]: {
                                          ...(prev[vehicle.id] ?? {
                                            revoked_until: "",
                                            note: "",
                                          }),
                                          note: e.target.value,
                                        },
                                      }))
                                    }
                                    className="w-full rounded-2xl border px-3.5 py-3"
                                    placeholder="opcionális"
                                  />
                                </div>
                              </div>

                              <div className="mt-4">
                                <button
                                  onClick={() => createRevocation(vehicle.id)}
                                  disabled={creatingRevocationForVehicleId === vehicle.id}
                                  className="rounded-2xl border border-white/12 bg-white/[0.05] px-4 py-2.5 text-sm hover:bg-white/[0.08] disabled:opacity-50"
                                >
                                  {creatingRevocationForVehicleId === vehicle.id
                                    ? "Mentés..."
                                    : "Jogelvétel rögzítése"}
                                </button>
                              </div>
                            </>
                          )}
                        </div>

                        <div className="mt-4 space-y-3">
                          {vehicleRevocations.length === 0 && (
                            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-sm text-white/65">
                              Ehhez a járműhöz még nincs jogelvételi bejegyzés.
                            </div>
                          )}

                          {vehicleRevocations.map((item) => {
                            const revocationForm = editRevocationForms[item.id] ?? {
                              revoked_until: toDateInputValue(item.revoked_until),
                              note: item.note ?? "",
                            };
                            const isExpired = new Date(item.revoked_until).getTime() < Date.now();
                            const isBusy =
                              savingRevocationId === item.id || deletingRevocationId === item.id;

                            return (
                              <div
                                key={item.id}
                                className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"
                              >
                                <div className="flex flex-wrap items-center gap-3">
                                  <div className="font-semibold">Járműjog elvétel</div>

                                  <span
                                    className={`rounded-full px-2 py-1 text-xs ${
                                      isExpired
                                        ? "border border-white/10 bg-white/5 text-white/60"
                                        : "border border-red-500/20 bg-red-500/10 text-red-200"
                                    }`}
                                  >
                                    {isExpired ? "Lejárt" : "Aktív"}
                                  </span>
                                </div>

                                <div className="mt-4 grid gap-4 md:grid-cols-2">
                                  <div>
                                    <label className="mb-2 block text-sm text-white/75">
                                      Elvéve eddig
                                    </label>
                                    <input
                                      type="date"
                                      value={revocationForm.revoked_until}
                                      onChange={(e) =>
                                        setEditRevocationForms((prev) => ({
                                          ...prev,
                                          [item.id]: {
                                            ...prev[item.id],
                                            revoked_until: e.target.value,
                                          },
                                        }))
                                      }
                                      className="w-full rounded-2xl border px-3.5 py-3"
                                    />
                                  </div>

                                  <div>
                                    <label className="mb-2 block text-sm text-white/75">
                                      Megjegyzés
                                    </label>
                                    <input
                                      value={revocationForm.note}
                                      onChange={(e) =>
                                        setEditRevocationForms((prev) => ({
                                          ...prev,
                                          [item.id]: {
                                            ...prev[item.id],
                                            note: e.target.value,
                                          },
                                        }))
                                      }
                                      className="w-full rounded-2xl border px-3.5 py-3"
                                    />
                                  </div>
                                </div>

                                <div className="mt-3 text-xs text-white/50">
                                  Létrehozva: {formatDateTime(item.created_at)}
                                </div>

                                <div className="mt-4 flex gap-3">
                                  <button
                                    onClick={() => saveRevocation(item.id)}
                                    disabled={isBusy}
                                    className="rounded-2xl border border-white/12 bg-white/[0.05] px-4 py-2.5 text-sm hover:bg-white/[0.08] disabled:opacity-50"
                                  >
                                    {savingRevocationId === item.id
                                      ? "Mentés..."
                                      : "Bejegyzés mentése"}
                                  </button>

                                  <button
                                    onClick={() => deleteRevocation(item.id)}
                                    disabled={isBusy}
                                    className="rounded-xl border border-red-500/30 px-4 py-2 text-sm hover:bg-red-500/10 disabled:opacity-50"
                                  >
                                    Törlés
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="h-px bg-white/10" />

                      <div>
                        <h3 className="text-lg font-semibold">Jármű figyelmeztetések</h3>
                        <p className="mt-2 text-sm text-white/70">
                          Itt tudsz figyelmeztetést rögzíteni az adott járműre.
                        </p>

                        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                          <label className="mb-2 block text-sm text-white/75">
                            Figyelmeztetés oka
                          </label>
                          <div className="flex flex-col gap-3 md:flex-row">
                            <input
                              value={newWarningReasons[vehicle.id] ?? ""}
                              onChange={(e) =>
                                setNewWarningReasons((prev) => ({
                                  ...prev,
                                  [vehicle.id]: e.target.value,
                                }))
                              }
                              className="w-full rounded-2xl border px-3.5 py-3"
                              placeholder="Írd be a figyelmeztetés okát"
                            />
                            <button
                              onClick={() => createWarning(vehicle.id)}
                              disabled={creatingWarningVehicleId === vehicle.id}
                              className="rounded-2xl border border-white/12 bg-white/[0.05] px-4 py-2.5 text-sm hover:bg-white/[0.08] disabled:opacity-50"
                            >
                              {creatingWarningVehicleId === vehicle.id
                                ? "Mentés..."
                                : "Figyelmeztetés hozzáadása"}
                            </button>
                          </div>
                        </div>

                        <div className="mt-4 space-y-3">
                          {vehicleWarnings.length === 0 && (
                            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-sm text-white/65">
                              Ehhez a járműhöz még nincs figyelmeztetés.
                            </div>
                          )}

                          {vehicleWarnings.map((item) => (
                            <div
                              key={item.id}
                              className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"
                            >
                              <div className="text-sm text-white/85">{item.reason || "—"}</div>
                              <div className="mt-2 text-xs text-white/50">
                                Létrehozva: {formatDateTime(item.created_at)}
                              </div>
                              <div className="mt-4">
                                <button
                                  onClick={() => deleteWarning(item.id)}
                                  disabled={deletingWarningId === item.id}
                                  className="rounded-xl border border-red-500/30 px-4 py-2 text-sm hover:bg-red-500/10 disabled:opacity-50"
                                >
                                  Törlés
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">Jármű részletei</h3>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                          <div className="text-sm text-white/60">Autó típusa</div>
                          <div className="mt-1 font-semibold">{vehicle.vehicle_type}</div>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                          <div className="text-sm text-white/60">Játékbeli ID</div>
                          <div className="mt-1 font-semibold">
                            {vehicle.game_vehicle_id || "—"}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                          <div className="text-sm text-white/60">Rendszám</div>
                          <div className="mt-1 font-semibold">{vehicle.plate || "—"}</div>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                          <div className="text-sm text-white/60">Jogállapot</div>
                          <div className="mt-1 font-semibold">
                            {currentRevocation
                              ? `Elvéve eddig: ${formatDate(currentRevocation.revoked_until)}`
                              : "Nincs aktív jogelvétel"}
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                        <div className="text-sm text-white/60">Forgalmi érvényessége</div>
                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                          <div>
                            <label className="mb-2 block text-sm text-white/75">Érvényes eddig</label>
                            <input
                              type="date"
                              value={registrationForms[vehicle.id]?.registration_valid_until ?? ""}
                              onChange={(e) =>
                                setRegistrationForms((prev) => ({
                                  ...prev,
                                  [vehicle.id]: {
                                    ...(prev[vehicle.id] ?? {
                                      registration_valid_until: "",
                                      registration_imgur_url: "",
                                    }),
                                    registration_valid_until: e.target.value,
                                  },
                                }))
                              }
                              className="w-full rounded-2xl border px-3.5 py-3"
                            />
                          </div>

                          <div>
                            <label className="mb-2 block text-sm text-white/75">
                              Forgalmi Imgur link
                            </label>
                            <input
                              value={registrationForms[vehicle.id]?.registration_imgur_url ?? ""}
                              onChange={(e) =>
                                setRegistrationForms((prev) => ({
                                  ...prev,
                                  [vehicle.id]: {
                                    ...(prev[vehicle.id] ?? {
                                      registration_valid_until: "",
                                      registration_imgur_url: "",
                                    }),
                                    registration_imgur_url: e.target.value,
                                  },
                                }))
                              }
                              className="w-full rounded-2xl border px-3.5 py-3"
                              placeholder="https://imgur.com/..."
                            />
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-3">
                          <button
                            onClick={() => saveRegistration(vehicle.id)}
                            disabled={
                              !canEditRegistration || savingRegistrationVehicleId === vehicle.id
                            }
                            className="rounded-2xl border border-white/12 bg-white/[0.05] px-4 py-2.5 text-sm hover:bg-white/[0.08] disabled:opacity-50"
                          >
                            {savingRegistrationVehicleId === vehicle.id
                              ? "Mentés..."
                              : "Forgalmi mentése"}
                          </button>

                          {vehicle.registration_imgur_url ? (
                            <a
                              href={vehicle.registration_imgur_url}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-2xl border border-white/12 bg-white/[0.05] px-4 py-2.5 text-sm hover:bg-white/[0.08]"
                            >
                              Imgur link megnyitása
                            </a>
                          ) : null}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                        <div className="text-sm text-white/60">Használható rangok</div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {getAllowedRankLabels(vehicle).map((label, index) => (
                            <span
                              key={`${vehicle.id}-member-rank-${index}`}
                              className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-xs text-white/75"
                            >
                              {label}
                            </span>
                          ))}
                        </div>
                      </div>

                      {currentRevocation && currentRevocation.note && (
                        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                          <div className="text-sm text-white/60">Megjegyzés</div>
                          <div className="mt-1 text-sm text-white/80">{currentRevocation.note}</div>
                        </div>
                      )}

                      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                        <div className="text-sm text-white/60">Jármű figyelmeztetések</div>
                        <div className="mt-3 space-y-3">
                          {vehicleWarnings.length === 0 ? (
                            <div className="text-sm text-white/65">
                              Ehhez a járműhöz még nincs figyelmeztetés.
                            </div>
                          ) : (
                            vehicleWarnings.map((item) => (
                              <div
                                key={item.id}
                                className="rounded-xl border border-white/10 bg-black/20 p-3"
                              >
                                <div className="text-sm text-white/85">{item.reason || "—"}</div>
                                <div className="mt-2 text-xs text-white/50">
                                  Létrehozva: {formatDateTime(item.created_at)}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}