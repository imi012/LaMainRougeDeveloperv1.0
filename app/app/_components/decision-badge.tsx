"use client";

type Props = {
  value?: string | boolean | null;
};

function normalize(value: Props["value"]) {
  if (value === true) return "approved";
  if (value === false) return "rejected";

  const v = String(value ?? "").toLowerCase();

  if (
    v === "approved" ||
    v === "accepted" ||
    v === "elfogadva" ||
    v === "jóváhagyva"
  )
    return "approved";

  if (
    v === "pending" ||
    v === "open" ||
    v === "submitted" ||
    v === "függőben" ||
    v === "beküldve"
  )
    return "pending";

  if (
    v === "rejected" ||
    v === "declined" ||
    v === "denied" ||
    v === "elutasítva" ||
    v === "visszautasítva"
  )
    return "rejected";

  return "pending";
}

export default function DecisionBadge({ value }: Props) {
  const status = normalize(value);

  if (status === "approved") {
    return (
      <span className="px-3 py-1 text-xs font-semibold rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
        Elfogadva
      </span>
    );
  }

  if (status === "rejected") {
    return (
      <span className="px-3 py-1 text-xs font-semibold rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
        Elutasítva
      </span>
    );
  }

  return (
    <span className="px-3 py-1 text-xs font-semibold rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
      Függőben
    </span>
  );
}