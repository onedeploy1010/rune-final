// Supabase query hooks — replaces @/lib/queries's
// useListProjects / useGetProject / useGetProjectsSummary. Schema mirrors the
// api-server's `projects` table (Drizzle: lib/db/src/schema/projects.ts).
// Summary aggregation is computed client-side from the same fetch to avoid a
// separate round-trip and to match api-server's tvl-string parsing rules.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "./supabase";

export type ProjectRiskLevel = "low" | "medium" | "high";

export interface Project {
  id: number;
  name: string;
  symbol: string;
  category: string;
  description: string;
  rating: number;
  riskLevel: ProjectRiskLevel;
  apy: number;
  tvl: string;          // e.g. "$1.5B"
  marketCap: string;
  website: string | null;
  tags: string[];
  isRecommended: boolean;
  trending: boolean;
  archived: boolean;
  createdAt: string;    // ISO timestamp
}

export interface ProjectsSummary {
  totalProjects: number;
  totalTvl: string;
  avgApy: number;
  recommendedCount: number;
  categoryCounts: Record<string, number>;
}

export interface ListProjectsOptions {
  category?: string;
  sortBy?: "trending" | "newest" | "rating";
}

const SELECT_COLS =
  "id,name,symbol,category,description,rating,risk_level,apy,tvl,market_cap,website,tags,is_recommended,trending,archived,created_at";

function mapRow(row: Record<string, unknown>): Project {
  return {
    id: row.id as number,
    name: row.name as string,
    symbol: row.symbol as string,
    category: row.category as string,
    description: row.description as string,
    rating: row.rating as number,
    riskLevel: row.risk_level as ProjectRiskLevel,
    apy: row.apy as number,
    tvl: row.tvl as string,
    marketCap: row.market_cap as string,
    website: (row.website as string) ?? null,
    tags: (row.tags as string[]) ?? [],
    isRecommended: row.is_recommended as boolean,
    trending: row.trending as boolean,
    archived: row.archived as boolean,
    createdAt: row.created_at as string,
  };
}

export function useListProjects(opts?: ListProjectsOptions) {
  return useQuery({
    queryKey: ["projects", opts ?? {}],
    queryFn: async (): Promise<Project[]> => {
      let q = supabase.from("projects").select(SELECT_COLS).eq("archived", false);
      if (opts?.category) q = q.eq("category", opts.category);
      const sortBy = opts?.sortBy ?? "trending";
      if (sortBy === "newest")      q = q.order("id", { ascending: false });
      else if (sortBy === "rating") q = q.order("rating", { ascending: false });
      else /* trending */           q = q.order("apy", { ascending: false });
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map(mapRow);
    },
  });
}

export function useGetProject(id: number | string | undefined) {
  return useQuery({
    queryKey: ["project", id],
    queryFn: async (): Promise<Project> => {
      const numericId = typeof id === "string" ? parseInt(id, 10) : id!;
      const { data, error } = await supabase
        .from("projects")
        .select(SELECT_COLS)
        .eq("id", numericId)
        .single();
      if (error) throw error;
      return mapRow(data as Record<string, unknown>);
    },
    enabled: id !== undefined && id !== null,
  });
}

// Parses api-server's tvl string format ("$1.5B", "$500M", "$1.2K", "$42").
function parseTvlString(s: string): number {
  const matchPart = s.replace(/[$,BMK]/g, "");
  const num = parseFloat(matchPart) || 0;
  const mult = s.includes("B") ? 1e9 : s.includes("M") ? 1e6 : s.includes("K") ? 1e3 : 1;
  return num * mult;
}

function formatTvl(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toFixed(0)}`;
}

export function useGetProjectsSummary() {
  return useQuery({
    queryKey: ["projects-summary"],
    queryFn: async (): Promise<ProjectsSummary> => {
      const { data, error } = await supabase
        .from("projects")
        .select(SELECT_COLS)
        .eq("archived", false);
      if (error) throw error;
      const rows = (data ?? []).map(mapRow);
      const totalTvlNum = rows.reduce((acc, p) => acc + parseTvlString(p.tvl), 0);
      const avgApy = rows.length > 0 ? rows.reduce((acc, p) => acc + p.apy, 0) / rows.length : 0;
      const recommendedCount = rows.filter((p) => p.isRecommended).length;
      const categoryCounts: Record<string, number> = {};
      for (const p of rows) categoryCounts[p.category] = (categoryCounts[p.category] ?? 0) + 1;
      return {
        totalProjects: rows.length,
        totalTvl: formatTvl(totalTvlNum),
        avgApy: Math.round(avgApy * 10) / 10,
        recommendedCount,
        categoryCounts,
      };
    },
  });
}

// /rune/overview is now static client data (no DB read). Re-export the
// constant so call sites that did `const { data: overview } = useGetRuneOverview()`
// can switch to: `import { PROTOCOL_OVERVIEW as overview } from '@/lib/rune-overview'`.
export { PROTOCOL_OVERVIEW } from "./rune-overview";
import { PROTOCOL_OVERVIEW as _OVERVIEW } from "./rune-overview";

// Backwards-compatible shim for pages that used `useGetRuneOverview()`. The
// data is static now, so this is a sync stand-in shaped like a useQuery result.
export function useGetRuneOverview() {
  return {
    data: _OVERVIEW,
    isLoading: false,
    isError: false,
    error: null as Error | null,
    refetch: () => Promise.resolve({ data: _OVERVIEW }),
  };
}

// Tool calculator shims. Original Orval hooks were useMutation-shaped:
// returned `{ mutate, mutateAsync, data, isPending, ... }`. We expose
// the same shape backed by sync calculators.
import {
  calculateApy as _apy,
  simulateInvestment as _sim,
  calculateImpermanentLoss as _il,
  type ApyInput,
  type ApyResult,
  type InvestmentInput,
  type InvestmentResult,
  type IlInput,
  type IlResult,
} from "./calculators";
import { useMutation } from "@tanstack/react-query";

export const ApyCalculatorInputCompoundFrequency = {
  Daily: "daily", Weekly: "weekly", Monthly: "monthly", Yearly: "yearly",
} as const;

export function useCalculateApy() {
  return useMutation<ApyResult, Error, ApyInput>({ mutationFn: async (input) => _apy(input) });
}
export function useSimulateInvestment() {
  return useMutation<InvestmentResult, Error, InvestmentInput>({ mutationFn: async (input) => _sim(input) });
}
export function useCalculateImpermanentLoss() {
  return useMutation<IlResult, Error, IlInput>({ mutationFn: async (input) => _il(input) });
}
