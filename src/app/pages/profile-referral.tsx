import { useState } from "react";
import { useActiveAccount } from "thirdweb/react";
import { useTranslation } from "react-i18next";
import { TeamPanel, RewardsPanel } from "@app/components/profile/team-detail";
import { Users, Gift } from "lucide-react";
import { DashboardSubTabs, type SubTabItem } from "@app/components/dashboard-sub-tabs";
import { PageEnter, SubTabSwitch } from "@app/components/page-enter";
import { GoldCard } from "@app/components/premium-card";

type Sub = "team" | "rewards";

const TABS: SubTabItem<Sub>[] = [
  { key: "team",    icon: Users, labelKey: "profile.referralOverview", fallback: "Overview" },
  { key: "rewards", icon: Gift,  labelKey: "profile.referralRewards",  fallback: "Rewards" },
];

/**
 * 推广中心 — TeamTab (downline tree) + RewardsTab (commission list/chart)
 * stitched into one page with the shared `DashboardSubTabs` pill row so
 * the in-page tab style matches Vault and Nodes exactly.
 */
export default function ProfileReferral() {
  const account = useActiveAccount();
  const address = account?.address;
  const { t } = useTranslation();
  const [sub, setSub] = useState<Sub>("team");

  if (!address) {
    return (
      <div className="container mx-auto px-4 py-12 text-center text-muted-foreground">
        {t("common.connectWallet", "请先连接钱包")}
      </div>
    );
  }

  return (
    <PageEnter>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-6xl">
        <div className="mb-4">
          <DashboardSubTabs<Sub> tabs={TABS} active={sub} onChange={setSub} testIdPrefix="tab-referral" />
        </div>
        <GoldCard className="p-2.5 sm:p-4 lg:p-5">
          <div className="relative z-[2]">
            <SubTabSwitch tabKey={sub}>
              {sub === "team" ? <TeamPanel address={address} /> : <RewardsPanel address={address} />}
            </SubTabSwitch>
          </div>
        </GoldCard>
      </div>
    </PageEnter>
  );
}
