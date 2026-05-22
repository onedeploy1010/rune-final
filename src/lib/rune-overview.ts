// Ported verbatim from artifacts/api-server/src/routes/rune.ts (PROTOCOL_OVERVIEW).
// This was a static hardcoded object on the server — no DB read involved.
// Source-of-truth for tokenomics constants used by /rune, /recruit, and the
// rune calculator. Update here when the spec changes.

export const YIELD_MIDPOINT_DAILY_PCT = 0.834;     // 25%/30
export const STATIC_SHARE             = 0.65;     // 65% USDT
export const DYNAMIC_SHARE            = 0.35;     // 35% sub-token
export const YIELD_RANGE_LOW_PCT      = 15;       // monthly low
export const YIELD_RANGE_HIGH_PCT     = 35;       // monthly high

export const LAUNCH_MOTHER_PRICE = 0.028;
export const LAUNCH_SUB_PRICE    = 0.038;

export interface PriceStage {
  index: number;
  label: string;
  labelCn: string;
  trigger: string;
  motherPrice: number;
  subPrice: number;
  multiplier: number;
}

export const PRICE_STAGES: PriceStage[] = [
  { index: 0, label: "Stage 1 · Launch",         labelCn: "① 开盘",         trigger: "DO上线当日 / TLP≥500万U开放子币",      motherPrice: 0.028, subPrice: 0.038, multiplier: 1 },
  { index: 1, label: "Stage 2 · TVL 10M",        labelCn: "② TVL 1000万",   trigger: "TVL≥1000万U / TLP≥700万U",            motherPrice: 0.07,  subPrice: 2,     multiplier: 2.5 },
  { index: 2, label: "Stage 3 · TVL 30M",        labelCn: "③ TVL 3000万",   trigger: "TVL≥3000万U / TLP≥1750万U",           motherPrice: 0.175, subPrice: 18,    multiplier: 6.25 },
  { index: 3, label: "Stage 4 · TVL 50M",        labelCn: "④ TVL 5000万",   trigger: "TVL≥5000万U / TLP≥3500万U",           motherPrice: 0.35,  subPrice: 50,    multiplier: 12.5 },
  { index: 4, label: "Stage 5 · TVL 100M",       labelCn: "⑤ TVL 1亿 (目标低)",  trigger: "TVL≥1亿U · 24mo 预测",            motherPrice: 2.24,  subPrice: 200,   multiplier: 80 },
  { index: 5, label: "Stage 6 · TVL 150M PEAK",  labelCn: "⑥ TVL 1.5亿 (目标高)", trigger: "TVL≥1.5亿U PEAK · 24mo 预测",     motherPrice: 3.36,  subPrice: 450,   multiplier: 120 },
];

export interface NodeTier {
  level: "initial" | "mid" | "advanced" | "super" | "founder";
  nameEn: string;
  nameCn: string;
  investment: number;
  seats: number;
  seatsRemaining: number;
  privatePrice: number;
  dailyUsdt: number;
  weight: number;
  airdropTotal: number;
  airdropPerSeat: number;
  motherTokensPerSeat: number;
  monthlyYieldRangePctLow: number;
  monthlyYieldRangePctHigh: number;
  estimatedDailyStaticU: number;
  estimatedDailyDynamicU: number;
  estimatedDailyTotalU: number;
}

const estimateDailyAt = (investment: number, monthlyPct: number) =>
  (investment * (monthlyPct / 100)) / 30;

const rawNodes: NodeTier[] = [
  { level: "initial",  nameEn: "INITIAL",  nameCn: "符胚", investment:  1000, seats: 1000, seatsRemaining: 1000, privatePrice: 0.028, dailyUsdt:   4.7, weight: 1.0, airdropTotal: 1_000_000, airdropPerSeat:  1000, motherTokensPerSeat: 0, monthlyYieldRangePctLow: YIELD_RANGE_LOW_PCT, monthlyYieldRangePctHigh: YIELD_RANGE_HIGH_PCT, estimatedDailyStaticU: 0, estimatedDailyDynamicU: 0, estimatedDailyTotalU: 0 },
  { level: "mid",      nameEn: "MID",      nameCn: "符源", investment:  2500, seats:  800, seatsRemaining:  800, privatePrice: 0.026, dailyUsdt:  11.7, weight: 1.2, airdropTotal: 2_400_000, airdropPerSeat:  3000, motherTokensPerSeat: 0, monthlyYieldRangePctLow: YIELD_RANGE_LOW_PCT, monthlyYieldRangePctHigh: YIELD_RANGE_HIGH_PCT, estimatedDailyStaticU: 0, estimatedDailyDynamicU: 0, estimatedDailyTotalU: 0 },
  { level: "advanced", nameEn: "ADVANCED", nameCn: "符印", investment:  5000, seats:  400, seatsRemaining:  400, privatePrice: 0.024, dailyUsdt:  23.4, weight: 1.4, airdropTotal: 2_500_000, airdropPerSeat:  6250, motherTokensPerSeat: 0, monthlyYieldRangePctLow: YIELD_RANGE_LOW_PCT, monthlyYieldRangePctHigh: YIELD_RANGE_HIGH_PCT, estimatedDailyStaticU: 0, estimatedDailyDynamicU: 0, estimatedDailyTotalU: 0 },
  { level: "super",    nameEn: "SUPER",    nameCn: "符魂", investment: 10000, seats:  200, seatsRemaining:  200, privatePrice: 0.020, dailyUsdt:  46.8, weight: 1.6, airdropTotal: 2_600_000, airdropPerSeat: 13000, motherTokensPerSeat: 0, monthlyYieldRangePctLow: YIELD_RANGE_LOW_PCT, monthlyYieldRangePctHigh: YIELD_RANGE_HIGH_PCT, estimatedDailyStaticU: 0, estimatedDailyDynamicU: 0, estimatedDailyTotalU: 0 },
  { level: "founder",  nameEn: "FOUNDER",  nameCn: "符主", investment: 50000, seats:   20, seatsRemaining:   20, privatePrice: 0.016, dailyUsdt: 234.0, weight: 2.0, airdropTotal: 1_500_000, airdropPerSeat: 75000, motherTokensPerSeat: 0, monthlyYieldRangePctLow: YIELD_RANGE_LOW_PCT, monthlyYieldRangePctHigh: YIELD_RANGE_HIGH_PCT, estimatedDailyStaticU: 0, estimatedDailyDynamicU: 0, estimatedDailyTotalU: 0 },
];

// Patch each node with midpoint-yield estimates (same logic as api-server).
for (const node of rawNodes) {
  const dailyTotal = estimateDailyAt(node.investment, YIELD_MIDPOINT_DAILY_PCT * 30);
  node.estimatedDailyTotalU   = Math.round(dailyTotal * 100) / 100;
  node.estimatedDailyStaticU  = Math.round(dailyTotal * STATIC_SHARE  * 100) / 100;
  node.estimatedDailyDynamicU = Math.round(dailyTotal * DYNAMIC_SHARE * 100) / 100;
  node.dailyUsdt              = node.estimatedDailyStaticU;
}

export const NODES: ReadonlyArray<NodeTier> = rawNodes;

export interface RuneOverview {
  protocolName: string;
  motherToken: { symbol: string; launchPrice: number; totalSupply: number; dailyBurnRate: number; targetPriceLow: number; targetPriceHigh: number };
  subToken:    { symbol: string; launchPrice: number; totalSupply: number; dailyBurnRate: number; targetPriceLow: number; targetPriceHigh: number };
  fundraising: { total: number; tlpPool: number; subTokenLP: number; operations: number; treasury: number };
  priceStages: PriceStage[];
  nodes:       NodeTier[];
}

export const PROTOCOL_OVERVIEW: RuneOverview = {
  protocolName: "RUNE Protocol",
  motherToken: { symbol: "符",   launchPrice: 0.028, totalSupply: 210_000_000, dailyBurnRate: 0.002, targetPriceLow: 2.24, targetPriceHigh: 3.36 },
  subToken:    { symbol: "符火", launchPrice: 0.038, totalSupply:  13_100_000, dailyBurnRate: 0.001, targetPriceLow: 3.04, targetPriceHigh: 4.56 },
  fundraising: { total: 8_000_000, tlpPool: 2_800_000, subTokenLP: 500_000, operations: 2_100_000, treasury: 2_600_000 },
  priceStages: PRICE_STAGES,
  nodes:       NODES as NodeTier[],
};
