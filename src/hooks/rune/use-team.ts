import { useQuery } from "@tanstack/react-query";
import { gql } from "graphql-request";
import { supabase } from "@/lib/supabase";
import { graphqlClient } from "@/lib/queries";
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

// ── Remaining GraphQL queries (rune_rewards table not yet mirrored to Supabase) ─
const PERSONAL_STATS_QUERY = gql`
  query PersonalStats($address: Address!) {
    personalStats(address: $address) {
      address
      chainId
      directCount
      totalDownstreamCount
      directPurchaseCount
      directTotalInvested
      totalDownstreamInvested
      directCommission
      teamCommission
      directByTier { nodeId count }
      teamByTier   { nodeId count }
      hasPurchased
      ownedNodeId
    }
  }
`;

const REWARDS_QUERY = gql`
  query Rewards($address: Address!, $limit: Int, $offset: Int) {
    rewards(address: $address, limit: $limit, offset: $offset) {
      downline
      nodeId
      purchaseAmount
      directRate
      commission
      paidAt
      blockNumber
      txHash
      chainId
    }
  }
`;

const graphqlQueryOpts = {
  retry: false as const,
  staleTime: 60_000,
  refetchOnWindowFocus: false,
};

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
 * Aggregate stats (direct + transitive team). Still on GraphQL because:
 *   1. The transitive downstream walk is a recursive CTE on the server.
 *   2. The `directCommission` / `teamCommission` fields require the
 *      `rune_rewards` table, which is not yet mirrored to Supabase.
 *
 * TODO(api-server final cutover): write a `rune_rewards` table from the
 * indexer (mirror of the GraphQL `rewards` resolver), then add a Postgres
 * RPC function that returns this aggregate, then swap this body to call
 * `supabase.rpc('rune_personal_stats', { addr })`.
 */
export function usePersonalStats(address: string | undefined) {
  const { isDemoMode, demoNodeId } = useDemoStore.getState();
  return useQuery({
    queryKey: ["rune", "personalStats", isDemoMode ? "demo" : address],
    enabled: isDemoMode || !!address,
    ...graphqlQueryOpts,
    queryFn: async () => {
      if (isDemoMode && demoNodeId) return getMockPersonalStats(demoNodeId as NodeId);
      const data = await graphqlClient.request<{ personalStats: PersonalStats }>(
        PERSONAL_STATS_QUERY,
        { address },
      );
      return data.personalStats;
    },
  });
}

/**
 * Per-payout commission rows. Still on GraphQL because `rune_rewards` is
 * not yet a Supabase table — same TODO as `usePersonalStats`.
 */
export function useRewards(address: string | undefined, opts?: { limit?: number; offset?: number }) {
  const { isDemoMode, demoNodeId } = useDemoStore.getState();
  return useQuery({
    queryKey: ["rune", "rewards", isDemoMode ? "demo" : address, opts?.limit, opts?.offset],
    enabled: isDemoMode || !!address,
    ...graphqlQueryOpts,
    queryFn: async () => {
      if (isDemoMode && demoNodeId) return getMockRewards(demoNodeId as NodeId);
      const data = await graphqlClient.request<{ rewards: RewardRow[] }>(REWARDS_QUERY, {
        address,
        limit:  opts?.limit  ?? 100,
        offset: opts?.offset ?? 0,
      });
      return data.rewards;
    },
  });
}
