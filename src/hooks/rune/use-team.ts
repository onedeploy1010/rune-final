import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useDemoStore } from "@/lib/demo-store";
import { getMockPersonalStats, getMockTeam, getMockRewards } from "@/lib/demo-mock-data";
import type { NodeId } from "@/lib/thirdweb/contracts";

// ── Row shapes ──────────────────────────────────────────────────────────────
export interface ReferrerRow {
  user: string;
  referrer: string;
  boundAt: string;
  blockNumber: number;
  txHash: string;
}

export interface PurchaseRow {
  user: string;
  nodeId: number;
  amount: string;
  paidAt: string;
  txHash: string;
}

export interface RewardRow {
  downline: string;
  nodeId: number;
  purchaseAmount: string;
  directRate: number;
  commission: string;
  paidAt: string;
  blockNumber: number;
  txHash: string;
  chainId: number;
}

export interface PersonalStats {
  address: string;
  chainId: number;
  directCount: number;
  totalDownstreamCount: number;
  directPurchaseCount: number;
  directTotalInvested: string;
  totalDownstreamInvested: string;
  directCommission: string;
  teamCommission: string;
  directByTier: { nodeId: number; count: number }[];
  teamByTier: { nodeId: number; count: number }[];
  hasPurchased: boolean;
  ownedNodeId: number | null;
}

// ── Hooks ───────────────────────────────────────────────────────────────────

/**
 * Direct downstream of an address (one hop). Migrated to Supabase — reads
 * `rune_referrers` rows where `referrer = $address`. The Supabase view sits
 * downstream of the same on-chain indexer the GraphQL API used, so data
 * parity is preserved.
 */
export function useTeam(address: string | undefined, opts?: { limit?: number; offset?: number }) {
  const { isDemoMode, demoNodeId } = useDemoStore.getState();
  return useQuery({
    queryKey: ["rune", "team", isDemoMode ? "demo" : address, opts?.limit, opts?.offset],
    enabled: isDemoMode || !!address,
    retry: false,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<ReferrerRow[]> => {
      if (isDemoMode && demoNodeId) return getMockTeam(demoNodeId as NodeId);
      const lower = address!.toLowerCase();
      const limit  = opts?.limit  ?? 100;
      const offset = opts?.offset ?? 0;
      const { data, error } = await supabase
        .from("rune_referrers")
        .select("user, referrer, bound_at, block_number, tx_hash")
        .eq("referrer", lower)
        .order("bound_at", { ascending: false })
        .range(offset, offset + limit - 1);
      if (error) throw error;
      return (data ?? []).map((r) => ({
        user: r.user as string,
        referrer: r.referrer as string,
        boundAt: r.bound_at as string,
        blockNumber: r.block_number as number,
        txHash: r.tx_hash as string,
      }));
    },
  });
}

/**
 * User's on-chain purchase history. Migrated to Supabase — reads
 * `rune_purchases` (one row per wallet under the current spec where each
 * wallet can buy once).
 */
export function useUserPurchases(address: string | undefined) {
  return useQuery({
    queryKey: ["rune", "purchases", address],
    enabled: !!address,
    retry: false,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<PurchaseRow[]> => {
      const lower = address!.toLowerCase();
      const { data, error } = await supabase
        .from("rune_purchases")
        .select("user, node_id, amount, paid_at, tx_hash")
        .eq("user", lower)
        .order("paid_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []).map((r) => ({
        user: r.user as string,
        nodeId: r.node_id as number,
        amount: String(r.amount),
        paidAt: r.paid_at as string,
        txHash: r.tx_hash as string,
      }));
    },
  });
}

/**
 * Aggregate stats (direct + transitive team). Migrated to Supabase RPC
 * `rune_personal_stats(addr)` (see supabase/rune_personal_stats.sql).
 *
 * The api-server's GraphQL `personalStats` indexer lagged behind Supabase
 * by hours, so recent purchases didn't show in the team performance number.
 * The Supabase RPC walks `rune_referrers` recursively and joins
 * `rune_purchases` directly, returning fresh data.
 *
 * Caveat: `directCommission` / `teamCommission` are returned as "0" until
 * `rune_rewards` is mirrored into Supabase (see TODO on `useRewards`).
 */
export function usePersonalStats(address: string | undefined) {
  const { isDemoMode, demoNodeId } = useDemoStore.getState();
  return useQuery({
    queryKey: ["rune", "personalStats", isDemoMode ? "demo" : address],
    enabled: isDemoMode || !!address,
    retry: false,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<PersonalStats> => {
      if (isDemoMode && demoNodeId) return getMockPersonalStats(demoNodeId as NodeId);
      const { data, error } = await supabase.rpc("rune_personal_stats", {
        addr: address!.toLowerCase(),
      });
      if (error) throw error;
      return data as PersonalStats;
    },
  });
}

/**
 * Per-payout commission rows. Stubbed empty until `rune_rewards` table is
 * mirrored from the on-chain CommissionPaid indexer into Supabase. The
 * rewards UI degrades gracefully (empty list, no error).
 *
 * TODO(backend): create `rune_rewards` table + indexer that writes to it,
 * then replace this body with `supabase.from('rune_rewards').select(...)`.
 */
export function useRewards(address: string | undefined, _opts?: { limit?: number; offset?: number }) {
  const { isDemoMode, demoNodeId } = useDemoStore.getState();
  return useQuery({
    queryKey: ["rune", "rewards", isDemoMode ? "demo" : address],
    enabled: isDemoMode || !!address,
    retry: false,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<RewardRow[]> => {
      if (isDemoMode && demoNodeId) return getMockRewards(demoNodeId as NodeId);
      return [];
    },
  });
}
