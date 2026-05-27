import * as React from "react";
import { cn } from "@app/lib/utils";

/**
 * Shared "premium reactor" card surfaces. Thin wrappers over the reusable
 * CSS classes defined once in `src/app/index.css`:
 *
 *  - <PremiumCard>  → `.premium-card`  (crisp border + 3D bevel + layered
 *                      amber drop-shadow; the default raised surface)
 *  - <GoldCard>     → `.gold-ring`     (animated rotating golden light border
 *                      + outer halo; for hero / flagship surfaces)
 *
 * Both are visual-only and forward all div props so they drop in anywhere a
 * plain styled <div> was used. Keeping them here (app layer) avoids touching
 * the shared shadcn `Card` primitive used by the purchase flow.
 */

export const PremiumCard = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("premium-card rounded-xl", className)} {...props} />
));
PremiumCard.displayName = "PremiumCard";

export const GoldCard = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("gold-ring", className)} {...props} />
));
GoldCard.displayName = "GoldCard";
