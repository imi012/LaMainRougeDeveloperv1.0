type DecisionBadgeProps = {
  value: string | null | undefined;
  className?: string;
};

function normalizeDecision(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function getDecisionConfig(value: string | null | undefined) {
  const normalized = normalizeDecision(value);

  if (["approved", "accepted", "elfogadva", "jóváhagyva", "approved / accepted"].includes(normalized)) {
    return {
      label: "Elfogadva",
      className: "border-emerald-500/35 bg-emerald-500/15 text-emerald-200",
    };
  }

  if (["pending", "open", "függőben", "fuggoben", "beküldve / függőben", "bekuldve / fuggoben", "beküldve", "bekuldve"].includes(normalized)) {
    return {
      label: "Függőben",
      className: "border-yellow-500/35 bg-yellow-500/15 text-yellow-200",
    };
  }

  if (["rejected", "declined", "denied", "elutasítva", "elutasitva"].includes(normalized)) {
    return {
      label: "Elutasítva",
      className: "border-red-500/35 bg-red-500/15 text-red-200",
    };
  }

  return null;
}

export default function DecisionBadge({ value, className = "" }: DecisionBadgeProps) {
  const config = getDecisionConfig(value);

  if (!config) {
    return <span className={className}>{value ?? "—"}</span>;
  }

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full border px-3 py-1 text-xs font-semibold ${config.className} ${className}`.trim()}
    >
      {config.label}
    </span>
  );
}
