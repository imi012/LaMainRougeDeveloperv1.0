export function formatMoney(value: string | number | null | undefined) {
  if (!value) return "—";

  const num =
    typeof value === "number"
      ? value
      : parseInt(String(value).replace(/[^\d]/g, ""), 10);

  if (isNaN(num)) return "—";

  return num.toLocaleString("hu-HU") + "$";
}