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

type EditorImageInfo = {
  src: string;
  width: number;
  height: number;
  extension: string;
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

const EDITOR_SIZE = 320;
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

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

  const [editorImage, setEditorImage] = useState<EditorImageInfo | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorZoom, setEditorZoom] = useState(1);
  const [editorX, setEditorX] = useState(0);
  const [editorY, setEditorY] = useState(0);
  const [editorSaving, setEditorSaving] = useState(false);
  const [draggingImage, setDraggingImage] = useState(false);
  const [draggingCorner, setDraggingCorner] = useState(false);

  const dragStartRef = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null);
  const resizeStartRef = useRef<{ x: number; y: number; startZoom: number } | null>(null);

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

  const baseCoverScale = useMemo(() => {
    if (!editorImage) return 1;
    return Math.max(EDITOR_SIZE / editorImage.width, EDITOR_SIZE / editorImage.height);
  }, [editorImage]);

  const renderedImageWidth = useMemo(() => {
    if (!editorImage) return EDITOR_SIZE;
    return editorImage.width * baseCoverScale * editorZoom;
  }, [editorImage, baseCoverScale, editorZoom]);

  const renderedImageHeight = useMemo(() => {
    if (!editorImage) return EDITOR_SIZE;
    return editorImage.height * baseCoverScale * editorZoom;
  }, [editorImage, baseCoverScale, editorZoom]);

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

    void load();

    return () => {
      cancelled = true;
    };
  }, [router, supabase, userParam]);

  useEffect(() => {
    if (!editorOpen) {
      setDraggingImage(false);
      setDraggingCorner(false);
      dragStartRef.current = null;
      resizeStartRef.current = null;
    }
  }, [editorOpen]);

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

  function closeEditor() {
    setEditorOpen(false);
    setEditorImage(null);
    setEditorZoom(1);
    setEditorX(0);
    setEditorY(0);
    setEditorSaving(false);
  }

  async function handleAvatarFile(file: File) {
    if (!profile || !canEdit) return;

    setError(null);

    const extension = fileExt(file.name);

    const readerResult = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
      reader.onerror = () => reject(new Error("A kép beolvasása nem sikerült."));
      reader.readAsDataURL(file);
    });

    const imageInfo = await new Promise<EditorImageInfo>((resolve, reject) => {
      const img = new window.Image();
      img.onload = () => {
        resolve({
          src: readerResult,
          width: img.naturalWidth,
          height: img.naturalHeight,
          extension,
        });
      };
      img.onerror = () => reject(new Error("A kép betöltése nem sikerült."));
      img.src = readerResult;
    });

    setEditorImage(imageInfo);
    setEditorZoom(1);
    setEditorX(0);
    setEditorY(0);
    setEditorOpen(true);
  }

  function clampZoom(nextZoom: number) {
    return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom));
  }

  function onEditorWheel(event: React.WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    const delta = event.deltaY;
    const nextZoom = clampZoom(editorZoom + (delta > 0 ? -0.08 : 0.08));
    setEditorZoom(nextZoom);
  }

  function startImageDrag(clientX: number, clientY: number) {
    dragStartRef.current = { x: clientX, y: clientY, startX: editorX, startY: editorY };
    setDraggingImage(true);
  }

  function startCornerResize(clientX: number, clientY: number) {
    resizeStartRef.current = { x: clientX, y: clientY, startZoom: editorZoom };
    setDraggingCorner(true);
  }

  function onPointerMove(clientX: number, clientY: number) {
    if (draggingImage && dragStartRef.current) {
      const dx = clientX - dragStartRef.current.x;
      const dy = clientY - dragStartRef.current.y;
      setEditorX(dragStartRef.current.startX + dx);
      setEditorY(dragStartRef.current.startY + dy);
      return;
    }

    if (draggingCorner && resizeStartRef.current) {
      const dx = clientX - resizeStartRef.current.x;
      const dy = clientY - resizeStartRef.current.y;
      const distance = (dx + dy) / 280;
      setEditorZoom(clampZoom(resizeStartRef.current.startZoom + distance));
    }
  }

  async function uploadCroppedAvatar() {
    if (!profile || !editorImage) return;

    setEditorSaving(true);
    setUploading(true);
    setError(null);

    try {
      const sourceImg = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new window.Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("A kép feldolgozása nem sikerült."));
        img.src = editorImage.src;
      });

      const outputSize = 512;
      const canvas = document.createElement("canvas");
      canvas.width = outputSize;
      canvas.height = outputSize;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        throw new Error("A képszerkesztő nem tudta létrehozni a vásznat.");
      }

      ctx.clearRect(0, 0, outputSize, outputSize);
      ctx.save();
      ctx.beginPath();
      ctx.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();

      const previewToOutput = outputSize / EDITOR_SIZE;
      const drawWidth = sourceImg.naturalWidth * baseCoverScale * editorZoom * previewToOutput;
      const drawHeight = sourceImg.naturalHeight * baseCoverScale * editorZoom * previewToOutput;
      const drawX = outputSize / 2 - drawWidth / 2 + editorX * previewToOutput;
      const drawY = outputSize / 2 - drawHeight / 2 + editorY * previewToOutput;

      ctx.drawImage(sourceImg, drawX, drawY, drawWidth, drawHeight);
      ctx.restore();

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((result) => {
          if (result) resolve(result);
          else reject(new Error("A kivágott kép mentése nem sikerült."));
        }, "image/png");
      });

      const path = `${profile.user_id}/avatar.png`;

      const { error: uploadErr } = await supabase.storage.from("avatars").upload(path, blob, {
        cacheControl: "3600",
        upsert: true,
        contentType: "image/png",
      });

      if (uploadErr) {
        throw new Error(uploadErr.message);
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(path);

      const bustUrl = `${publicUrl}${publicUrl.includes("?") ? "&" : "?"}t=${Date.now()}`;

      const { error: profileErr } = await supabase
        .from("profiles")
        .update({ avatar_url: bustUrl })
        .eq("user_id", profile.user_id);

      if (profileErr) {
        throw new Error(profileErr.message);
      }

      setProfile((prev) => (prev ? { ...prev, avatar_url: bustUrl } : prev));
      closeEditor();
    } catch (err) {
      setError(err instanceof Error ? err.message : "A profilkép mentése nem sikerült.");
    } finally {
      setEditorSaving(false);
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
                    ? "Saját profilodat vagy vezetőségként másét is szerkesztheted."
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
                            if (f) void handleAvatarFile(f);
                            e.currentTarget.value = "";
                          }}
                        />
                      </label>

                      <div className="mt-2 break-words text-center text-xs leading-5 text-white/45">
                        Feltöltés után húzással és görgővel tudod igazítani.
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
                        Rövid bemutatkozás és személyes profil információ.
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
                      A profilhoz tartozó alap statisztikák áttekintése.
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
                      Részletes lista a korábbi és aktív figyelmeztetésekről.
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

      {editorOpen && editorImage ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-2xl rounded-[28px] border border-white/10 bg-[#111111] p-5 shadow-2xl md:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-white">Profilkép igazítása</h2>
                <p className="mt-1 text-sm text-white/60">
                  Fogd meg és húzd a képet. A jobb alsó sarokkal vagy az egérgörgővel tudsz nagyítani.
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-col items-center gap-4">
              <div
                className="relative overflow-hidden rounded-full border border-white/15 bg-black/40 shadow-inner"
                style={{ width: EDITOR_SIZE, height: EDITOR_SIZE }}
                onWheel={onEditorWheel}
                onMouseMove={(e) => onPointerMove(e.clientX, e.clientY)}
                onMouseUp={() => {
                  setDraggingImage(false);
                  setDraggingCorner(false);
                }}
                onMouseLeave={() => {
                  setDraggingImage(false);
                  setDraggingCorner(false);
                }}
                onTouchMove={(e) => {
                  const touch = e.touches[0];
                  if (touch) onPointerMove(touch.clientX, touch.clientY);
                }}
                onTouchEnd={() => {
                  setDraggingImage(false);
                  setDraggingCorner(false);
                }}
              >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.05),rgba(255,255,255,0.01)_60%,rgba(0,0,0,0.15)_100%)]" />

                <img
                  src={editorImage.src}
                  alt="Profilkép előnézet"
                  draggable={false}
                  className="absolute select-none"
                  style={{
                    width: renderedImageWidth,
                    height: renderedImageHeight,
                    left: `calc(50% - ${renderedImageWidth / 2}px + ${editorX}px)`,
                    top: `calc(50% - ${renderedImageHeight / 2}px + ${editorY}px)`,
                    maxWidth: "none",
                    touchAction: "none",
                    cursor: draggingImage ? "grabbing" : "grab",
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    startImageDrag(e.clientX, e.clientY);
                  }}
                  onTouchStart={(e) => {
                    const touch = e.touches[0];
                    if (touch) startImageDrag(touch.clientX, touch.clientY);
                  }}
                />

                <button
                  type="button"
                  aria-label="Méret állítása"
                  className="absolute bottom-5 right-5 h-8 w-8 rounded-full border border-white/20 bg-black/70 text-white shadow-lg"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    startCornerResize(e.clientX, e.clientY);
                  }}
                  onTouchStart={(e) => {
                    e.stopPropagation();
                    const touch = e.touches[0];
                    if (touch) startCornerResize(touch.clientX, touch.clientY);
                  }}
                >
                  ↘
                </button>
              </div>

              <div className="text-center text-xs text-white/55">
                Zoom: {Math.round(editorZoom * 100)}% • Görgő: nagyítás/kicsinyítés
              </div>
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                className="lmr-btn rounded-2xl px-4 py-2.5 text-sm font-medium"
                onClick={closeEditor}
                disabled={editorSaving}
              >
                Mégse
              </button>

              <button
                type="button"
                className="lmr-btn lmr-btn-primary rounded-2xl px-4 py-2.5 text-sm font-medium disabled:opacity-60"
                onClick={() => void uploadCroppedAvatar()}
                disabled={editorSaving}
              >
                {editorSaving ? "Mentés..." : "Mentés"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
