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
 * Per-payout direct-referral commission. Reads the `rune_rewards` VIEW
 * (see supabase/rune_rewards.sql) which derives each commission row from
 * `rune_purchases ⋈ rune_referrers` × the fixed per-tier directRate — no
 * indexer needed since NodePresell emits no CommissionPaid event.
 *
 * `recipient` is the upline (this address); the view exposes it for the
 * `.eq` filter but it's not part of RewardRow. Degrades gracefully to an
 * empty list if the view hasn't been created yet.
 */
export function useRewards(address: string | undefined, opts?: { limit?: number; offset?: number }) {
  const { isDemoMode, demoNodeId } = useDemoStore.getState();
  return useQuery({
    queryKey: ["rune", "rewards", isDemoMode ? "demo" : address, opts?.limit, opts?.offset],
    enabled: isDemoMode || !!address,
    retry: false,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<RewardRow[]> => {
      if (isDemoMode && demoNodeId) return getMockRewards(demoNodeId as NodeId);
      const limit  = opts?.limit  ?? 200;
      const offset = opts?.offset ?? 0;
      const { data, error } = await supabase
        .from("rune_rewards")
        .select("downline, node_id, purchase_amount, direct_rate, commission, paid_at, block_number, tx_hash, chain_id")
        .eq("recipient", address!.toLowerCase())
        .order("paid_at", { ascending: false })
        .range(offset, offset + limit - 1);
      // View not deployed yet (or transient error) → empty list, no UI error.
      if (error) return [];
      return (data ?? []).map((r) => ({
        downline: r.downline as string,
        nodeId: r.node_id as number,
        purchaseAmount: String(r.purchase_amount),
        directRate: r.direct_rate as number,
        commission: String(r.commission),
        paidAt: r.paid_at as string,
        blockNumber: r.block_number as number,
        txHash: r.tx_hash as string,
        chainId: r.chain_id as number,
      }));
    },
  });
}
