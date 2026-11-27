export function formatTp(value: number, mode: "exact" | "compact" = "exact"): string {
  if (!Number.isFinite(value)) return "—";
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (mode === "compact") {
    if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(2)}M`;
    if (abs >= 10_000) return `${sign}${(abs / 1000).toFixed(1)}k`;
  }
  if (abs >= 1000) {
    return `${sign}${abs.toLocaleString("en-US", { maximumFractionDigits: abs >= 10000 ? 0 : 2, minimumFractionDigits: 0 })}`;
  }
  return `${sign}${abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatSignedTp(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const prefix = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${prefix}${formatTp(Math.abs(value))}`;
}

export function formatPercent(prob: number, digits = 0): string {
  if (!Number.isFinite(prob)) return "—";
  const pct = prob * 100;
  if (pct > 0 && pct < 0.5 && digits === 0) return "<1%";
  if (pct > 99.5 && pct < 100 && digits === 0) return ">99%";
  return `${pct.toFixed(digits)}%`;
}

export function formatCents(price: number): string {
  if (!Number.isFinite(price)) return "—";
  const cents = price * 100;
  if (cents >= 10) return `${cents.toFixed(0)}¢`;
  return `${cents.toFixed(1)}¢`;
}

export function formatShares(shares: number): string {
  if (!Number.isFinite(shares)) return "—";
  if (Math.abs(shares) >= 100) {
    return shares.toLocaleString("en-US", { maximumFractionDigits: 1 });
  }
  return shares.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export function formatClose(iso: string | Date, now = new Date()): string {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  const diff = date.getTime() - now.getTime();
  const past = diff < 0;
  const abs = Math.abs(diff);
  const hour = 3_600_000;
  const day = 86_400_000;
  if (abs < hour) return past ? "Closed just now" : "Closes soon";
  if (abs < day) {
    const hours = Math.round(abs / hour);
    return past ? `Closed ${hours}h ago` : `Closes in ${hours}h`;
  }
  const days = Math.round(abs / day);
  if (days < 45) return past ? `Closed ${days}d ago` : `Closes in ${days}d`;
  const label = date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return past ? `Closed ${label}` : `Closes ${label}`;
}

export function formatDateTime(iso: string | Date | number): string {
  const date = typeof iso === "string" || typeof iso === "number" ? new Date(iso) : iso;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDay(iso: string | Date): string {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function resolutionLabel(
  resolution: string | null,
  resolutionProb: number | null,
  answers: { id: string; text: string }[],
  type: "BINARY" | "MULTIPLE",
): string | null {
  if (!resolution) return null;
  if (resolution === "YES") return "Resolved YES";
  if (resolution === "NO") return "Resolved NO";
  if (resolution === "CANCEL") return "Cancelled";
  if (resolution === "MKT") {
    if (type === "MULTIPLE") return "Resolved to a split";
    return `Resolved ${formatPercent(resolutionProb ?? 0)}`;
  }
  const answer = answers.find((item) => item.id === resolution);
  return answer ? `Resolved · ${answer.text}` : "Resolved";
}

export function slugify(text: string): string {
  const base = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return base || "market";
}

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function uid(prefix = ""): string {
  const id = crypto.randomUUID().replace(/-/g, "").slice(0, 18);
  return prefix ? `${prefix}_${id}` : id;
}
