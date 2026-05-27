-- ============================================================================
-- rune_rewards — 节点直推奖励（commission）
-- ============================================================================
--
-- 背景 / 为什么是 VIEW 而不是表 + 索引器：
--   NodePresell 合约只 emit 一个业务事件 `EventNodePresell(user, payToken,
--   amount, time, num, nodeId)` —— 它喂给 `rune_purchases`。链上**没有**
--   CommissionPaid / DirectCommission 这类独立事件，所以没有“奖励事件”可索引。
--
--   节点直推佣金是**确定性派生**的：每笔购买，买家的直接上级
--   （rune_referrers.referrer）按该档位的固定 directRate 拿
--       commission = floor(amount * directRate / 10000)
--   directRate（基点，PREVISION=10000）按 tier 固定：
--       101 → 1500 (15%)  201 → 1200 (12%)  301 → 1000 (10%)
--       401 →  800 (8%)   501 →  500 (5%)
--   所以无需任何索引器 —— 直接 JOIN rune_purchases ⋈ rune_referrers 即可。
--
-- ⚠️ 业务规则（2026-05）：直推奖励制度**只对下面这个根账户的伞下生效**，
--    其他账户的伞下已取消奖励。即：仅当【收佣的上级】落在该根账户的子树内
--    （含根账户本身）时才计佣，其余购买不产生奖励行。
--    要调整生效范围，改这一个常量即可。
--      REWARD_ROOT = 0xE940FF96AF9d8A0BD52aAEFDF1b4Bf29F38ceD17
--
-- 前端用法（src/hooks/rune/use-team.ts 的 useRewards）：
--   supabase.from('rune_rewards').select('*')
--           .eq('recipient', addr.toLowerCase())
--           .order('paid_at', { ascending: false })
--   返回列与 RewardRow 一一对应（recipient 仅用于过滤，RewardRow 不含它）。
--
-- 幂等 —— 可安全重复执行。
-- ============================================================================

create or replace view public.rune_rewards as
with recursive
  -- 奖励生效根账户的伞下集合：根账户本身 + 全部递归下级。
  reward_umbrella as (
    select lower('0xE940FF96AF9d8A0BD52aAEFDF1b4Bf29F38ceD17') as addr
    union
    select rr."user"
    from rune_referrers rr
    join reward_umbrella u on rr.referrer = u.addr
  )
select
  rr.referrer                                   as recipient,        -- 拿佣金的上级（过滤用，必须在伞下）
  rp."user"                                      as downline,         -- 触发佣金的买家
  rp.node_id                                     as node_id,
  rp.amount::text                                as purchase_amount,  -- 原始 token 单位（同 rune_purchases.amount 精度）
  (case rp.node_id
     when 101 then 1500 when 201 then 1200 when 301 then 1000
     when 401 then  800 when 501 then  500 else 0 end)               as direct_rate,
  -- floor 取整：commission 必须是整数字符串，前端用 BigInt(commission) 解析。
  floor(rp.amount::numeric
        * (case rp.node_id
             when 101 then 1500 when 201 then 1200 when 301 then 1000
             when 401 then  800 when 501 then  500 else 0 end)
        / 10000)::numeric(78,0)::text            as commission,
  rp.paid_at                                     as paid_at,
  rp.block_number                                as block_number,
  rp.tx_hash                                     as tx_hash,
  rp.chain_id                                    as chain_id
from rune_purchases rp
join rune_referrers rr on rr."user" = rp."user"   -- 买家的绑定关系（bind-once，一对一）
where rr.referrer is not null
  and rr.referrer <> '0x0000000000000000000000000000000000000000'
  -- 仅奖励制度生效范围内：收佣上级必须在 REWARD_ROOT 伞下（含根本身）。
  and rr.referrer in (select addr from reward_umbrella);

grant select on public.rune_rewards to anon, authenticated;


-- ============================================================================
-- rune_personal_stats —— 把硬编码的 '0' 佣金接上 rune_rewards 的口径，
-- 并同样只在 REWARD_ROOT 伞下范围内计佣（伞外恒为 0）。
-- （只改 directCommission / teamCommission，其余逻辑不变）
-- ============================================================================
create or replace function public.rune_personal_stats(addr text)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_addr text := lower(addr);
  result  json;
begin
  with recursive
    reward_umbrella as (
      select lower('0xE940FF96AF9d8A0BD52aAEFDF1b4Bf29F38ceD17') as a
      union
      select rr."user" from rune_referrers rr
      join reward_umbrella u on rr.referrer = u.a
    ),
    direct as (
      select "user" as u from rune_referrers where referrer = v_addr
    ),
    descendants as (
      select "user" as u from rune_referrers where referrer = v_addr
      union
      select rr."user"
      from rune_referrers rr
      join descendants d on rr.referrer = d.u
    ),
    direct_purchases as (
      select rp."user", rp.node_id, rp.amount::numeric as amt
      from rune_purchases rp
      where rp."user" in (select u from direct)
    ),
    -- 团队购买带上各自的收佣上级，便于按伞下范围过滤。
    transitive_purchases as (
      select rp."user", rp.node_id, rp.amount::numeric as amt, rr.referrer as recipient
      from rune_purchases rp
      join rune_referrers rr on rr."user" = rp."user"
      where rp."user" in (select u from descendants)
    ),
    self_purchase as (
      select node_id from rune_purchases where "user" = v_addr limit 1
    )
  select json_build_object(
    'address', v_addr,
    'chainId', 56,
    'directCount',          (select count(*)        from direct),
    'totalDownstreamCount', (select count(*)        from descendants),
    'directPurchaseCount',  (select count(distinct "user") from direct_purchases),
    'directTotalInvested',  (select coalesce(sum(amt), 0)::text from direct_purchases),
    'totalDownstreamInvested', (select coalesce(sum(amt), 0)::text from transitive_purchases),
    -- directCommission = 本钱包从直接下级购买实得的佣金。仅当本钱包在 REWARD_ROOT
    -- 伞下时才有奖励，伞外恒为 0。
    'directCommission', (
      case when v_addr in (select a from reward_umbrella)
        then (select coalesce(sum(floor(amt * (case node_id
               when 101 then 1500 when 201 then 1200 when 301 then 1000
               when 401 then 800 when 501 then 500 else 0 end) / 10000)), 0)
              from direct_purchases)
        else 0 end
    )::text,
    -- teamCommission = 本钱包伞下购买所产生的直推佣金总额（团队业绩口径），
    -- 仅统计收佣上级落在 REWARD_ROOT 伞下的部分。
    'teamCommission', (
      select coalesce(sum(floor(amt * (case node_id
        when 101 then 1500 when 201 then 1200 when 301 then 1000
        when 401 then 800 when 501 then 500 else 0 end) / 10000)), 0)::text
      from transitive_purchases
      where recipient in (select a from reward_umbrella)
    ),
    'directByTier', (
      select coalesce(json_agg(json_build_object('nodeId', node_id, 'count', cnt) order by node_id), '[]'::json)
      from (select node_id, count(distinct "user") as cnt from direct_purchases group by node_id) x
    ),
    'teamByTier', (
      select coalesce(json_agg(json_build_object('nodeId', node_id, 'count', cnt) order by node_id), '[]'::json)
      from (select node_id, count(distinct "user") as cnt from transitive_purchases group by node_id) x
    ),
    'hasPurchased', exists(select 1 from self_purchase),
    'ownedNodeId',  (select node_id from self_purchase)
  ) into result;
  return result;
end;
$$;

grant execute on function public.rune_personal_stats(text) to anon, authenticated;
