import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { KeyRound, Search, Filter, Copy, CheckCircle2, ExternalLink } from "lucide-react";
import { AUTH_CODE_POOLS, CODE_GATED_TIERS } from "@/lib/rune/auth-codes";
import { NODE_META, type NodeId } from "@/lib/thirdweb/contracts";

/**
 * 子页 · 授权码管理（admin 视角）
 *
 * - 顶部按节点等级分桶：101 / 201 / 301 / 401 / 501
 * - 行内筛选：全部 / 已分发 / 未分发
 * - 每行字段：验证码 · 节点等级 · 状态 · 已分发钱包/tx
 *
 * 数据层目前来自静态池 `AUTH_CODE_POOLS`，分发状态由组件内的本地状态承
 * 载——后端接口接好后只需替换 `useDistributionState` 即可，无需改动外层
 * 表格结构。101 联创节点不参与发码，桶内提示为空。
 */

type StatusFilter = "ALL" | "DISTRIBUTED" | "UNDISTRIBUTED";

interface DistributionEntry {
  /** 已分发到的钱包地址（短格式即可） */
  wallet?: string;
  /** 链上 tx 哈希 */
  tx?: string;
}

/** 5 个节点等级桶，按 ID 升序：101 → 501。101 没有码池，仅作为占位。 */
const TIER_ORDER: NodeId[] = [101, 201, 301, 401, 501];

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "ALL",            label: "全部" },
  { key: "DISTRIBUTED",    label: "已分发" },
  { key: "UNDISTRIBUTED",  label: "未分发" },
];

/** 占位钩子：分发状态目前只在内存里持有。等后端就绪后把这个换成读
 *  `/api/auth-code-distribution` 之类的接口即可。`useState` 让管理员
 *  能即时在 UI 上预览“标记已分发”的效果。*/
function useDistributionState() {
  const [map, setMap] = useState<Record<string, DistributionEntry>>({});
  function mark(code: string, entry: DistributionEntry | null) {
    setMap((prev) => {
      const next = { ...prev };
      if (!entry) delete next[code];
      else next[code] = entry;
      return next;
    });
  }
  return { map, mark };
}

export function AuthCodeManager() {
  const { map: distribution } = useDistributionState();
  const [tier, setTier] = useState<NodeId>(501);
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [q, setQ] = useState("");

  const pool = useMemo(() => AUTH_CODE_POOLS[tier] ?? [], [tier]);
  const meta = NODE_META[tier];

  const rows = useMemo(() => {
    const lq = q.trim().toLowerCase();
    return pool
      .map((code) => ({ code, entry: distribution[code] }))
      .filter(({ code, entry }) => {
        if (status === "DISTRIBUTED"   && !entry)  return false;
        if (status === "UNDISTRIBUTED" && entry)   return false;
        if (lq && !code.toLowerCase().includes(lq) &&
            !(entry?.wallet ?? "").toLowerCase().includes(lq) &&
            !(entry?.tx ?? "").toLowerCase().includes(lq)) return false;
        return true;
      });
  }, [pool, status, distribution, q]);

  const counts = useMemo(() => {
    const total = pool.length;
    let distributed = 0;
    for (const code of pool) if (distribution[code]) distributed++;
    return { total, distributed, undistributed: total - distributed };
  }, [pool, distribution]);

  return (
    <div className="space-y-4">
      {/* Tier picker — five buckets, 50K is intentionally code-less and
          shows an "无需验证码" hint when selected. */}
      <Card className="border-amber-500/20 bg-card/70 backdrop-blur">
        <CardContent className="p-3 sm:p-4 space-y-3">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground/80">
            <Filter className="h-3 w-3 text-amber-400" />
            节点等级
          </div>
          <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
            {TIER_ORDER.map((id) => {
              const m = NODE_META[id];
              const codeCount = AUTH_CODE_POOLS[id]?.length ?? 0;
              const isActive = tier === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTier(id)}
                  className={`rounded-lg border px-2 py-2 text-center transition-all ${
                    isActive
                      ? "border-amber-500/55 bg-amber-500/15 shadow-[0_0_18px_-6px_rgba(251,191,36,0.55)]"
                      : "border-border/40 bg-card/40 hover:border-amber-500/35"
                  }`}
                  data-testid={`tier-button-${id}`}
                >
                  <div className={`text-[10px] font-mono uppercase tracking-widest ${isActive ? "text-amber-200" : "text-muted-foreground/70"}`}>
                    #{id}
                  </div>
                  <div className={`text-xs sm:text-sm font-semibold mt-0.5 ${m.color}`}>
                    {m.nameCn}
                  </div>
                  <div className="text-[10px] text-muted-foreground/70 mt-0.5 tabular-nums">
                    {codeCount ? `${codeCount} 个` : "—"}
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Status filter + search + counts */}
      <Card className="border-border/40 bg-card/70 backdrop-blur">
        <CardContent className="p-3 sm:p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex gap-1.5">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setStatus(f.key)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                    status === f.key
                      ? "bg-amber-500/15 text-amber-200 border border-amber-500/40"
                      : "bg-white/[0.03] text-foreground/55 border border-white/[0.06] hover:text-foreground/80"
                  }`}
                  data-testid={`status-filter-${f.key}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="text-[11px] text-muted-foreground/85 tabular-nums">
              {meta && (
                <span className={meta.color}>{meta.nameCn}</span>
              )}
              <span className="ml-2">
                共 <span className="text-foreground">{counts.total}</span> · 已分发{" "}
                <span className="text-emerald-300">{counts.distributed}</span> · 未分发{" "}
                <span className="text-amber-300">{counts.undistributed}</span>
              </span>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="搜索验证码 / 钱包 / 交易哈希"
              className="w-full pl-8 pr-3 py-1.5 rounded-md bg-black/30 border border-border/40 text-xs placeholder:text-muted-foreground/50 outline-none focus:border-amber-500/45"
            />
          </div>
        </CardContent>
      </Card>

      {/* Code rows */}
      {pool.length === 0 ? (
        <Card className="border-border/40 bg-card/60">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            <KeyRound className="h-8 w-8 mx-auto mb-3 opacity-30" />
            该等级无需验证码
          </CardContent>
        </Card>
      ) : rows.length === 0 ? (
        <Card className="border-border/40 bg-card/60">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            <Search className="h-6 w-6 mx-auto mb-2 opacity-40" />
            未找到匹配的验证码
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-xl border border-border/40 bg-card/40 overflow-hidden">
          {/* Header — hidden on mobile to save space; rows still align via grid. */}
          <div className="hidden sm:grid grid-cols-[1fr_auto_auto_1.4fr] gap-3 px-3 py-2 border-b border-border/40 text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">
            <span>验证码</span>
            <span>等级</span>
            <span>状态</span>
            <span>钱包 / TX</span>
          </div>
          <ul className="divide-y divide-border/20">
            {rows.map(({ code, entry }) => (
              <CodeRow
                key={code}
                code={code}
                tier={tier}
                entry={entry}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function CodeRow({
  code,
  tier,
  entry,
}: {
  code: string;
  tier: NodeId;
  entry: DistributionEntry | undefined;
}) {
  const [copied, setCopied] = useState(false);
  const meta = NODE_META[tier];
  const isDistributed = !!entry;

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked; user can still select the field manually */
    }
  }

  return (
    <li className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_auto_auto_1.4fr] gap-2 sm:gap-3 px-3 py-2.5 items-center hover:bg-white/[0.025] transition-colors">
      {/* Code + copy */}
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="font-mono text-[12px] sm:text-[13px] text-amber-100 truncate select-all">
          {code}
        </span>
        <button
          type="button"
          onClick={copyCode}
          className={`shrink-0 rounded-sm transition-colors ${
            copied ? "text-emerald-400" : "text-muted-foreground/60 hover:text-amber-300"
          }`}
          aria-label="复制验证码"
        >
          {copied ? <CheckCircle2 className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        </button>
      </div>

      {/* Tier */}
      <span className={`hidden sm:inline text-[11px] font-mono ${meta.color}`}>
        #{tier}
      </span>

      {/* Status */}
      <span className={`text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded border ${
        isDistributed
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
          : "border-amber-500/30 bg-amber-500/[0.06] text-amber-200/80"
      }`}>
        {isDistributed ? "已分发" : "未分发"}
      </span>

      {/* Wallet / TX — wraps to two lines when there's no horizontal room.
          On mobile this row spans the full width below the code; on
          desktop it occupies its own column. */}
      <div className="col-span-2 sm:col-span-1 min-w-0 text-[11px] text-muted-foreground/85 leading-tight break-all">
        {isDistributed ? (
          <>
            <div className="font-mono text-foreground/85 truncate">
              {entry?.wallet ?? "—"}
            </div>
            {entry?.tx && (
              <div className="font-mono opacity-70 mt-0.5 flex items-center gap-1">
                <span className="truncate">{entry.tx}</span>
                <a
                  href={`https://bscscan.com/tx/${entry.tx}`}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 hover:text-amber-300"
                  aria-label="查看交易"
                >
                  <ExternalLink className="h-2.5 w-2.5" />
                </a>
              </div>
            )}
          </>
        ) : (
          <span className="opacity-50">—</span>
        )}
      </div>
    </li>
  );
}

/** Re-export the tier list so callers (e.g. analytics) can iterate the
 *  same bucket order without re-declaring it. */
export { TIER_ORDER, CODE_GATED_TIERS };
