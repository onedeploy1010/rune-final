import { useQuery } from "@tanstack/react-query";
import { supabase, w } from "@app/lib/supabase-client";

/**
 * 用户端 · 拉取已绑定到当前钱包的 Smart-Prediction 授权码。
 *
 * 数据源：`rune_auth_codes` （Supabase）。`assigned_to` 列存的是小写
 * EVM 地址。一个钱包最多绑一条码，所以用 maybeSingle()——没绑过返回
 * `null`，绑过返回 `{ code, nodeId }`。
 *
 *   - 没有连接钱包 → enabled=false，不查
 *   - 钱包连了但没买节点 → 查到 null，按钮不显示
 *   - 钱包买了 101 (FOUNDER) → 联创不发码，DB 里没有它的行 → null
 *   - 钱包买了 501/401/301/201 但还没分发到 → null（管理员还没分）
 *   - 钱包绑了码 → 返回 code + nodeId 给 OverviewTab 显示
 *
 * RLS：目前 supabase-client 用 anon key + 显式 WHERE。当 thirdweb→JWT
 * 桥接到位后，把 `assigned_to` 表上 SELECT 收紧成 `auth.jwt() ->> 'wallet'
 * = assigned_to`，自然就只能查到自己那条。
 */
export interface PredictionCodeRow {
  code: string;
  nodeId: number;
}

export function usePredictionCode(walletAddress: string | undefined) {
  return useQuery<PredictionCodeRow | null>({
    queryKey: ["rune", "predictionCode", walletAddress ? w(walletAddress) : null],
    enabled: !!walletAddress,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rune_auth_codes")
        .select("code, node_id")
        .eq("assigned_to", w(walletAddress!))
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return { code: data.code, nodeId: data.node_id };
    },
  });
}
