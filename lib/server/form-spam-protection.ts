type SpamProtectionOptions = {
  admin: any;
  table: string;
  userId: string;
  timeColumn: string;
  fingerprint: Record<string, unknown>;
  selectColumns: string[];
  cooldownMs?: number;
  duplicateWindowMs?: number;
};

function normalizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeValue(item));
  }

  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = normalizeValue((value as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }

  if (typeof value === "string") {
    return value.trim();
  }

  return value ?? null;
}

function buildFingerprint(value: Record<string, unknown>) {
  return JSON.stringify(normalizeValue(value));
}

export async function checkFormSpamProtection(options: SpamProtectionOptions) {
  const cooldownMs = options.cooldownMs ?? 10_000;
  const duplicateWindowMs = options.duplicateWindowMs ?? 5 * 60_000;

  const select = Array.from(new Set([options.timeColumn, ...options.selectColumns])).join(",");

  const { data, error } = await options.admin
    .from(options.table)
    .select(select)
    .eq("user_id", options.userId)
    .order(options.timeColumn, { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("form spam protection error:", error);
    throw new Error("Nem sikerült ellenőrizni a beküldési limitet.");
  }

  if (!data) {
    return null;
  }

  const lastTimeRaw = data?.[options.timeColumn];
  const lastTime = lastTimeRaw ? new Date(String(lastTimeRaw)).getTime() : NaN;
  const now = Date.now();

  if (!Number.isNaN(lastTime) && now - lastTime < cooldownMs) {
    return "Túl gyorsan próbálkozol. Kérlek várj pár másodpercet.";
  }

  const currentFingerprint = buildFingerprint(options.fingerprint);

  const lastFingerprintSource = options.selectColumns.reduce<Record<string, unknown>>((acc, key) => {
    acc[key] = data?.[key];
    return acc;
  }, {});

  const lastFingerprint = buildFingerprint(lastFingerprintSource);

  if (!Number.isNaN(lastTime) && now - lastTime < duplicateWindowMs && currentFingerprint === lastFingerprint) {
    return "Ugyanez a beküldés nemrég már rögzítve lett.";
  }

  return null;
}