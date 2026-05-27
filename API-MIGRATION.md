# Server-API → Supabase 迁移清单

> 现状：仓库无 `server/`、无 `vercel.json` rewrite、`supabase/functions/` 为空。
> 所有 `/api/*` 调用背后**没有后端**，目前是死的。
> 共 ~70 个内部端点 / 95 处调用待处理。
> 迁移两条路径：**纯 DB → `supabase.from()` + RLS**；**含密钥/资金/逻辑 → Edge Function (`invokeFn`)**。

---

## P0 — 阻塞项（先做，否则后面都白搭）

- [ ] **建 `api-proxy` Edge Function** — CORS 出站代理。被 `api.ts` 的 `proxyFetch()` 用于 CoinGecko/Polymarket。当前缺失 → 行情/情绪/F&G 全挂。
- [ ] **建 `ai-forecast-multi` Edge Function** — 持有 OpenAI / AI Gateway / OpenRouter key，跑 5 模型 fan-out。`getAiForecastMulti/Single` 已指向它但函数不存在。
- [ ] **thirdweb → Supabase JWT 桥** — RLS 现在靠 anon key + WHERE 里显式 `wallet_address` 过滤（见 `supabase-client.ts` 注释）。资金类端点迁移前必须先有真正的 `jwt.wallet` claim，否则任何人可改任何钱包数据。

## P1 — 只读，高频，低风险 → 直连 `supabase.from()`

> 改 `src/app/lib/api.ts` 对应函数即可，调用方签名不变。表名见 `app-shared/schema.ts`。

| 端点 | 表 | api.ts 函数 |
|---|---|---|
| `/api/profile/:w` `/api/profile-by-refcode/:code` | `profiles` | `getProfile` `getProfileByRefCode` |
| `/api/transactions/:w` | `transactions` | `getTransactions` |
| `/api/vault-positions/:w` `/api/vault-overview` | `vault_positions` | `getVaultPositions` `getVaultOverview` |
| `/api/vault-rewards/:w` | `vault_rewards` | `getVaultRewards` |
| `/api/trade-stats/:w` | `trade_bets` | `getTradeStats` |
| `/api/strategies` `/api/strategy-overview` | `strategies` | `getStrategies` `getStrategyOverview` |
| `/api/subscriptions/:w` | `strategy_subscriptions` | `getSubscriptions` |
| `/api/hedge-positions/:w` `/api/hedge-purchases/:w` | `hedge_positions` `insurance_purchases` | `getHedgePositions` `getHedgePurchases` |
| `/api/insurance-pool` | `insurance_purchases` / `revenue_pools` | `getInsurancePool` |
| `/api/prediction-bets/:w` | `prediction_bets` | `getPredictionBets` |
| `/api/node-membership(s)/:w` `/api/node-overview/:w` | `node_memberships` | `getNodeMembership(s)` `getNodeOverview` |
| `/api/node-earnings/:w` | `node_rewards` | `getNodeEarningsRecords` |
| `/api/node-milestone-requirements/:w` | `node_milestones` | `getNodeMilestoneRequirements` |
| `/api/earnings-releases/:w` | `earnings_releases` | `getEarningsReleases` |
| `/api/commissions/:w` | `revenue_events` / `fund_distributions`（需确认表）| `getCommissionRecords` |
| `/api/referral-tree/:w` `/api/team-stats/:w` `/api/rank-status/:w` | `profiles`（自引用树）| `getReferralTree` `getUserTeamStats` `getRankStatus` |
| `/api/ai-predictions` | `ai_prediction_records` `ai_model_accuracy` | `getAiPredictions` |
| `/api/news-predictions` | `ai_prediction_records`（news 类）| `getNewsPredictions` |

**散点 `fetch("/api/...")`（绕过 api.ts，需逐个改）— 只读部分：**
- [ ] `strategy/live-trading-panel.tsx`、`ai-coin-picker.tsx`、`pages/strategy.tsx` → `/api/trade-signals` `/api/open-positions` `/api/paper-trades` → 表 `trade_signals` `paper_trades`
- [ ] `strategy/copy-trading-dashboard.tsx` → `/api/copy-trade-orders/:w` `/api/user-trade-config/:w` → `copy_trade_orders` `user_trade_configs`
- [ ] `strategy/vip-gate.tsx` → `/api/profile?wallet=` → `profiles`
- [ ] `strategy/risk-control.tsx`、`copy-trading-flow.tsx` → `/api/user-risk-config/:w` `/api/user-trade-config/:w`
- [ ] `vault/rune-lock-section.tsx` → `/api/rune-lock/stats` → `rune_lock_positions`
- [ ] `vault/ember-burn-section.tsx` → `/api/ember-burn/stats` → `ember_burn_positions`

## P2 — 简单写入（纯记录，无资金）→ 直连 `supabase.from().insert/update()`

> 前提：P0 的 JWT/RLS 到位，否则用 service-role 的 Edge Function 包一层更安全。

- [ ] `strategy/api-key-bind.tsx` → `/api/bind-exchange-key` (GET/POST/DELETE) → `user_exchange_keys` ⚠️ 含交易所密钥，**强烈建议走 Edge Function** 加密存储，不要客户端直写
- [ ] `strategy/risk-control.tsx` → POST `/api/user-risk-config` → `user_risk_config`
- [ ] `strategy/copy-trading-flow.tsx` → POST `/api/user-trade-config`(+`/deactivate`) → `user_trade_configs`
- [ ] `vault/rune-lock-section.tsx` → POST `/api/rune-lock` → `rune_lock_positions`
- [ ] `vault/ember-burn-section.tsx` → POST `/api/ember-burn`(+`/claim`) → `ember_burn_positions`
- [ ] `vault/vault-deposit-dialog.tsx` → POST `/api/vault-record` → `vault_deposits`

## P3 — 资金/链上/敏感逻辑 → Edge Function（务必服务端，禁止客户端直写）

> 这些会改余额、消费授权码、验 txHash、发放收益。必须用 service-role key 在 Edge Function 里做，配合校验。

- [ ] `/api/auth-wallet` — 建 profile + 推荐位分配 + 生成 refCode（有逻辑）`authWallet`
- [ ] `/api/vault-deposit` `/api/vault-withdraw` `vaultDeposit` `vaultWithdraw`
- [ ] `/api/claim-yield`（`vault/ma-release-dialog.tsx`）+ `/api/vault-yield`
- [ ] `/api/place-trade-bet` `/api/place-prediction-bet` `placeTradeBet` `placePredictionBet`
- [ ] `/api/subscribe-strategy` `subscribeStrategy`
- [ ] `/api/subscribe-vip`（`hooks/use-payment.ts`、`activateVipTrial`）`subscribeVip`
- [ ] `/api/purchase-node` + `/api/validate-auth-code/:code`（消费 `node_auth_codes`）`purchaseNode` `validateAuthCode`
- [ ] `/api/purchase-hedge` `purchaseHedge`
- [ ] `/api/request-earnings-release` `requestEarningsRelease`
- [ ] `/api/check-node-milestones` `/api/check-rank-promotion`（晋级判定）`checkNodeMilestones` `checkRankPromotion`
- [ ] `/api/ma-price` —— **MA 代币已废弃**，归 Cleanup

## P4 — 管理 / 定时 → Edge Function（最好挂 cron）

- [ ] `/api/admin/daily-settlement` `runDailySettlement` → Supabase scheduled function
- [ ] `/api/admin/ai-stats` `/api/admin/ai-predictions`（`strategy/ai-lab.tsx`、`model-strategy-selector.tsx`）→ 需 admin 鉴权

## AI 预测（部分已半迁移）

- [ ] `/api/ai-prediction` `/api/ai-forecast` `getAiPrediction` `getAiForecast` → 合并进 `ai-forecast-multi` Edge Function（已存在调用入口，函数待建，见 P0）
- [ ] `/api/ai-fear-greed` `getAiFearGreed`/`fetchAiFearGreed` → Edge Function 或挪到客户端 F&G 计算

## 外部行情（已在客户端，**非迁移项**，仅依赖 P0 的 api-proxy）

`api.ts` 内 `fetchExchangeDepth` `fetchSentiment` `fetchExchangePrices` `fetchFearGreedHistory`
`fetchMarketCalendar` `fetchFuturesOI` `fetchPolymarkets` — 直打 Binance.us/Kraken/Coinbase，
CoinGecko/Polymarket 走 `proxyFetch`→`api-proxy`。**无需迁移，建完 api-proxy 即恢复。**

## Cleanup — 直接删

- [ ] MA 代币：`/api/ma-price` `/api/ma-swap` `/api/ma-swap-history`，`maSwapRecords` 表，
      `pages/profile-ma.tsx`、`pages/profile-swap.tsx`、相关 nav 入口（用户确认已废弃）
- [ ] `/api/proxy`（旧路由，已由 `api-proxy` Edge Function 取代）
- [ ] `api.ts` 里的 `apiFetch`/`apiPost` 裸 helper — 全部端点迁完后删除

---

### 建议执行顺序
P0（建 2 个 Edge Function + JWT 桥）→ P1（读，解锁主界面）→ P2（简单写）→ P3（资金，逐个带校验）→ P4（管理/cron）→ Cleanup。
