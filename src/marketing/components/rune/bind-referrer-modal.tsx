import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useSendTransaction,
  useActiveAccount,
  useActiveWallet,
  useDisconnect,
} from "thirdweb/react";
import { prepareContractCall, readContract } from "thirdweb";
import { communityContract, COMMUNITY_ROOT } from "@/lib/thirdweb/contracts";
import { UserPlus, Loader2, AlertCircle, CheckCircle2, ShieldCheck, LogOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/language-context";

interface Props {
  open: boolean;
  /** Pre-filled referrer address from the URL `?ref=`, if any. */
  initialReferrer?: string | null;
  /** Called after the addReferrer tx confirms — caller typically re-reads
   *  referrerOf and moves the user to the next step. */
  onBound: () => void;
}

const ZERO = "0x0000000000000000000000000000000000000000";

/** Strip whitespace so the hex pattern check sees a clean string. The
 *  ROOT alias is intentionally not surfaced — users paste a 0x address
 *  or nothing. */
function resolveAlias(raw: string): string {
  return raw.trim();
}

type PreCheck =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "ok"; label: string }     // ROOT or an address already in the community
  | { state: "reject"; reason: string };

/**
 * First-touch onboarding modal. Collects a referrer address (pre-fills
 * from `?ref=`) and submits `Community.addReferrer(referrer)`.
 *
 * Contract-side invariants we mirror in UI:
 *   - referrer ≠ self
 *   - user isn't already bound (caller only opens when unbound)
 *   - referrer is already bound OR is ROOT (0x…0001)
 *
 * We perform a low-cost on-chain pre-check for the third rule so the
 * user sees a clear error before paying gas. ROOT short-circuits.
 */
export function BindReferrerModal({ open, initialReferrer, onBound }: Props) {
  const { t } = useLanguage();
  const account = useActiveAccount();
  const activeWallet = useActiveWallet();
  const { disconnect } = useDisconnect();
  const [input, setInput] = useState<string>(initialReferrer ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [preCheck, setPreCheck] = useState<PreCheck>({ state: "idle" });
  const { mutateAsync: sendTx } = useSendTransaction();
  const { toast } = useToast();

  function handleDisconnect() {
    if (activeWallet) disconnect(activeWallet);
    // After disconnect, the parent RuneOnboarding effect sees `address`
    // flip to undefined and closes this modal via `open=false`.
  }

  const resolved = resolveAlias(input).toLowerCase();
  const isHex = /^0x[0-9a-fA-F]{40}$/.test(resolved);
  const isRoot = isHex && resolved === COMMUNITY_ROOT.toLowerCase();
  const isSelf = account && resolved === account.address.toLowerCase();

  // Debounced on-chain pre-check — only verifies the proposed referrer is
  // already in the community (`referrerOf(ref) != 0`). The "upline must
  // own a node" check was removed 2026-04-29 per user direction; if the
  // contract still enforces it the failure surfaces at tx time.
  useEffect(() => {
    if (!isHex || isSelf) { setPreCheck({ state: "idle" }); return; }
    if (isRoot)           { setPreCheck({ state: "ok", label: t("mr.bind.okValidated") }); return; }

    setPreCheck({ state: "checking" });
    const handle = setTimeout(async () => {
      try {
        const upstreamOfRef = (await readContract({
          contract: communityContract,
          method: "function referrerOf(address) view returns (address)",
          params: [resolved as `0x${string}`],
        })) as string;

        if (upstreamOfRef.toLowerCase() === ZERO) {
          setPreCheck({ state: "reject", reason: t("mr.bind.rejectNotMember") });
          return;
        }

        setPreCheck({ state: "ok", label: t("mr.bind.okValidated") });
      } catch (e: any) {
        setPreCheck({ state: "reject", reason: e?.message ?? t("mr.bind.rejectRpc") });
      }
    }, 400);

    return () => clearTimeout(handle);
  }, [resolved, isHex, isSelf, isRoot]);

  async function submit() {
    if (!account || !isHex || isSelf) return;
    if (preCheck.state === "reject") return;
    setSubmitting(true);
    try {
      const tx = prepareContractCall({
        contract: communityContract,
        method: "function addReferrer(address)",
        params: [resolved as `0x${string}`],
      });
      await sendTx(tx);
      toast({ title: t("mr.bind.toastBound"), description: t("mr.bind.toastBoundDesc") });
      onBound();
    } catch (e: any) {
      toast({
        title: t("mr.bind.toastFail"),
        description: e?.message ?? t("mr.bind.toastFailDesc"),
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit =
    isHex && !isSelf && !submitting &&
    (preCheck.state === "ok" || preCheck.state === "idle");

  // Hard gate. The bind step is mandatory: users have two paths out and
  // nothing else. Either (a) submit a valid referrer and bind on-chain,
  // or (b) explicitly disconnect the wallet via the button below. We
  // swallow Esc / outside-click / the auto X so a connected-but-unbound
  // wallet cannot quietly browse the app without a referrer. The prior
  // dismiss-only behaviour (2026-04-27) is removed per user direction.
  return (
    <Dialog open={open} onOpenChange={() => { /* hard-gated — only onBound or handleDisconnect close this */ }}>
      <DialogContent
        hideClose
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        className="bg-[#080f1e] border border-amber-700/30 max-w-md"
      >
        <DialogHeader>
          <div className="inline-flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
              <UserPlus className="h-4 w-4 text-amber-400" />
            </div>
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-400">{t("mr.bind.step")}</span>
          </div>
          <DialogTitle className="text-xl font-bold">{t("mr.bind.title")}</DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            {t("mr.bind.desc")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Read-only "推荐人钱包" banner. Shown when the user landed via a
              `?ref=0x…` link so they see who they're binding to before
              signing. Pure on-chain — no api-server lookup. */}
          {initialReferrer && /^0x[0-9a-fA-F]{40}$/.test(initialReferrer) && (
            <div
              className="rounded-lg border border-amber-500/30 bg-amber-500/[0.06] px-3 py-2.5"
              data-testid="bind-referrer-display"
            >
              <div className="flex items-center gap-1.5 mb-1">
                <ShieldCheck className="h-3 w-3 text-amber-300" />
                <span className="text-[10.5px] font-semibold uppercase tracking-wider text-amber-300">
                  {t("mr.bind.referrerLabel")}
                </span>
              </div>
              <p
                className="font-mono text-[12px] text-amber-100 break-all leading-snug"
                data-testid="bind-referrer-address"
              >
                {initialReferrer}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="ref-addr" className="text-xs text-muted-foreground">
              {t("mr.bind.addrLabel")}
            </Label>
            <Input
              id="ref-addr"
              placeholder={t("mr.bind.addrPh")}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={submitting}
              className="font-mono text-sm bg-background/60"
            />

            {/* Address feedback — one line at a time, priority: self > bad-format > pre-check */}
            {input && isSelf ? (
              <p className="text-[11px] text-destructive flex items-center gap-1.5">
                <AlertCircle className="h-3 w-3" /> {t("mr.bind.errSelf")}
              </p>
            ) : input && !isHex ? (
              <p className="text-[11px] text-destructive flex items-center gap-1.5">
                <AlertCircle className="h-3 w-3" /> {t("mr.bind.errInvalid")}
              </p>
            ) : preCheck.state === "checking" ? (
              <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" /> {t("mr.bind.checking")}
              </p>
            ) : preCheck.state === "ok" ? (
              <p className="text-[11px] text-emerald-300 flex items-center gap-1.5">
                <ShieldCheck className="h-3 w-3" /> {preCheck.label}
              </p>
            ) : preCheck.state === "reject" ? (
              <p className="text-[11px] text-destructive flex items-start gap-1.5">
                <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" /> <span>{preCheck.reason}</span>
              </p>
            ) : initialReferrer && isHex ? (
              <p className="text-[11px] text-amber-300 flex items-center gap-1.5">
                <CheckCircle2 className="h-3 w-3" /> {t("mr.bind.prefilled")}
              </p>
            ) : null}
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              className="w-full font-semibold"
              disabled={!canSubmit}
              onClick={submit}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : t("mr.bind.sign")}
            </Button>
          </div>

          <p className="text-[11px] text-muted-foreground/60 text-center">
            {t("mr.bind.gasNote")}
          </p>

          {/* Only escape hatch: explicitly disconnect the wallet. Replaces
              the old Esc/outside-click dismiss path so the gate is hard. */}
          <div className="pt-2 border-t border-white/5">
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-1.5 text-[11.5px] font-medium text-muted-foreground hover:text-foreground/90 transition-colors disabled:opacity-50 disabled:pointer-events-none"
              data-testid="button-bind-disconnect"
            >
              <LogOut className="h-3.5 w-3.5" />
              {t("mr.bind.disconnect")}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
