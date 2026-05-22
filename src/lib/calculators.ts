// Pure-function port of api-server's /api/tools/* and /api/rune/* calculator
// endpoints. Inputs/outputs match the Zod schemas in @rune/api-zod so existing
// page code can be migrated by swapping `useCalculateApy` etc. for these
// direct calls (wrap in useMemo on the page if needed).

import {
  NODES,
  PRICE_STAGES,
  PROTOCOL_OVERVIEW,
  STATIC_SHARE,
  DYNAMIC_SHARE,
  YIELD_MIDPOINT_DAILY_PCT,
  YIELD_RANGE_LOW_PCT,
  YIELD_RANGE_HIGH_PCT,
  type PriceStage,
} from "./rune-overview";

const round2 = (n: number) => Math.round(n * 100) / 100;
const round4 = (n: number) => Math.round(n * 10000) / 10000;
const fmt = (n: number, decimals = 2) =>
  n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

// ─── /tools/apy-calculator ────────────────────────────────────────────────────
export interface ApyInput {
  principal: number;
  apy: number;
  compoundFrequency: "daily" | "weekly" | "monthly" | "yearly";
  durationDays: number;
}
export interface ApyResult {
  principal: number;
  finalAmount: number;
  totalReturn: number;
  returnPercent: number;
  dailyBreakdown: { day: number; amount: number }[];
}

export function calculateApy(input: ApyInput): ApyResult {
  const { principal, apy, compoundFrequency, durationDays } = input;
  const freqMap = { daily: 365, weekly: 52, monthly: 12, yearly: 1 } as const;
  const n = freqMap[compoundFrequency] ?? 365;
  const r = apy / 100;
  const t = durationDays / 365;
  const finalAmount = principal * Math.pow(1 + r / n, n * t);
  const totalReturn = finalAmount - principal;
  const returnPercent = (totalReturn / principal) * 100;

  const dailyBreakdown: { day: number; amount: number }[] = [];
  const step = Math.max(1, Math.floor(durationDays / 30));
  for (let day = 0; day <= durationDays; day += step) {
    const amount = principal * Math.pow(1 + r / n, n * (day / 365));
    dailyBreakdown.push({ day, amount: round2(amount) });
  }
  if (dailyBreakdown[dailyBreakdown.length - 1]?.day !== durationDays) {
    dailyBreakdown.push({ day: durationDays, amount: round2(finalAmount) });
  }
  return { principal, finalAmount: round2(finalAmount), totalReturn: round2(totalReturn), returnPercent: round2(returnPercent), dailyBreakdown };
}

// ─── /tools/investment-simulator ──────────────────────────────────────────────
export interface InvestmentInput {
  initialInvestment: number;
  monthlyContribution: number;
  expectedApy: number;
  years: number;
  tokenPriceChange?: number;
}
export interface InvestmentResult {
  finalValue: number;
  totalContributed: number;
  totalReturn: number;
  returnPercent: number;
  yearlyBreakdown: { year: number; value: number; contributed: number; yield: number }[];
}

export function simulateInvestment(input: InvestmentInput): InvestmentResult {
  const { initialInvestment, monthlyContribution, expectedApy, years, tokenPriceChange } = input;
  const monthlyRate = expectedApy / 100 / 12;
  const priceMultiplier = tokenPriceChange ? 1 + tokenPriceChange / 100 : 1;
  let balance = initialInvestment;
  let totalContributed = initialInvestment;
  const yearlyBreakdown: InvestmentResult["yearlyBreakdown"] = [];
  for (let year = 1; year <= years; year++) {
    const yearStart = balance;
    for (let month = 0; month < 12; month++) {
      balance = balance * (1 + monthlyRate) + monthlyContribution;
      totalContributed += monthlyContribution;
    }
    const annualPriceGain = (balance - yearStart) * (priceMultiplier - 1);
    balance += annualPriceGain;
    yearlyBreakdown.push({
      year, value: round2(balance), contributed: round2(totalContributed), yield: round2(balance - totalContributed),
    });
  }
  const totalReturn = balance - totalContributed;
  const returnPercent = totalContributed > 0 ? (totalReturn / totalContributed) * 100 : 0;
  return { finalValue: round2(balance), totalContributed: round2(totalContributed), totalReturn: round2(totalReturn), returnPercent: round2(returnPercent), yearlyBreakdown };
}

// ─── /tools/impermanent-loss ──────────────────────────────────────────────────
export interface IlInput { initialPrice: number; currentPrice: number; liquidityValue: number; }
export interface IlResult { ilPercent: number; ilUsd: number; hodlValue: number; lpValue: number; priceChangePercent: number; }

export function calculateImpermanentLoss(input: IlInput): IlResult {
  const { initialPrice, currentPrice, liquidityValue } = input;
  const priceRatio = currentPrice / initialPrice;
  const ilFactor = (2 * Math.sqrt(priceRatio)) / (1 + priceRatio) - 1;
  const hodlValue = liquidityValue * (1 + (priceRatio - 1) / 2);
  const lpValue = liquidityValue * (1 + ilFactor);
  const ilUsd = hodlValue - lpValue;
  const ilPercent = ilFactor * 100;
  const priceChangePercent = (priceRatio - 1) * 100;
  return {
    ilPercent: Math.round(ilPercent * 10000) / 10000,
    ilUsd: round2(ilUsd),
    hodlValue: round2(hodlValue),
    lpValue: round2(lpValue),
    priceChangePercent: round2(priceChangePercent),
  };
}

// ─── /rune/calculator ─────────────────────────────────────────────────────────
export interface RuneCalcInput { nodeLevel: string; seats: number; durationDays: number; priceStageIndex: number; }
export interface BreakdownRow { label: string; labelCn: string; value: string; }
export interface RuneCalcResult {
  investment: number; privatePrice: number; motherTokens: number; airdropTokens: number;
  dailyUsdt: number; durationDays: number; totalUsdtIncome: number; selectedStage: PriceStage;
  motherTokenValue: number; airdropTokenValue: number; totalAssets: number; roi: number; roiMultiplier: number;
  estimateMode: "midpoint"; subTokenAccumulated: number; subTokenValue: number;
  totalAssetsLow: number; totalAssetsHigh: number; roiLow: number; roiHigh: number;
  breakdown: BreakdownRow[];
}

export function calculateRuneReturns(input: RuneCalcInput): RuneCalcResult | null {
  const { nodeLevel, seats, durationDays, priceStageIndex } = input;
  const node = NODES.find((n) => n.level === nodeLevel);
  if (!node) return null;
  const stageIdx = Math.max(0, Math.min(5, priceStageIndex));
  const selectedStage = PRICE_STAGES[stageIdx];
  const investment = node.investment * seats;
  const motherTokens = node.motherTokensPerSeat * seats;
  const airdropTokens = node.airdropPerSeat * seats;
  const dailyStaticU  = node.estimatedDailyStaticU  * seats;
  const dailyDynamicU = node.estimatedDailyDynamicU * seats;
  const totalUsdtIncome = dailyStaticU * durationDays;
  const dynamicUSpentTotal = dailyDynamicU * durationDays;
  const subTokenAccumulated = selectedStage.subPrice > 0 ? dynamicUSpentTotal / selectedStage.subPrice : 0;
  const subTokenValue = subTokenAccumulated * selectedStage.subPrice;
  const motherTokenValue = motherTokens * selectedStage.motherPrice;
  const airdropTokenValue = airdropTokens * selectedStage.motherPrice;
  const totalAssets = motherTokenValue + airdropTokenValue + totalUsdtIncome + subTokenValue;
  const roi = ((totalAssets - investment) / investment) * 100;
  const roiMultiplier = totalAssets / investment;

  const scaleFor = (monthlyPct: number) => monthlyPct / (YIELD_MIDPOINT_DAILY_PCT * 30);
  const bandTotal = (monthlyPct: number) => {
    const scale = scaleFor(monthlyPct);
    const staticU = totalUsdtIncome * scale;
    const dynamicU = dynamicUSpentTotal * scale;
    const subVal = selectedStage.subPrice > 0 ? dynamicU : 0;
    return motherTokenValue + airdropTokenValue + staticU + subVal;
  };
  const totalAssetsLow  = bandTotal(YIELD_RANGE_LOW_PCT);
  const totalAssetsHigh = bandTotal(YIELD_RANGE_HIGH_PCT);
  const roiLow  = ((totalAssetsLow - investment) / investment) * 100;
  const roiHigh = ((totalAssetsHigh - investment) / investment) * 100;

  const breakdown: BreakdownRow[] = [
    { label: "Node Tier", labelCn: "节点等级", value: `${node.nameEn} (${node.nameCn})` },
    { label: "Seats", labelCn: "席位数量", value: `${seats} 席` },
    { label: "Total Investment", labelCn: "总投资额", value: `$${fmt(investment)} USDT` },
    { label: "Private Price", labelCn: "母TOKEN私募价", value: `$${node.privatePrice}/枚` },
    { label: "Mother Tokens", labelCn: "获得母TOKEN", value: `${motherTokens.toLocaleString()} 枚` },
    { label: "Mother-Token Airdrop", labelCn: "母TOKEN空投", value: `${airdropTokens.toLocaleString()} 枚` },
    { label: "Daily Static USDT (est.)", labelCn: "每日静态USDT (预估)", value: `$${fmt(dailyStaticU)}/天` },
    { label: "Daily Dynamic Sub-Token (est.)", labelCn: "每日动态子币 (预估)", value: `$${fmt(dailyDynamicU)}/天` },
    { label: "Duration", labelCn: "持仓周期", value: `${durationDays} 天` },
    { label: "Total Static USDT", labelCn: "静态USDT总收益", value: `$${fmt(totalUsdtIncome)}` },
    { label: "Sub-Tokens Accumulated", labelCn: "累计获得子币", value: `${fmt(subTokenAccumulated)} 枚` },
    { label: "Sub-Token Value", labelCn: "子币持仓市值", value: `$${fmt(subTokenValue)}` },
    { label: "Price Stage", labelCn: "价格阶段", value: `${selectedStage.labelCn} (母TOKEN $${selectedStage.motherPrice})` },
    { label: "Mother Token Value", labelCn: "母TOKEN持仓市值", value: `$${fmt(motherTokenValue)}` },
    { label: "Airdrop Value", labelCn: "母TOKEN空投价值", value: `$${fmt(airdropTokenValue)}` },
    { label: "Total Returns (est. midpoint)", labelCn: "总收益 (预估中位)", value: `$${fmt(totalAssets)}` },
    { label: "Range (Low @ 15%/mo)", labelCn: "保守区间 (月化15%)", value: `$${fmt(totalAssetsLow)}` },
    { label: "Range (High @ 35%/mo)", labelCn: "乐观区间 (月化35%)", value: `$${fmt(totalAssetsHigh)}` },
    { label: "Principal Redeemable", labelCn: "本金可赎回", value: `$${fmt(investment)} USDT (≈128d 静态回本后)` },
    { label: "ROI (midpoint)", labelCn: "投资回报率 (中位)", value: `${fmt(roi)}%` },
    { label: "ROI Multiplier", labelCn: "收益倍数", value: `${fmt(roiMultiplier)}×` },
  ];

  return {
    investment, privatePrice: node.privatePrice, motherTokens, airdropTokens,
    dailyUsdt: dailyStaticU, durationDays,
    totalUsdtIncome: round2(totalUsdtIncome),
    selectedStage,
    motherTokenValue: round2(motherTokenValue),
    airdropTokenValue: round2(airdropTokenValue),
    totalAssets: round2(totalAssets),
    roi: round2(roi),
    roiMultiplier: round4(roiMultiplier),
    estimateMode: "midpoint",
    subTokenAccumulated: round2(subTokenAccumulated),
    subTokenValue: round2(subTokenValue),
    totalAssetsLow: round2(totalAssetsLow),
    totalAssetsHigh: round2(totalAssetsHigh),
    roiLow: round2(roiLow),
    roiHigh: round2(roiHigh),
    breakdown,
  };
}

// ─── /rune/burn-stake-calculator ──────────────────────────────────────────────
export interface BurnStakeInput { motherTokensBurned: number; durationDays: number; priceStageIndex: number; }
export interface BurnStakeResult {
  motherTokensBurned: number; dailyRatePct: number; dailyYieldTokens: number; durationDays: number;
  totalYieldTokens: number; selectedStage: PriceStage; totalYieldValue: number; burnedValueAtLaunch: number;
  roi: number; roiMultiplier: number; estimateMode: "midpoint"; breakdown: BreakdownRow[];
}

function burnStakeRate(motherTokensBurned: number): number {
  if (motherTokensBurned >= 100_000) return 1.5;
  if (motherTokensBurned >=  10_000) return 1.4;
  if (motherTokensBurned >=   1_000) return 1.3;
  if (motherTokensBurned >=     100) return 1.2;
  return 1.0;
}

export function calculateRuneBurnStake(input: BurnStakeInput): BurnStakeResult {
  const { motherTokensBurned, durationDays, priceStageIndex } = input;
  const stageIdx = Math.max(0, Math.min(5, priceStageIndex));
  const selectedStage = PRICE_STAGES[stageIdx];
  const dailyRatePct = burnStakeRate(motherTokensBurned);
  const dailyYieldTokens = motherTokensBurned * (dailyRatePct / 100);
  const totalYieldTokens = dailyYieldTokens * durationDays;
  const totalYieldValue = totalYieldTokens * selectedStage.motherPrice;
  const burnedValueAtLaunch = motherTokensBurned * PROTOCOL_OVERVIEW.motherToken.launchPrice;
  const roi = burnedValueAtLaunch > 0 ? ((totalYieldValue - burnedValueAtLaunch) / burnedValueAtLaunch) * 100 : 0;
  const roiMultiplier = burnedValueAtLaunch > 0 ? totalYieldValue / burnedValueAtLaunch : 0;

  const breakdown: BreakdownRow[] = [
    { label: "Burned (mother tokens)", labelCn: "销毁母TOKEN数量", value: `${motherTokensBurned.toLocaleString()} 枚` },
    { label: "Burned at launch ($0.028)", labelCn: "本金 (按开盘价)", value: `$${fmt(burnedValueAtLaunch)}` },
    { label: "Daily Rate (est.)", labelCn: "日化收益率 (预估)", value: `${dailyRatePct}%` },
    { label: "Daily Yield", labelCn: "日产出母TOKEN", value: `${fmt(dailyYieldTokens, 4)} 枚` },
    { label: "Duration", labelCn: "持仓周期", value: `${durationDays} 天 (永久)` },
    { label: "Total Yield Tokens", labelCn: "周期产出母TOKEN", value: `${fmt(totalYieldTokens)} 枚` },
    { label: "Price Stage", labelCn: "价格阶段", value: `${selectedStage.labelCn} (母TOKEN $${selectedStage.motherPrice})` },
    { label: "Total Yield Value", labelCn: "产出市值", value: `$${fmt(totalYieldValue)}` },
    { label: "ROI vs launch cost", labelCn: "投资回报率", value: `${fmt(roi)}%` },
    { label: "ROI Multiplier", labelCn: "资产倍数", value: `${fmt(roiMultiplier)}×` },
  ];

  return {
    motherTokensBurned, dailyRatePct,
    dailyYieldTokens: round4(dailyYieldTokens),
    durationDays,
    totalYieldTokens: round2(totalYieldTokens),
    selectedStage,
    totalYieldValue: round2(totalYieldValue),
    burnedValueAtLaunch: round2(burnedValueAtLaunch),
    roi: round2(roi),
    roiMultiplier: round4(roiMultiplier),
    estimateMode: "midpoint",
    breakdown,
  };
}
