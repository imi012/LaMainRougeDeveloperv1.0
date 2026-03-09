"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
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

type AvatarEditorState = {
  file: File | null;
  src: string | null;
  scale: number;
  minScale: number;
  x: number;
  y: number;
  imageWidth: number;
  imageHeight: number;
  dragging: boolean;
  resizing: boolean;
  dragStartX: number;
  dragStartY: number;
  startX: number;
  startY: number;
  startScale: number;
};

const EDITOR_SIZE = 360;
const EXPORT_SIZE = 512;

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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function computeCoverScale(imageWidth: number, imageHeight: number) {
  return Math.max(EDITOR_SIZE / imageWidth, EDITOR_SIZE / imageHeight);
}

function constrainPosition(
  x: number,
  y: number,
  scale: number,
  imageWidth: number,
  imageHeight: number
) {
  const scaledWidth = imageWidth * scale;
  const scaledHeight = imageHeight * scale;

  const minX = Math.min(0, EDITOR_SIZE - scaledWidth);
  const maxX = 0;
  const minY = Math.min(0, EDITOR_SIZE - scaledHeight);
  const maxY = 0;

  return {
    x: clamp(x, minX, maxX),
    y: clamp(y, minY, maxY),
  };
}

async function loadImage(src: string) {
  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Nem sikerült betölteni a képet."));
    img.src = src;
  });
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
  const [editingBio, setEditingBio] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [warnings, setWarnings] = useState<WarningRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [avatarEditorOpen, setAvatarEditorOpen] = useState(false);
  const [avatarEditor, setAvatarEditor] = useState<AvatarEditorState>({
    file: null,
    src: null,
    scale: 1,
    minScale: 1,
    x: 0,
    y: 0,
    imageWidth: 0,
    imageHeight: 0,
    dragging: false,
    resizing: false,
    dragStartX: 0,
    dragStartY: 0,
    startX: 0,
    startY: 0,
    startScale: 1,
  });

  const editorStageRef = useRef<HTMLDivElement | null>(null);

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
        setEditingBio(false);
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

        if (!cancelled) {
          setWarnings((warnData ?? []) as WarningRow[]);
        }
      } else if (!cancelled) {
        setWarnings([]);
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

  useEffect(() => {
    if (!avatarEditorOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const previousTouchAction = document.body.style.touchAction;

    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";

    const preventPageScroll = (event: WheelEvent | TouchEvent) => {
      event.preventDefault();
    };

    window.addEventListener("wheel", preventPageScroll, { passive: false });
    window.addEventListener("touchmove", preventPageScroll, { passive: false });

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.touchAction = previousTouchAction;
      window.removeEventListener("wheel", preventPageScroll as EventListener);
      window.removeEventListener("touchmove", preventPageScroll as EventListener);
    };
  }, [avatarEditorOpen]);

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
      setEditingBio(false);
    }

    setSaving(false);
  }

  function cancelBioEdit() {
    setBioDraft(profile?.bio ?? "");
    setEditingBio(false);
  }

  async function openAvatarEditor(file: File) {
    if (!profile || !canEdit) return;

    setError(null);

    const objectUrl = URL.createObjectURL(file);

    try {
      const img = await loadImage(objectUrl);
      const minScale = computeCoverScale(img.width, img.height);
      const scaledWidth = img.width * minScale;
      const scaledHeight = img.height * minScale;
      const centeredX = (EDITOR_SIZE - scaledWidth) / 2;
      const centeredY = (EDITOR_SIZE - scaledHeight) / 2;

      setAvatarEditor({
        file,
        src: objectUrl,
        scale: minScale,
        minScale,
        x: centeredX,
        y: centeredY,
        imageWidth: img.width,
        imageHeight: img.height,
        dragging: false,
        resizing: false,
        dragStartX: 0,
        dragStartY: 0,
        startX: centeredX,
        startY: centeredY,
        startScale: minScale,
      });

      setAvatarEditorOpen(true);
    } catch (e) {
      URL.revokeObjectURL(objectUrl);
      setError(e instanceof Error ? e.message : "Nem sikerült betölteni a képet.");
    }
  }

  function closeAvatarEditor() {
    if (avatarEditor.src) {
      URL.revokeObjectURL(avatarEditor.src);
    }

    setAvatarEditorOpen(false);
    setAvatarEditor({
      file: null,
      src: null,
      scale: 1,
      minScale: 1,
      x: 0,
      y: 0,
      imageWidth: 0,
      imageHeight: 0,
      dragging: false,
      resizing: false,
      dragStartX: 0,
      dragStartY: 0,
      startX: 0,
      startY: 0,
      startScale: 1,
    });
  }

  function updateAvatarPosition(nextX: number, nextY: number, nextScale = avatarEditor.scale) {
    setAvatarEditor((prev) => {
      const constrained = constrainPosition(
        nextX,
        nextY,
        nextScale,
        prev.imageWidth,
        prev.imageHeight
      );

      return {
        ...prev,
        x: constrained.x,
        y: constrained.y,
      };
    });
  }

  function beginDrag(clientX: number, clientY: number) {
    setAvatarEditor((prev) => ({
      ...prev,
      dragging: true,
      resizing: false,
      dragStartX: clientX,
      dragStartY: clientY,
      startX: prev.x,
      startY: prev.y,
      startScale: prev.scale,
    }));
  }

  function beginResize(clientX: number, clientY: number) {
    setAvatarEditor((prev) => ({
      ...prev,
      resizing: true,
      dragging: false,
      dragStartX: clientX,
      dragStartY: clientY,
      startX: prev.x,
      startY: prev.y,
      startScale: prev.scale,
    }));
  }

  function handlePointerMove(clientX: number, clientY: number) {
    setAvatarEditor((prev) => {
      if (prev.dragging) {
        const dx = clientX - prev.dragStartX;
        const dy = clientY - prev.dragStartY;

        const constrained = constrainPosition(
          prev.startX + dx,
          prev.startY + dy,
          prev.scale,
          prev.imageWidth,
          prev.imageHeight
        );

        return {
          ...prev,
          x: constrained.x,
          y: constrained.y,
        };
      }

      if (prev.resizing) {
        const delta = (clientX - prev.dragStartX + (clientY - prev.dragStartY)) / 2;
        const scaleFactor = 1 + delta / 220;
        const nextScale = clamp(prev.startScale * scaleFactor, prev.minScale, prev.minScale * 6);

        const centerX =
          (EDITOR_SIZE / 2 - prev.startX) / prev.startScale / prev.imageWidth;
        const centerY =
          (EDITOR_SIZE / 2 - prev.startY) / prev.startScale / prev.imageHeight;

        const nextX = EDITOR_SIZE / 2 - prev.imageWidth * nextScale * centerX;
        const nextY = EDITOR_SIZE / 2 - prev.imageHeight * nextScale * centerY;

        const constrained = constrainPosition(
          nextX,
          nextY,
          nextScale,
          prev.imageWidth,
          prev.imageHeight
        );

        return {
          ...prev,
          scale: nextScale,
          x: constrained.x,
          y: constrained.y,
        };
      }

      return prev;
    });
  }

  function stopPointerAction() {
    setAvatarEditor((prev) => ({
      ...prev,
      dragging: false,
      resizing: false,
    }));
  }

  function handleWheelZoom(e: React.WheelEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();

    setAvatarEditor((prev) => {
      const direction = e.deltaY > 0 ? -0.08 : 0.08;
      const nextScale = clamp(prev.scale + direction, prev.minScale, prev.minScale * 6);

      if (nextScale === prev.scale) {
        return prev;
      }

      const rect = editorStageRef.current?.getBoundingClientRect();
      const pointerX = rect ? e.clientX - rect.left : EDITOR_SIZE / 2;
      const pointerY = rect ? e.clientY - rect.top : EDITOR_SIZE / 2;

      const relX = (pointerX - prev.x) / (prev.imageWidth * prev.scale);
      const relY = (pointerY - prev.y) / (prev.imageHeight * prev.scale);

      const nextX = pointerX - prev.imageWidth * nextScale * relX;
      const nextY = pointerY - prev.imageHeight * nextScale * relY;

      const constrained = constrainPosition(
        nextX,
        nextY,
        nextScale,
        prev.imageWidth,
        prev.imageHeight
      );

      return {
        ...prev,
        scale: nextScale,
        x: constrained.x,
        y: constrained.y,
      };
    });
  }

  async function saveAvatarFromEditor() {
    if (!profile || !canEdit || !avatarEditor.src || !avatarEditor.file) return;

    setUploading(true);
    setError(null);

    try {
      const img = await loadImage(avatarEditor.src);
      const canvas = document.createElement("canvas");
      canvas.width = EXPORT_SIZE;
      canvas.height = EXPORT_SIZE;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("Nem sikerült létrehozni a képszerkesztő felületet.");
      }

      ctx.clearRect(0, 0, EXPORT_SIZE, EXPORT_SIZE);
      ctx.save();
      ctx.beginPath();
      ctx.arc(EXPORT_SIZE / 2, EXPORT_SIZE / 2, EXPORT_SIZE / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();

      const exportScale = EXPORT_SIZE / EDITOR_SIZE;
      ctx.drawImage(
        img,
        avatarEditor.x * exportScale,
        avatarEditor.y * exportScale,
        avatarEditor.imageWidth * avatarEditor.scale * exportScale,
        avatarEditor.imageHeight * avatarEditor.scale * exportScale
      );
      ctx.restore();

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((result) => resolve(result), "image/png")
      );

      if (!blob) {
        throw new Error("Nem sikerült elkészíteni a kivágott képet.");
      }

      const path = `${profile.user_id}/avatar.png`;

      const { error: uploadErr } = await supabase.storage.from("avatars").upload(path, blob, {
        cacheControl: "3600",
        upsert: true,
        contentType: "image/png",
      });

      if (uploadErr) {
        throw uploadErr;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(path);

      const { error: profileErr } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("user_id", profile.user_id);

      if (profileErr) {
        throw profileErr;
      }

      setProfile((prev) => (prev ? { ...prev, avatar_url: publicUrl } : prev));
      closeAvatarEditor();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nem sikerült menteni a profilképet.");
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
    <>
      <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6 lg:px-8">
        <div className="space-y-5">
          <section className="lmr-card min-w-0 overflow-hidden rounded-[28px] p-5 md:p-6">
            <div className="flex min-w-0 flex-col gap-5 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <div className="text-xs uppercase tracking-[0.16em] text-white/45">Profil</div>

                <h1 className="mt-2 break-words text-3xl font-semibold tracking-tight text-white md:text-4xl">
                  {profile.ic_name ?? "Profil"}
                </h1>

                <p className="mt-2 max-w-2xl break-words text-sm leading-6 text-white/65">
                  {canEdit
                    ? ""
                    : "Itt megtekintheted a profilhoz tartozó adatokat."}
                </p>
              </div>

              {error ? (
                <div className="max-w-full break-words rounded-[18px] border border-red-500/35 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {error}
                </div>
              ) : null}
            </div>

            <div className="mt-6 grid min-w-0 gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
              <div className="lmr-surface-soft min-w-0 overflow-hidden rounded-[28px] p-5">
                <div className="flex min-w-0 flex-col items-center text-center">
                  {avatar ? (
                    <div className="relative h-36 w-36 shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/5">
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
                    <div className="flex h-36 w-36 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 text-center text-sm text-white/50">
                      Nincs profilkép
                    </div>
                  )}

                  <div className="mt-4 max-w-full break-words text-3xl font-semibold leading-tight text-white">
                    {profile.ic_name ?? "—"}
                  </div>

                  <div className="mt-3 max-w-full break-words text-sm leading-6 text-white/65">
                    Rang: {rank?.name ?? (rankMissing ? "Törölt rang" : "—")}
                  </div>

                  <div className="max-w-full break-words text-sm leading-6 text-white/55">
                    Státusz: {profile.status ?? "—"}
                  </div>

                  {canEdit ? (
                    <div className="mt-5 w-full min-w-0">
                      <label className="lmr-btn lmr-btn-primary flex w-full cursor-pointer items-center justify-center rounded-2xl px-4 py-2.5 text-center text-sm font-medium leading-5">
                        {uploading ? "Feltöltés..." : "Profilkép feltöltése"}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={uploading}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) {
                              void openAvatarEditor(f);
                            }
                            e.currentTarget.value = "";
                          }}
                        />
                      </label>

                      <div className="mt-2 break-words text-center text-xs leading-5 text-white/45">
                        
                      </div>
                    </div>
                  ) : (
                    <div className="mt-5 max-w-full break-words text-sm leading-6 text-white/50">
                      Más profilját csak megtekinteni tudod.
                    </div>
                  )}
                </div>
              </div>

              <div className="min-w-0 space-y-5">
                <section className="lmr-card min-w-0 overflow-hidden rounded-[28px] p-5 md:p-6">
                  <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h2 className="break-words text-xl font-semibold text-white">Profil leírás</h2>
                      <p className="mt-1 break-words text-sm leading-6 text-white/60">
                        
                      </p>
                    </div>

                    {canEdit && !editingBio ? (
                      <button
                        type="button"
                        onClick={() => setEditingBio(true)}
                        className="lmr-btn lmr-btn-primary shrink-0 rounded-2xl px-4 py-2.5 text-sm font-medium"
                      >
                        Szerkesztés
                      </button>
                    ) : null}
                  </div>

                  {canEdit && editingBio ? (
                    <>
                      <textarea
                        value={bioDraft}
                        onChange={(e) => setBioDraft(e.target.value)}
                        placeholder="Írj magadról pár sort..."
                        rows={8}
                        className="mt-4 block min-h-[180px] w-full resize-y rounded-[24px] border border-white/10 bg-white/[0.03] px-4 py-4 text-white outline-none transition placeholder:text-white/30 focus:border-white/20"
                      />

                      <div className="mt-4 flex flex-wrap justify-end gap-3">
                        <button
                          type="button"
                          className="lmr-btn rounded-2xl px-4 py-2.5 text-sm font-medium"
                          onClick={cancelBioEdit}
                          disabled={saving}
                        >
                          Mégse
                        </button>

                        <button
                          type="button"
                          className="lmr-btn lmr-btn-primary rounded-2xl px-4 py-2.5 text-sm font-medium disabled:opacity-60"
                          onClick={() => void saveBio()}
                          disabled={saving}
                        >
                          {saving ? "Mentés..." : "Mentés"}
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="mt-4 overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.03] px-4 py-4 text-white/85">
                      <p className="break-words whitespace-pre-wrap leading-7">
                        {profile.bio?.trim() ? profile.bio : "—"}
                      </p>
                    </div>
                  )}
                </section>

                {canSeeStats ? (
                  <section className="lmr-card min-w-0 overflow-hidden rounded-[28px] p-5 md:p-6">
                    <h2 className="break-words text-xl font-semibold text-white">Statisztika</h2>
                    <p className="mt-1 break-words text-sm leading-6 text-white/60">
                     
                    </p>

                    <div className="mt-5 grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-2">
                      <div className="lmr-surface-soft min-w-0 overflow-hidden rounded-[24px] p-4">
                        <div className="break-words text-xs uppercase tracking-[0.12em] text-white/52">
                          Felvéve
                        </div>
                        <div className="mt-2 break-words text-lg font-semibold leading-tight text-white">
                          {ymd(profile.created_at)}
                        </div>
                      </div>

                      <div className="lmr-surface-soft min-w-0 overflow-hidden rounded-[24px] p-4">
                        <div className="break-words text-xs uppercase tracking-[0.12em] text-white/52">
                          Aktív figyelmeztetések
                        </div>
                        <div className="mt-2 break-words text-lg font-semibold leading-tight text-white">
                          {warningsActiveCount}
                        </div>
                      </div>
                    </div>
                  </section>
                ) : null}

                {canSeeWarnings ? (
                  <section className="lmr-card min-w-0 overflow-hidden rounded-[28px] p-5 md:p-6">
                    <h2 className="break-words text-xl font-semibold text-white">Figyelmeztetések</h2>
                    <p className="mt-1 break-words text-sm leading-6 text-white/60">
                      
                    </p>

                    {warnings.length === 0 ? (
                      <div className="lmr-empty-state mt-4 rounded-[24px] px-4 py-8 text-sm">
                        Nincs figyelmeztetés.
                      </div>
                    ) : (
                      <div className="mt-4 grid gap-3">
                        {warnings.map((w) => (
                          <div
                            key={w.id}
                            className="lmr-surface-soft min-w-0 overflow-hidden rounded-[24px] p-4"
                          >
                            <div className="break-words text-base font-semibold leading-7 text-white">
                              {w.reason}
                            </div>
                            <div className="mt-2 break-words text-xs leading-6 text-white/62">
                              Kiállítva: {ymd(w.issued_at)} • Lejárat: {w.expires_at ? ymd(w.expires_at) : "—"} •
                              Állapot: {w.is_active ? "Aktív" : "Inaktív"}
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

      {avatarEditorOpen && avatarEditor.src ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 px-4 py-6"
          style={{ overscrollBehavior: "contain" }}
          onMouseMove={(e) => handlePointerMove(e.clientX, e.clientY)}
          onMouseUp={stopPointerAction}
          onMouseLeave={stopPointerAction}
          onWheel={handleWheelZoom}
        >
          <div className="w-full max-w-3xl rounded-[28px] border border-white/10 bg-[#111111] p-5 shadow-2xl">
            <div className="flex flex-col gap-5 lg:flex-row">
              <div className="flex-1">
                <div className="mb-3">
                  <div className="text-xl font-semibold text-white">Profilkép igazítása</div>
                  <div className="mt-1 text-sm text-white/60">
                    Húzd a képet, görgővel zoomolj.
                  </div>
                </div>

                <div className="flex justify-center">
                  <div
                    ref={editorStageRef}
                    className="relative h-[360px] w-[360px] select-none overflow-hidden rounded-full border border-white/15 bg-black"
                    onMouseDown={(e) => {
                      if (e.target === e.currentTarget) {
                        beginDrag(e.clientX, e.clientY);
                      }
                    }}
                  >
                    <img
                      src={avatarEditor.src}
                      alt="Avatar szerkesztés"
                      draggable={false}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        beginDrag(e.clientX, e.clientY);
                      }}
                      className="pointer-events-auto absolute max-w-none select-none"
                      style={{
                        left: avatarEditor.x,
                        top: avatarEditor.y,
                        width: avatarEditor.imageWidth * avatarEditor.scale,
                        height: avatarEditor.imageHeight * avatarEditor.scale,
                        userSelect: "none",
                      }}
                    />

                    <div className="pointer-events-none absolute inset-0 rounded-full ring-2 ring-white/80" />

                    <button
                      type="button"
                      aria-label="Méretezés"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        beginResize(e.clientX, e.clientY);
                      }}
                      className="absolute bottom-5 right-5 z-10 h-8 w-8 rounded-full border border-white/30 bg-white/20 backdrop-blur transition hover:bg-white/30"
                    >
                      <span className="block text-center text-sm text-white">↘</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="w-full lg:w-[220px]">
                <div className="text-sm font-medium text-white">Előnézet</div>
                <div className="mt-3 flex justify-center lg:justify-start">
                  <div className="relative h-28 w-28 overflow-hidden rounded-full border border-white/15 bg-black">
                    <img
                      src={avatarEditor.src}
                      alt="Avatar előnézet"
                      draggable={false}
                      className="absolute max-w-none select-none"
                      style={{
                        left: (avatarEditor.x / EDITOR_SIZE) * 112,
                        top: (avatarEditor.y / EDITOR_SIZE) * 112,
                        width: (avatarEditor.imageWidth * avatarEditor.scale / EDITOR_SIZE) * 112,
                        height: (avatarEditor.imageHeight * avatarEditor.scale / EDITOR_SIZE) * 112,
                        userSelect: "none",
                      }}
                    />
                  </div>
                </div>

                

                <div className="mt-6 flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={() => void saveAvatarFromEditor()}
                    disabled={uploading}
                    className="lmr-btn lmr-btn-primary rounded-2xl px-4 py-2.5 text-sm font-medium disabled:opacity-60"
                  >
                    {uploading ? "Mentés..." : "Mentés"}
                  </button>

                  <button
                    type="button"
                    onClick={closeAvatarEditor}
                    disabled={uploading}
                    className="lmr-btn rounded-2xl px-4 py-2.5 text-sm font-medium disabled:opacity-60"
                  >
                    Mégse
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}