"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { canUseMemberFeatures, isLeadershipProfile } from "@/lib/permissions";

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
  const [error, setError] = useState<string | null>(null);

  const isLeadership = useMemo(() => isLeadershipProfile(me), [me]);
  const isSelf = useMemo(() => !!me && !!profile && me.user_id === profile.user_id, [me, profile]);
  const canEdit = useMemo(() => isSelf || isLeadership, [isSelf, isLeadership]);
  const canSeeStats = useMemo(() => isSelf || isLeadership || canUseMemberFeatures(me), [isSelf, isLeadership, me]);

  useEffect(() => {
    (async () => {
      setError(null);
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: meData, error: meErr } = await supabase
        .from("profiles")
        .select("user_id,ic_name,avatar_url,bio,status,created_at,site_role,rank_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (meErr) {
        setError(meErr.message);
        return;
      }
      const meProfile = (meData ?? null) as ProfileRow | null;
      setMe(meProfile);

      const targetUserId = userParam || user.id;
      const { data: pData, error: pErr } = await supabase
        .from("profiles")
        .select("user_id,ic_name,avatar_url,bio,status,created_at,site_role,rank_id")
        .eq("user_id", targetUserId)
        .maybeSingle();
      if (pErr) {
        setError(pErr.message);
        return;
      }

      const targetProfile = (pData ?? null) as ProfileRow | null;
      setProfile(targetProfile);
      setBioDraft(targetProfile?.bio ?? "");

      if (targetProfile?.rank_id) {
        const { data: rData, error: rErr } = await supabase
          .from("ranks")
          .select("id,name,priority")
          .eq("id", targetProfile.rank_id)
          .maybeSingle();
        if (!rErr && rData) {
          setRank(rData as RankRow);
          setRankMissing(false);
        } else {
          setRank(null);
          setRankMissing(true);
        }
      } else {
        setRank(null);
        setRankMissing(false);
      }

      const { data: warnData } = await supabase
        .from("warnings")
        .select("id,reason,issued_at,expires_at,is_active")
        .eq("user_id", targetUserId)
        .order("issued_at", { ascending: false });
      setWarnings((warnData ?? []) as WarningRow[]);

      const { count: actionCount } = await supabase
        .from("actions")
        .select("id", { count: "exact", head: true })
        .contains("participant_user_ids", [targetUserId]);
      const { count: eventCount } = await supabase
        .from("event_participants")
        .select("id", { count: "exact", head: true })
        .eq("user_id", targetUserId)
        .eq("attended", true);

      setActionsCount(actionCount ?? 0);
      setEventsCount(eventCount ?? 0);
    })();
  }, [router, supabase, userParam]);

  async function saveBio() {
    if (!profile || !canEdit) return;
    setSaving(true);
    setError(null);
    const { error: upErr } = await supabase.from("profiles").update({ bio: bioDraft.trim() || null }).eq("user_id", profile.user_id);
    if (upErr) setError(upErr.message);
    else setProfile((p) => (p ? { ...p, bio: bioDraft.trim() || null } : p));
    setSaving(false);
  }

  async function uploadAvatar(file: File) {
    if (!profile || !canEdit) return;
    setUploading(true);
    setError(null);
    try {
      const ext = fileExt(file.name);
      const path = `${profile.user_id}/avatar.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("avatars").upload(path, file, { cacheControl: "3600", upsert: true });
      if (uploadErr) {
        setError(uploadErr.message);
        return;
      }
      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
      const { error: profErr } = await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("user_id", profile.user_id);
      if (profErr) setError(profErr.message);
      else setProfile((p) => (p ? { ...p, avatar_url: publicUrl } : p));
    } finally {
      setUploading(false);
    }
  }

  if (!profile) return <div className="lmr-page"><div className="lmr-card rounded-[28px] p-6 text-sm text-white/70">Betöltés...</div></div>;

  const avatar = profile.avatar_url || "";
  const warningsActiveCount = warnings.filter((w) => w.is_active && (!w.expires_at || w.expires_at > new Date().toISOString())).length;

  return (
    <div className="lmr-page">
      <section className="lmr-hero rounded-[28px] p-6 md:p-8">
        <span className="lmr-chip inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white/70">Profil</span>
        <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">{profile.ic_name ?? "Profil"}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-white/75">
          {canEdit ? "Saját profilodat vagy vezetőségként másét is szerkesztheted." : "Itt megtekintheted a profilhoz tartozó adatokat, rangot és statisztikákat."}
        </p>
      </section>

      {error && <div className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</div>}

      <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="lmr-card rounded-[28px] p-5">
          <div className="overflow-hidden rounded-[24px] border border-white/10 bg-black/30">
            <div className="flex h-52 items-center justify-center">
              {avatar ? <img src={avatar} alt="Avatar" className="h-full w-full object-cover" /> : <div className="text-sm text-white/55">Nincs profilkép</div>}
            </div>
          </div>
          <div className="mt-4 text-xl font-semibold text-white">{profile.ic_name ?? "—"}</div>
          <div className="mt-2 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/78">Rang: <span className="font-medium text-white">{rank?.name ?? (rankMissing ? "Törölt rang" : "—")}</span></div>
          {canEdit ? (
            <div className="mt-5">
              <label className="text-xs uppercase tracking-[0.14em] text-white/55">Profilkép feltöltés</label>
              <input type="file" accept="image/*" className="mt-3 block w-full text-sm text-white/78" disabled={uploading} onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAvatar(f); }} />
              <div className="mt-2 text-xs text-white/50">{uploading ? "Feltöltés..." : "Bucket: avatars (public)"}</div>
            </div>
          ) : <div className="mt-5 text-xs text-white/50">Más profilját csak megtekinteni tudod.</div>}
        </aside>

        <div className="space-y-6">
          <section className="lmr-card rounded-[28px] p-5 md:p-6">
            <h2 className="text-xl font-semibold">Profil leírás</h2>
            <p className="mt-1 text-sm text-white/60">Rövid bemutatkozás és személyes profil információ.</p>
            {canEdit ? (
              <>
                <textarea className="mt-4 min-h-[140px] w-full rounded-[24px] border px-4 py-3 text-sm" value={bioDraft} onChange={(e) => setBioDraft(e.target.value)} placeholder="Írj magadról pár sort..." />
                <div className="mt-4 flex justify-end"><button className="lmr-btn lmr-btn-primary rounded-2xl px-4 py-2.5 text-sm font-medium" onClick={saveBio} disabled={saving}>{saving ? "Mentés..." : "Mentés"}</button></div>
              </>
            ) : <div className="mt-4 whitespace-pre-wrap rounded-[24px] border border-white/10 bg-white/[0.03] px-4 py-4 text-white/85">{profile.bio?.trim() ? profile.bio : "—"}</div>}
          </section>

          {canSeeStats && (
            <section className="lmr-card rounded-[28px] p-5 md:p-6">
              <h2 className="text-xl font-semibold">Statisztika</h2>
              <p className="mt-1 text-sm text-white/60">A részt vett események, akciók és figyelmeztetések áttekintése.</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="lmr-surface-soft rounded-[24px] p-4"><div className="text-xs uppercase tracking-[0.14em] text-white/52">Felvéve</div><div className="mt-2 text-lg font-semibold">{ymd(profile.created_at)}</div></div>
                <div className="lmr-surface-soft rounded-[24px] p-4"><div className="text-xs uppercase tracking-[0.14em] text-white/52">Figyelmeztetések</div><div className="mt-2 text-lg font-semibold">{warningsActiveCount}</div></div>
                <div className="lmr-surface-soft rounded-[24px] p-4"><div className="text-xs uppercase tracking-[0.14em] text-white/52">Események</div><div className="mt-2 text-lg font-semibold">{eventsCount}</div></div>
                <div className="lmr-surface-soft rounded-[24px] p-4"><div className="text-xs uppercase tracking-[0.14em] text-white/52">Akciók</div><div className="mt-2 text-lg font-semibold">{actionsCount}</div></div>
              </div>
            </section>
          )}

          {canSeeStats && (
            <section className="lmr-card rounded-[28px] p-5 md:p-6">
              <h2 className="text-xl font-semibold">Figyelmeztetések</h2>
              <p className="mt-1 text-sm text-white/60">Részletes lista a korábbi és aktív figyelmeztetésekről.</p>
              {warnings.length === 0 ? <div className="lmr-empty-state mt-4 rounded-[24px] px-4 py-8 text-sm">Nincs figyelmeztetés.</div> : <div className="mt-4 grid gap-3">{warnings.map((w) => <div key={w.id} className="lmr-surface-soft rounded-[24px] p-4"><div className="font-semibold text-white">{w.reason}</div><div className="mt-2 text-xs text-white/62">Kiállítva: {ymd(w.issued_at)} • Lejárat: {w.expires_at ? ymd(w.expires_at) : "—"} • Állapot: {w.is_active ? "Aktív" : "Inaktív"}</div></div>)}</div>}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
