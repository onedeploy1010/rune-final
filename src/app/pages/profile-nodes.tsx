import { useState } from "react";
import { useActiveAccount } from "thirdweb/react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { OverviewTab, RewardsTab } from "@/pages/dashboard";
import { Server, Gift } from "lucide-react";
import { DashboardSubTabs } from "@app/components/dashboard-sub-tabs";
import { PageEnter, SubTabSwitch } from "@app/components/page-enter";

type Sub = "overview" | "rewards";

const TABS = [
  { key: "overview" as const, icon: Server, labelKey: "profile.nodeOverview",      fallback: "Overview" },
  { key: "rewards"  as const, icon: Gift,   labelKey: "profile.nodeRewards.title", fallback: "Rewards" },
];

/**
 * 节点中心 — Overview (RUNE OverviewTab) + Rewards. Wrapper is styled in
 * the same "premium reactor" language as Vault: layered amber ambience,
 * gradient title strip with accent rails, and a content card framed by a
 * slowly-revolving gold ring + halo (`nodes-gold-ring`). RUNE nodes pay
 * no daily yield; the only earning is the on-chain direct-referral
 * commission that RewardsTab already surfaces on the referral page.
 */
export default function ProfileNodes() {
  const account = useActiveAccount();
  const address = account?.address;
  const { t } = useTranslation();
  const [sub, setSub] = useState<Sub>("overview");

  if (!address) {
    return (
      <div className="container mx-auto px-4 py-12 text-center text-muted-foreground">
        {t("common.connectWallet", "请先连接钱包")}
      </div>
    );
  }

  return (
    <PageEnter>
      <div className="relative overflow-hidden pb-24 lg:pb-8">
        {/* Layered amber ambience — same recipe as Vault so the two pages
            feel like the same product. Pure decoration, pointer-events-none. */}
        <div className="pointer-events-none absolute -top-24 left-[8%] h-[30rem] w-[30rem] rounded-full bg-amber-500/[0.10] blur-[120px]" />
        <div className="pointer-events-none absolute top-[28%] right-[6%] h-[26rem] w-[26rem] rounded-full bg-amber-400/[0.07] blur-[100px]" />
        <div className="pointer-events-none absolute top-[60%] left-[18%] h-[22rem] w-[22rem] rounded-full bg-orange-500/[0.05] blur-[110px]" />

        {/* Animated diagonal gold scan-line — sells the "tech / luxury" texture
            without any per-element accents. Lives behind the content. */}
        <motion.div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(115deg, transparent 0%, transparent 38%, rgba(251,191,36,0.05) 50%, transparent 62%, transparent 100%)",
            backgroundSize: "250% 100%",
            mixBlendMode: "screen",
          }}
          animate={{ backgroundPosition: ["180% 0%", "-80% 0%"] }}
          transition={{ duration: 9, repeat: Infinity, ease: "linear" }}
        />

        {/* Page-scoped CSS: defines the rotating gold ring + outer halo and
            the header pulse-line. `@property --nodes-gold-angle` is what
            makes the conic-gradient animate; without it the ring renders
            as a static gold edge (still premium, just not revolving). */}
        <style>{`
          @property --nodes-gold-angle {
            syntax: '<angle>';
            inherits: false;
            initial-value: 0deg;
          }
          @keyframes nodesGoldRotate { to { --nodes-gold-angle: 360deg; } }
          @keyframes nodesPulseLine { 0%, 100% { opacity: 0.45; } 50% { opacity: 1; } }

          .nodes-gold-ring {
            position: relative;
            border-radius: 1rem;
            isolation: isolate;
            background:
              radial-gradient(circle at top left, rgba(255,255,255,0.04), transparent 55%),
              linear-gradient(180deg, rgba(20,14,6,0.92), rgba(10,8,4,0.96));
            box-shadow:
              0 18px 44px -24px rgba(251,191,36,0.28),
              inset 0 1px 0 rgba(255,255,255,0.04);
          }
          @media (min-width: 640px) {
            .nodes-gold-ring {
              border-radius: 1.25rem;
              box-shadow:
                0 24px 60px -28px rgba(251,191,36,0.30),
                inset 0 1px 0 rgba(255,255,255,0.04);
            }
          }
          /* The thin gold border itself — a conic-gradient sliver that
             revolves once every 5.5s. Mask-composite carves the centre out
             so only the 1.5px frame is visible. */
          .nodes-gold-ring::before {
            content: '';
            position: absolute;
            inset: 0;
            border-radius: inherit;
            padding: 1.5px;
            background: conic-gradient(
              from var(--nodes-gold-angle, 0deg),
              rgba(251,191,36,0.00)  0%,
              rgba(251,191,36,0.18) 22%,
              rgba(253,224,71,0.85) 47%,
              rgba(255,255,255,0.95) 50%,
              rgba(253,224,71,0.85) 53%,
              rgba(251,191,36,0.18) 78%,
              rgba(251,191,36,0.00) 100%
            );
            -webkit-mask:
              linear-gradient(#000 0 0) content-box,
              linear-gradient(#000 0 0);
            -webkit-mask-composite: xor;
                    mask-composite: exclude;
            animation: nodesGoldRotate 5.5s linear infinite;
            pointer-events: none;
            z-index: 1;
          }
          /* Outer halo — the same revolving sliver, blurred + offset, so the
             gold light visibly "spills" past the frame as it travels. Halo
             tuned tighter on mobile (less blur, less inset) so it never
             clips the viewport and stays cheap on weaker GPUs. */
          .nodes-gold-ring::after {
            content: '';
            position: absolute;
            inset: -6px;
            border-radius: 1.25rem;
            background: conic-gradient(
              from var(--nodes-gold-angle, 0deg),
              transparent 0deg 80deg,
              rgba(251,191,36,0.30) 110deg,
              rgba(253,224,71,0.62) 125deg,
              rgba(255,255,255,0.55) 130deg,
              rgba(253,224,71,0.62) 135deg,
              rgba(251,191,36,0.30) 150deg,
              transparent 180deg 360deg
            );
            filter: blur(10px);
            opacity: 0.45;
            animation: nodesGoldRotate 5.5s linear infinite;
            pointer-events: none;
            z-index: 0;
          }
          @media (min-width: 640px) {
            .nodes-gold-ring::after {
              inset: -10px;
              border-radius: 1.5rem;
              filter: blur(14px);
              opacity: 0.55;
            }
          }

          @media (prefers-reduced-motion: reduce) {
            .nodes-gold-ring::before,
            .nodes-gold-ring::after { animation: none; }
          }
        `}</style>

        {/* Header — premium reactor strip, matched to Vault's layout. Padding
            ladder mirrors the content area below so the title icon, the
            tab-pill row, and the gold ring share a single vertical axis on
            every breakpoint (critical at 320px). */}
        <div className="relative px-3 sm:px-4 lg:px-6 pt-4 sm:pt-5 pb-3 sm:pb-4 max-w-6xl mx-auto w-full">
          <div className="pointer-events-none absolute inset-x-3 sm:inset-x-4 lg:inset-x-6 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-amber-300/85 to-transparent" />
          <div className="pointer-events-none absolute inset-x-[22%] sm:inset-x-[18%] top-[1.5px] h-px bg-gradient-to-r from-transparent via-amber-200/45 to-transparent" />
          <div
            className="pointer-events-none absolute inset-x-3 sm:inset-x-4 lg:inset-x-6 bottom-0 h-px bg-gradient-to-r from-transparent via-amber-500/35 to-transparent"
            style={{ animation: "nodesPulseLine 3.4s ease-in-out infinite" }}
          />

          <div className="flex items-center gap-2 sm:gap-2.5">
            <div
              className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg sm:rounded-xl flex items-center justify-center ring-2 ring-amber-400/55 shrink-0"
              style={{
                background: "linear-gradient(135deg, rgba(251,191,36,0.32), rgba(180,90,10,0.18))",
                boxShadow: "0 4px 16px hsl(38 95% 55% / 0.45), inset 0 1px 0 rgba(255,255,255,0.20)",
              }}
            >
              <Server className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-200" strokeWidth={2.4} />
            </div>
            <div className="min-w-0 flex-1">
              <h2
                className="text-[16px] sm:text-[18px] font-black leading-tight tracking-[0.02em] truncate"
                style={{
                  background: "linear-gradient(135deg, #fef3c7 0%, #fde68a 40%, #fbbf24 65%, #d97706 100%)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  filter: "drop-shadow(0 1px 0 rgba(0,0,0,0.5))",
                }}
                data-testid="text-nodes-page-title"
              >
                {t("profile.nodesPageTitle", "我的节点")}
              </h2>
              <p className="text-[10px] sm:text-[11px] text-amber-200/65 mt-0.5 tracking-wide truncate">
                {t("profile.nodesPageSubtitle", "节点权益 · 直推奖励 · 实时上链")}
              </p>
            </div>
          </div>
        </div>

        {/* Sub-tabs — DashboardSubTabs is already mobile-tested down to 320px */}
        <div className="relative px-3 sm:px-4 lg:px-6 max-w-6xl mx-auto w-full">
          <DashboardSubTabs tabs={TABS} active={sub} onChange={setSub} testIdPrefix="tab-nodes" />
        </div>

        {/* Content frame — animated gold ring + halo wrap the actual tab
            content. Inner padding is the only thing that fights the halo on
            narrow screens; `p-2.5` on mobile keeps the halo glow visible
            without crowding the cards inside. */}
        <div className="relative px-3 sm:px-4 lg:px-6 pt-3 sm:pt-4 max-w-6xl mx-auto w-full">
          <div className="nodes-gold-ring p-2.5 sm:p-4 lg:p-5">
            <div className="relative z-[2]">
              <SubTabSwitch tabKey={sub}>
                {sub === "overview" ? <OverviewTab address={address} /> : <RewardsTab address={address} />}
              </SubTabSwitch>
            </div>
          </div>
        </div>
      </div>
    </PageEnter>
  );
}
