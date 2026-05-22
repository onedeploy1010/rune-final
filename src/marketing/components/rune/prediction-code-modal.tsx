import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Sparkles, Copy, CheckCircle2 } from "lucide-react";
import { NODE_META, type NodeId } from "@/lib/thirdweb/contracts";
import { useLanguage } from "@/contexts/language-context";

/** Compact modal that surfaces a member's Smart-Prediction authorization
 *  code. The code itself is fetched upstream (see `usePredictionCode` →
 *  Supabase `rune_auth_codes`), so this view is purely presentational —
 *  header, tier strip, big code box with copy button, and a one-line
 *  explainer.
 */
export function PredictionCodeModal({
  open,
  onOpenChange,
  code,
  nodeId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  code: string;
  nodeId: NodeId | number;
}) {
  const [copied, setCopied] = useState(false);
  const { t } = useLanguage();
  const meta = NODE_META[nodeId as NodeId];

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked — the select-all field is the fallback */
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[380px] p-0 overflow-hidden gap-0 border-amber-500/40 bg-gradient-to-br from-amber-950/40 via-card to-card">
        <div className="relative px-5 pt-5 pb-4 border-b border-amber-500/15">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,0.18),transparent_60%)] pointer-events-none" />
          <div className="relative flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
              <Sparkles className="h-4 w-4 text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-sm font-bold text-amber-100">
                {t("mr.dash.predCode.modal.title")}
              </DialogTitle>
              <DialogDescription className="text-[11px] text-muted-foreground/85 mt-0.5">
                {t("mr.dash.predCode.modal.desc")}
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 space-y-3">
          {meta && (
            <div className="flex items-center justify-between text-[11px]">
              <span className="uppercase tracking-[0.2em] text-muted-foreground/70">
                {t("mr.dash.predCode.modal.tier")}
              </span>
              <span className={`font-semibold ${meta.color}`}>
                {meta.nameCn} · {meta.nameEn} · ${meta.priceUsdt.toLocaleString("en-US")}
              </span>
            </div>
          )}

          <div className="rounded-lg border border-amber-500/40 bg-black/40 px-3 py-3 flex items-center gap-2">
            <input
              readOnly
              value={code}
              onFocus={(e) => e.currentTarget.select()}
              className="flex-1 min-w-0 bg-transparent outline-none font-mono text-base sm:text-lg tracking-wider text-amber-200 tabular-nums select-all"
            />
            <button
              type="button"
              onClick={handleCopy}
              className={`shrink-0 inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-[11px] font-semibold transition-all ${
                copied
                  ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
                  : "border-amber-500/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20"
              }`}
              aria-label={t("mr.dash.predCode.modal.copyAria")}
            >
              {copied ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {t("mr.dash.predCode.modal.copied")}
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  {t("mr.dash.predCode.modal.copy")}
                </>
              )}
            </button>
          </div>

          <p className="text-[11px] leading-snug text-muted-foreground/80">
            {t("mr.dash.predCode.modal.note")}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
