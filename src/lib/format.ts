export function formatCurrency(value: number | undefined | null): string {
  if (value === undefined || value === null) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatCompactCurrency(value: number | undefined | null): string {
  if (value === undefined || value === null) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPercent(value: number | undefined | null): string {
  if (value === undefined || value === null) return "0.00%";
  return new Intl.NumberFormat("en-US", {
    style: "percent",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value / 100);
}

export function formatNumber(value: number | undefined | null): string {
  if (value === undefined || value === null) return "0";
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatCompactNumber(value: number | undefined | null): string {
  if (value === undefined || value === null) return "0";
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

/* ────────────────────────────────────────────────────────────────────────
   Locale-aware compact formatter. Reads i18next.language at call time so
   call sites stay plain functions (no hook). For Chinese locales walks
   the CJK ladder 百 / 千 / 万 / 十万 / 百万 / 千万 / 亿; everything else
   falls back to native Intl compact (K / M / B).
   ──────────────────────────────────────────────────────────────────────── */
import i18n from "@app/lib/i18n";

export function isChineseLocale(lang?: string): boolean {
  const l = (lang ?? i18n.language ?? "en").toLowerCase();
  return l === "zh" || l.startsWith("zh-") || l.startsWith("zh_");
}

function trimZeros(n: number, maxFrac: number): string {
  const s = n.toFixed(maxFrac);
  if (maxFrac === 0) return s;
  return s.replace(/\.?0+$/, "");
}

interface FmtCompactOpts {
  /** Force a language; defaults to i18next.language. */
  lang?: string;
  /** Decimal digits in the short form. Default 1. */
  maxFrac?: number;
  /** Prefix (e.g. "$"). */
  prefix?: string;
}

/** Compact number → "1.5M" / "200万" depending on locale. */
export function fmtCompact(value: number | null | undefined, opts: FmtCompactOpts = {}): string {
  const v = typeof value === "number" && Number.isFinite(value) ? value : 0;
  const maxFrac = opts.maxFrac ?? 1;
  const prefix = opts.prefix ?? "";

  if (!isChineseLocale(opts.lang)) {
    return prefix + new Intl.NumberFormat(opts.lang || "en", {
      notation: "compact",
      maximumFractionDigits: maxFrac,
    }).format(v);
  }

  const abs = Math.abs(v);
  if (abs >= 1e8) return prefix + trimZeros(v / 1e8, maxFrac) + "亿";
  if (abs >= 1e7) return prefix + trimZeros(v / 1e7, maxFrac) + "千万";
  if (abs >= 1e6) return prefix + trimZeros(v / 1e6, maxFrac) + "百万";
  if (abs >= 1e5) return prefix + trimZeros(v / 1e5, maxFrac) + "十万";
  if (abs >= 1e4) return prefix + trimZeros(v / 1e4, maxFrac) + "万";
  if (abs >= 1e3) return prefix + trimZeros(v / 1e3, maxFrac) + "千";
  if (abs >= 1e2) return prefix + trimZeros(v / 1e2, maxFrac) + "百";
  return prefix + Math.round(v).toString();
}

/** USDT compact — `$` prefix wrapper around fmtCompact. */
export function fmtUsdtCompact(value: number | null | undefined, opts: Omit<FmtCompactOpts, "prefix"> = {}): string {
  return fmtCompact(value, { ...opts, prefix: "$" });
}
