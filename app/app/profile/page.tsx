"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isLeadershipProfile } from "@/lib/permissions";

type ProfileRow = {
  user_id: string;
  ic_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  status: "preinvite" | "pending" | "active" | "inactive" | "leadership" | string;
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

  const userParam = params.get("user");

  const [me, setMe] = useState<ProfileRow | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [rank, setRank] = useState<RankRow | null>(null);
  const [rankMissing, setRankMissing] = useState(false);

  const [bioDraft, setBioDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [warnings, setWarnings] = useState<WarningRow[]>([]);
  const [actionsCount, setActionsCount] = useState(0);
  const [eventsCount, setEventsCount] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isLeadership = useMemo(() => isLeadershipProfile(me), [me]);
  const isSelf = useMemo(() => !!me && !!profile && me.user_id === profile.user_id, [me, profile]);

  const canEdit = useMemo(() => isSelf || isLeadership, [isSelf, isLeadership]);

  const canViewProfile = useMemo(() => {
    if (!me || !profile) return false;
    if (isLeadership) return true;
    if (isSelf) return true;

    return profile.status !== "inactive" && profile.status !== "preinvite";
  }, [isLeadership, isSelf, me, profile]);

  const canSeeStats = useMemo(() => isSelf || isLeadership, [isSelf, isLeadership]);
  const canSeeWarnings = useMemo(() => isSelf || isLeadership, [isSelf, isLeadership]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: meData, error: meErr } = await supabase
        .from("profiles")
        .select("user_id, ic_name, avatar_url, bio, status, created_at, site_role, rank_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (meErr) {
        if (!cancelled) {
          setError(meErr.message);
          setLoading(false);
        }
        return;
      }

      const meProfile = (meData ?? null) as ProfileRow | null;

      if (!cancelled) {
        setMe(meProfile);
      }

      const targetUserId = userParam || user.id;

      const { data: pData, error: pErr } = await supabase
        .from("profiles")
        .select("user_id, ic_name, avatar_url, bio, status, created_at, site_role, rank_id")
        .eq("user_id", targetUserId)
        .maybeSingle();

      if (pErr) {
        if (!cancelled) {
          setError(pErr.message);
          setLoading(false);
        }
        return;
      }

      const targetProfile = (pData ?? null) as ProfileRow | null;

      if (!targetProfile) {
        if (!cancelled) {
          setError("A profil nem található.");
          setLoading(false);
        }
        return;
      }

      if (!cancelled) {
        setProfile(targetProfile);
        setBioDraft(targetProfile.bio ?? "");
      }

      if (targetProfile.rank_id) {
        const { data: rData, error: rErr } = await supabase
          .from("ranks")
          .select("id, name, priority")
          .eq("id", targetProfile.rank_id)
          .maybeSingle();

        if (!cancelled) {
          if (!rErr && rData) {
            setRank(rData as RankRow);
            setRankMissing(false);
          } else {
            setRank(null);
            setRankMissing(true);
          }
        }
      } else if (!cancelled) {
        setRank(null);
        setRankMissing(false);
      }

      const meIsLeadership = isLeadershipProfile(meProfile);
      const meIsSelf = meProfile?.user_id === targetProfile.user_id;

      if (meIsLeadership || meIsSelf) {
        const { data: warnData } = await supabase
          .from("warnings")
          .select("id, reason, issued_at, expires_at, is_active")
          .eq("user_id", targetUserId)
          .order("issued_at", { ascending: false });

        const { count: actionCount } = await supabase
          .from("actions")
          .select("id", { count: "exact", head: true })
          .contains("participant_user_ids", [targetUserId]);

        const { count: eventCount } = await supabase
          .from("event_participants")
          .select("id", { count: "exact", head: true })
          .eq("user_id", targetUserId)
          .eq("attended", true);

        if (!cancelled) {
          setWarnings((warnData ?? []) as WarningRow[]);
          setActionsCount(actionCount ?? 0);
          setEventsCount(eventCount ?? 0);
        }
      } else if (!cancelled) {
        setWarnings([]);
        setActionsCount(0);
        setEventsCount(0);
      }

      if (!cancelled) {
        setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [router, supabase, userParam]);

  async function saveBio() {
    if (!profile || !canEdit) return;

    setSaving(true);
    setError(null);

    const nextBio = bioDraft.trim() || null;

    const { error: upErr } = await supabase
      .from("profiles")
      .update({ bio: nextBio })
      .eq("user_id", profile.user_id);

    if (upErr) {
      setError(upErr.message);
    } else {
      setProfile((prev) => (prev ? { ...prev, bio: nextBio } : prev));
    }

    setSaving(false);
  }

  async function uploadAvatar(file: File) {
    if (!profile || !canEdit) return;

    setUploading(true);
    setError(null);

    try {
      const ext = fileExt(file.name);
      const path = `${profile.user_id}/avatar.${ext}`;

      const { error: uploadErr } = await supabase.storage.from("avatars").upload(path, file, {
        cacheControl: "3600",
        upsert: true,
      });

      if (uploadErr) {
        setError(uploadErr.message);
        return;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(path);

      const { error: profileErr } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("user_id", profile.user_id);

      if (profileErr) {
        setError(profileErr.message);
      } else {
        setProfile((prev) => (prev ? { ...prev, avatar_url: publicUrl } : prev));
      }
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-6 lg:px-8">
        <div className="lmr-card rounded-[28px] p-6">Betöltés...</div>
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-6 lg:px-8">
        <div className="lmr-card rounded-[28px] p-6">
          <div className="rounded-[20px] border border-red-500/35 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        </div>
      </div>
    );
  }

  if (!profile || !canViewProfile) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-6 lg:px-8">
        <div className="lmr-card rounded-[28px] p-6">
          <div className="lmr-empty-state rounded-[24px] px-4 py-8 text-sm">
            Ez a profil nem megtekinthető.
          </div>
        </div>
      </div>
    );
  }

  const avatar = profile.avatar_url || "";
  const warningsActiveCount = warnings.filter((w) => {
    if (!w.is_active) return false;
    if (!w.expires_at) return true;
    return w.expires_at > new Date().toISOString();
  }).length;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-6 lg:px-8">
      <div className="space-y-5">
        <section className="lmr-card rounded-[28px] p-5 md:p-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.16em] text-white/45">Profil</div>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
                {profile.ic_name ?? "Profil"}
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-white/65">
                {canEdit
                  ? "Saját profilodat vagy vezetőségként másét is szerkesztheted."
                  : "Itt megtekintheted a profil alapadatait."}
              </p>
            </div>

            {error ? (
              <div className="rounded-[18px] border border-red-500/35 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            ) : null}
          </div>

          <div className="mt-6 grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
            <div className="lmr-surface-soft rounded-[28px] p-5">
              <div className="flex flex-col items-center text-center">
                {avatar ? (
                  <div className="relative h-36 w-36 overflow-hidden rounded-full border border-white/10 bg-white/5">
                    <Image
                      src={avatar}
                      alt="Profilkép"
                      fill
                      sizes="144px"
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                ) : (
                  <div className="flex h-36 w-36 items-center justify-center rounded-full border border-white/10 bg-white/5 text-sm text-white/50">
                    Nincs profilkép
                  </div>
                )}

                <div className="mt-4 text-xl font-semibold text-white">{profile.ic_name ?? "—"}</div>
                <div className="mt-2 text-sm text-white/65">
                  Rang: {rank?.name ?? (rankMissing ? "Törölt rang" : "—")}
                </div>
                <div className="mt-1 text-sm text-white/55">Státusz: {profile.status ?? "—"}</div>

                {canEdit ? (
                  <div className="mt-5 w-full">
                    <label className="lmr-btn lmr-btn-primary flex w-full cursor-pointer items-center justify-center rounded-2xl px-4 py-2.5 text-sm font-medium">
                      {uploading ? "Feltöltés..." : "Profilkép feltöltése"}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={uploading}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            void uploadAvatar(file);
                          }
                          e.currentTarget.value = "";
                        }}
                      />
                    </label>
                    <div className="mt-2 text-center text-xs text-white/45">Bucket: avatars</div>
                  </div>
                ) : (
                  <div className="mt-5 text-sm text-white/50">Más profilját csak megtekinteni tudod.</div>
                )}
              </div>
            </div>

            <div className="space-y-5">
              <section className="lmr-surface-soft rounded-[28px] p-5 md:p-6">
                <h2 className="text-xl font-semibold text-white">Profil leírás</h2>
                <p className="mt-1 text-sm text-white/60">
                  Rövid bemutatkozás és személyes profil információ.
                </p>

                {canEdit ? (
                  <>
                    <textarea
                      value={bioDraft}
                      onChange={(e) => setBioDraft(e.target.value)}
                      placeholder="Írj magadról pár sort..."
                      rows={8}
                      className="mt-4 min-h-[180px] w-full rounded-[24px] border border-white/10 bg-white/[0.03] px-4 py-4 text-white outline-none transition placeholder:text-white/30 focus:border-white/20"
                    />
                    <div className="mt-4 flex justify-end">
                      <button
                        className="lmr-btn lmr-btn-primary rounded-2xl px-4 py-2.5 text-sm font-medium disabled:opacity-60"
                        onClick={() => void saveBio()}
                        disabled={saving}
                      >
                        {saving ? "Mentés..." : "Mentés"}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="mt-4 whitespace-pre-wrap rounded-[24px] border border-white/10 bg-white/[0.03] px-4 py-4 text-white/85">
                    {profile.bio?.trim() ? profile.bio : "—"}
                  </div>
                )}
              </section>

              {canSeeStats ? (
                <section className="lmr-surface-soft rounded-[28px] p-5 md:p-6">
                  <h2 className="text-xl font-semibold text-white">Statisztika</h2>
                  <p className="mt-1 text-sm text-white/60">
                    A részt vett események, akciók és figyelmeztetések áttekintése.
                  </p>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
                      <div className="text-xs uppercase tracking-[0.14em] text-white/52">Felvéve</div>
                      <div className="mt-2 text-lg font-semibold text-white">{ymd(profile.created_at)}</div>
                    </div>

                    <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
                      <div className="text-xs uppercase tracking-[0.14em] text-white/52">
                        Aktív figyelmeztetések
                      </div>
                      <div className="mt-2 text-lg font-semibold text-white">{warningsActiveCount}</div>
                    </div>

                    <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
                      <div className="text-xs uppercase tracking-[0.14em] text-white/52">Események</div>
                      <div className="mt-2 text-lg font-semibold text-white">{eventsCount}</div>
                    </div>

                    <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
                      <div className="text-xs uppercase tracking-[0.14em] text-white/52">Akciók</div>
                      <div className="mt-2 text-lg font-semibold text-white">{actionsCount}</div>
                    </div>
                  </div>
                </section>
              ) : null}

              {canSeeWarnings ? (
                <section className="lmr-surface-soft rounded-[28px] p-5 md:p-6">
                  <h2 className="text-xl font-semibold text-white">Figyelmeztetések</h2>
                  <p className="mt-1 text-sm text-white/60">
                    Részletes lista a korábbi és aktív figyelmeztetésekről.
                  </p>

                  {warnings.length === 0 ? (
                    <div className="lmr-empty-state mt-4 rounded-[24px] px-4 py-8 text-sm">
                      Nincs figyelmeztetés.
                    </div>
                  ) : (
                    <div className="mt-4 grid gap-3">
                      {warnings.map((warning) => (
                        <div
                          key={warning.id}
                          className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4"
                        >
                          <div className="font-semibold text-white">{warning.reason}</div>
                          <div className="mt-2 text-xs text-white/62">
                            Kiállítva: {ymd(warning.issued_at)} • Lejárat:{" "}
                            {warning.expires_at ? ymd(warning.expires_at) : "—"} • Állapot:{" "}
                            {warning.is_active ? "Aktív" : "Inaktív"}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}