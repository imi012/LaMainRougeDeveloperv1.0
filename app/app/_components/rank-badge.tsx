"use client";

type BadgeTone = {
  className: string;
};

function normalizeRankName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeRankKey(value: string) {
  return normalizeRankName(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function getRankBadgeTone(rankName: string | null | undefined): BadgeTone {
  const key = normalizeRankKey(rankName || "");

  if (["candidat"].includes(key)) {
    return {
      className: "border-cyan-400/35 bg-cyan-400/15 text-cyan-100",
    };
  }

  if (["soldat"].includes(key)) {
    return {
      className: "border-violet-400/35 bg-violet-500/15 text-violet-100",
    };
  }

  if (["frappeur"].includes(key)) {
    return {
      className: "border-yellow-300/35 bg-yellow-300/15 text-yellow-100",
    };
  }

  if (["veilleur"].includes(key)) {
    return {
      className: "border-sky-300/35 bg-sky-300/15 text-sky-100",
    };
  }

  if (["borreau", "bourreau"].includes(key)) {
    return {
      className: "border-amber-400/35 bg-amber-500/15 text-amber-100",
    };
  }

  if (["les executeurs", "les executeur"].includes(key)) {
    return {
      className: "border-violet-400/35 bg-violet-500/15 text-violet-100",
    };
  }

  if (["briscard"].includes(key)) {
    return {
      className: "border-orange-400/35 bg-orange-500/15 text-orange-100",
    };
  }

  if (["briscard fondateur"].includes(key)) {
    return {
      className: "border-orange-500/40 bg-orange-600/15 text-orange-100",
    };
  }

  if (["racoleur"].includes(key)) {
    return {
      className: "border-emerald-400/35 bg-emerald-500/15 text-emerald-100",
    };
  }

  if (["heritier", "héritier"].includes(key)) {
    return {
      className: "border-red-500/40 bg-red-600/15 text-red-100",
    };
  }

  if (["la chef"].includes(key)) {
    return {
      className: "border-red-600/45 bg-red-700/20 text-red-100",
    };
  }

  return {
    className: "border-white/15 bg-white/5 text-white/80",
  };
}

export default function RankBadge({
  name,
  className = "",
}: {
  name: string | null | undefined;
  className?: string;
}) {
  const tone = getRankBadgeTone(name);

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold tracking-[0.08em] ${tone.className} ${className}`}
    >
      {name || "Nincs rang"}
    </span>
  );
}