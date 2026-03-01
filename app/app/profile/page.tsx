"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type ProfileRow = {
  user_id: string;
  ic_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  status: "preinvite" | "pending" | "active" | "inactive" | string;
  created_at: string;
  site_role: "user" | "admin" | "owner" | string;
  rank_id: string | null;
};

type RankRow = {
  id: string;
  name: string;
  priority: number;
};

type WarningRow = {
  id: string;
  reason: string;
  issued_at: string;
  expires_at: string | null;
  is_active: boolean;
};

function ymd(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd}`;
}

function fileExt(name: string) {
  const parts = name.split(".");
  if (parts.length < 2) return "png";
  return parts[parts.length - 1].toLowerCase();
}

export default function ProfilePage() {
  const supabase = createClient();
  const params = useSearchParams();
  const router = useRouter();

  const userParam = params.get("user"); // ha van: más profilját nézzük
  const [me, setMe] = useState<ProfileRow | null>(null);

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [rank, setRank] = useState<RankRow | null>(null);

  const [bioDraft, setBioDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [warnings, setWarnings] = useState<WarningRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const isLeadership = useMemo(
    () => me?.site_role === "admin" || me?.site_role === "owner",
    [me]
  );

  const isSelf = useMemo(() => {
    if (!me || !profile) return false;
    return me.user_id === profile.user_id;
  }, [me, profile]);

  const canEdit = useMemo(() => isSelf || isLeadership, [isSelf, isLeadership]);

  const canSeeStats = useMemo(() => isSelf || isLeadership, [isSelf, isLeadership]);

  useEffect(() => {
    (async () => {
      setError(null);

      const { data: userData } = await supabase.auth.getUser();
      const authUser = userData?.user;

      if (!authUser) {
        router.replace("/login");
        return;
      }

      // Saját profil (jogok megállapításához)
      const { data: myProfile, error: myErr } = await supabase
        .from("profiles")
        .select("user_id,ic_name,avatar_url,bio,status,created_at,site_role,rank_id")
        .eq("user_id", authUser.id)
        .maybeSingle();

      if (myErr || !myProfile) {
        setError(myErr?.message ?? "Nem találom a saját profilodat.");
        return;
      }

      setMe(myProfile as any);

      const targetUserId = userParam || authUser.id;

      // Target profile
      const { data: targetProfile, error: profErr } = await supabase
        .from("profiles")
        .select("user_id,ic_name,avatar_url,bio,status,created_at,site_role,rank_id")
        .eq("user_id", targetUserId)
        .maybeSingle();

      if (profErr || !targetProfile) {
        setError(profErr?.message ?? "Profil nem található.");
        return;
      }

      setProfile(targetProfile as any);
      setBioDraft(targetProfile.bio ?? "");

      // Rank név
      if (targetProfile.rank_id) {
        const { data: r, error: rErr } = await supabase
          .from("ranks")
          .select("id,name,priority")
          .eq("id", targetProfile.rank_id)
          .maybeSingle();

        if (!rErr) setRank((r as any) ?? null);
      } else {
        setRank(null);
      }

      // Warning részletek csak self/vezetőség
      if (targetProfile.user_id && (targetProfile.user_id === authUser.id || (myProfile.site_role === "admin" || myProfile.site_role === "owner"))) {
        const { data: w, error: wErr } = await supabase
          .from("warnings")
          .select("id,reason,issued_at,expires_at,is_active")
          .eq("user_id", targetProfile.user_id)
          .order("issued_at", { ascending: false });

        if (!wErr) setWarnings((w ?? []) as any);
      } else {
        setWarnings([]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userParam]);

  async function saveBio() {
    if (!profile) return;
    if (!canEdit) return;

    setSaving(true);
    setError(null);

    const { error: upErr } = await supabase
      .from("profiles")
      .update({ bio: bioDraft })
      .eq("user_id", profile.user_id);

    if (upErr) setError(upErr.message);
    else setProfile((p) => (p ? { ...p, bio: bioDraft } : p));

    setSaving(false);
  }

  async function uploadAvatar(file: File) {
    if (!profile) return;
    if (!canEdit) return;

    setUploading(true);
    setError(null);

    try {
      const ext = fileExt(file.name);
      const path = `${profile.user_id}/avatar.${ext}`;

      // upload (upsert)
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });

      if (upErr) {
        setError(upErr.message);
        setUploading(false);
        return;
      }

      // public url
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const publicUrl = data?.publicUrl ?? null;

      if (!publicUrl) {
        setError("Nem sikerült public URL-t kérni (avatars bucket legyen Public).");
        setUploading(false);
        return;
      }

      const { error: profErr } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("user_id", profile.user_id);

      if (profErr) {
        setError(profErr.message);
      } else {
        setProfile((p) => (p ? { ...p, avatar_url: publicUrl } : p));
      }
    } finally {
      setUploading(false);
    }
  }

  if (!profile) return <div className="p-6">Betöltés…</div>;

  const avatar = profile.avatar_url || "";

  // stats placeholder (később rákötjük)
  const warningsActiveCount = (() => {
    const now = new Date().toISOString();
    return warnings.filter((w) => {
      if (!w.is_active) return false;
      if (!w.expires_at) return true;
      return w.expires_at > now;
    }).length;
  })();

  const actionsCount = 0;
  const eventsCount = 0;

  return (
    <div className="max-w-5xl">
      <div className="flex items-start gap-6">
        {/* Left: avatar card */}
        <div className="w-[260px] shrink-0">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="h-44 w-full rounded-2xl border border-white/10 bg-black/40 overflow-hidden flex items-center justify-center">
              {avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatar} alt="Avatar" className="h-full w-full object-cover" />
              ) : (
                <div className="text-sm opacity-60">Nincs profilkép</div>
              )}
            </div>

            {/* InGame név a kép alatt */}
            <div className="mt-3 text-lg font-semibold">
              {profile.ic_name ?? "—"}
            </div>

            <div className="mt-1 text-sm opacity-70">
              Rang: <span className="opacity-90">{rank?.name ?? "—"}</span>
            </div>

            {canEdit && (
              <div className="mt-4">
                <label className="text-xs opacity-70">Profilkép feltöltés</label>
                <input
                  type="file"
                  accept="image/*"
                  className="mt-2 block w-full text-sm"
                  disabled={uploading}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadAvatar(f);
                  }}
                />
                <div className="mt-2 text-xs opacity-60">
                  {uploading ? "Feltöltés..." : "Bucket: avatars (Public)"}
                </div>
              </div>
            )}

            {!canEdit && (
              <div className="mt-4 text-xs opacity-60">
                Más profilját csak megtekinteni tudod.
              </div>
            )}
          </div>
        </div>

        {/* Right: content */}
        <div className="flex-1">
          <h1 className="text-3xl font-bold">Profil</h1>
          <p className="mt-2 opacity-80">
            {canEdit
              ? "Saját profilodat (vagy vezetőségként másét) szerkesztheted."
              : "Megtekintés"}
          </p>

          {error && (
            <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm">
              {error}
            </div>
          )}

          {/* Bio */}
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm font-semibold">Profil leírás</div>

            {canEdit ? (
              <>
                <textarea
                  className="mt-3 w-full rounded-2xl border border-white/15 bg-black/40 p-3 min-h-[120px]"
                  value={bioDraft}
                  onChange={(e) => setBioDraft(e.target.value)}
                  placeholder="Írj magadról pár sort..."
                />
                <div className="mt-3 flex justify-end">
                  <button
                    className="rounded-xl border border-white/15 px-4 py-2 hover:bg-white/5"
                    onClick={saveBio}
                    disabled={saving}
                  >
                    {saving ? "Mentés..." : "Mentés"}
                  </button>
                </div>
              </>
            ) : (
              <div className="mt-3 whitespace-pre-wrap opacity-90">
                {profile.bio?.trim() ? profile.bio : "—"}
              </div>
            )}
          </div>

          {/* Stats: csak saját / vezetőség */}
          {canSeeStats && (
            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm font-semibold">Statisztika</div>

              <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
                  <div className="text-xs opacity-60">Felvéve</div>
                  <div className="text-lg font-semibold">{ymd(profile.created_at)}</div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
                  <div className="text-xs opacity-60">Figyelmeztetések</div>
                  <div className="text-lg font-semibold">{warningsActiveCount}</div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
                  <div className="text-xs opacity-60">Események</div>
                  <div className="text-lg font-semibold">{eventsCount}</div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
                  <div className="text-xs opacity-60">Akciók</div>
                  <div className="text-lg font-semibold">{actionsCount}</div>
                </div>
              </div>

              <div className="mt-3 text-xs opacity-60">
                (Események/Akciók számláló később lesz rákötve a bejegyzésekre.)
              </div>
            </div>
          )}

          {/* Warnings részletek: csak self / vezetőség */}
          {canSeeStats && (
            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm font-semibold">Figyelmeztetések (részletek)</div>

              {warnings.length === 0 ? (
                <div className="mt-3 text-sm opacity-70">Nincs figyelmeztetés.</div>
              ) : (
                <div className="mt-3 grid gap-2">
                  {warnings.map((w) => (
                    <div key={w.id} className="rounded-2xl border border-white/10 bg-black/30 p-3">
                      <div className="text-sm font-semibold">{w.reason}</div>
                      <div className="mt-1 text-xs opacity-70">
                        Kiállítva: {ymd(w.issued_at)} • Lejárat: {w.expires_at ? ymd(w.expires_at) : "—"} •
                        Állapot: {w.is_active ? "Aktív" : "Inaktív"}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-3 text-xs opacity-60">
                Ezt csak a saját profilodon látod (illetve vezetőség látja).
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}