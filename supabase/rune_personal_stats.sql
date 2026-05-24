-- Postgres RPC that replicates the api-server's GraphQL `personalStats`
-- aggregation directly off rune_referrers + rune_purchases.
--
-- Why: api-server's indexer lagged behind Supabase, so Rune-final reading
-- the aggregate via GraphQL showed stale `totalDownstreamInvested` (e.g.
-- two recent purchases of $2500 + $1000 didn't appear). Supabase has the
-- data — we just need to walk the tree there.
--
-- After running this script in Supabase Studio, the frontend hook in
-- src/hooks/rune/use-team.ts can switch from graphqlClient.request(...)
-- to supabase.rpc('rune_personal_stats', { addr }).
--
-- Idempotent — safe to re-run.

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
    -- Direct downstream (1 hop).
    direct as (
      select "user" as u from rune_referrers where referrer = v_addr
    ),
    -- Full transitive subtree (BFS via recursive CTE).
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
    transitive_purchases as (
      select rp."user", rp.node_id, rp.amount::numeric as amt
      from rune_purchases rp
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
    -- Commission fields require rune_rewards (not yet mirrored). Zero
    -- placeholders keep the response shape so the frontend types stay valid;
    -- replace with sub-queries once rune_rewards is in Supabase.
    'directCommission', '0',
    'teamCommission',   '0',
    'directByTier', (
      select coalesce(json_agg(json_build_object('nodeId', node_id, 'count', cnt) order by node_id), '[]'::json)
      from (
        select node_id, count(distinct "user") as cnt from direct_purchases group by node_id
      ) x
    ),
    'teamByTier', (
      select coalesce(json_agg(json_build_object('nodeId', node_id, 'count', cnt) order by node_id), '[]'::json)
      from (
        select node_id, count(distinct "user") as cnt from transitive_purchases group by node_id
      ) x
    ),
    'hasPurchased', exists(select 1 from self_purchase),
    'ownedNodeId',  (select node_id from self_purchase)
  ) into result;
  return result;
end;
$$;

-- Allow anon (and authenticated) clients to call this function.
grant execute on function public.rune_personal_stats(text) to anon, authenticated;
