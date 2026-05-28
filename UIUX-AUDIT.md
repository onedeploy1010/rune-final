# RUNE — UI/UX & Frontend Design Audit

**Scope:** Vite + React 19 + Tailwind v4 + shadcn/ui crypto product (wouter routing, two surfaces split in `src/app-router.tsx`). Read-only design/UX review applying a frontend-design-quality lens (anti-"AI-slop", mobile-first, a11y, performance).
**Date:** 2026-05-28 · **Reviewer surface map:** Marketing (`src/pages/*`, `src/components/*`, layout `src/components/layout.tsx`) + App (`/app/*`, shell `src/app/dashboard-shell.tsx`, pages `src/app/pages/*`).

> Note on tooling context: an automated plugin repeatedly suggested Next.js / cache-components skills. This project is **not** Next.js — it is a Vite SPA. Those suggestions were ignored as false positives. The `src/app/*` folder is the SPA's "app" surface, not a Next.js App Router.

---

## 1. Executive Summary — Top 5 Highest-Impact Problems

1. **[Critical] Monolithic 4.2 MB main JS chunk (5.1 MB legacy).** `dist/public/assets/index-DMWuV3Kf.js` = 4.2 MB. Root causes are structural, not incidental: (a) **every marketing page is statically imported** in `src/app-router.tsx` (lines 7–18) — no `lazy()` — so `rune.tsx` (163 KB src), `tools.tsx` (102 KB), `dashboard.tsx` (135 KB) plus `recharts` all land in the entry chunk; (b) `ThirdwebProvider` + wallet SDK is imported eagerly in `src/main.tsx:4`; (c) all 12 locale JSONs (~900 KB raw) are statically imported in `src/app/lib/i18n.ts`; (d) **no `manualChunks`/`rollupOptions`** in `vite.config.ts`. First paint of the marketing home ships the entire app + chart + wallet stack. Highest ROI fix in the repo.

2. **[Critical] Two unsynchronised i18n systems with mismatched language sets.** Marketing uses a custom context (`src/contexts/language-context.tsx`, default `zh`, storage key `b18-language`, langs: zh/zh-TW/en/ko/ja/**th**/vi). The App uses `react-i18next` (`src/app/lib/i18n.ts`, default `en`, storage key `taiclaw-lang`, langs: en/zh/zh-TW/ja/ko/**es/fr/de/ru/ar/pt**/vi). The sets disagree (marketing has Thai but no es/fr/de/ru/ar/pt; app has those but no Thai), and the app→marketing bridge (`src/app/components/lang-switcher.tsx:23`) **maps fr/de/ar/pt → "en"**. Result: a user who picks French in the dashboard sees English the moment they hit a marketing page, and Thai is unreachable inside the app. Defaults also conflict (zh vs en).

3. **[High] No RTL support despite shipping Arabic.** `ar.json` is loaded and `ar` is offered in the app switcher, but nothing sets `dir="rtl"` (grep of `src/` finds no `documentElement.dir`/`dir=` direction logic; `language-context.tsx:40` only sets `lang`, never `dir`). Arabic renders LTR with mirrored-wrong layout — worse than not offering it.

4. **[High] Keyboard / focus accessibility is largely absent in the app surface.** Only 3 files under `src/app/**` reference `aria-label`/`focus-visible`/`role`. Most interactive elements are bespoke `<button>`/`<div onClick>` with custom backgrounds and **no visible focus ring**; the bottom-nav item CSS explicitly sets `outline: none` (`src/app/index.css` `.floating-nav-item`). Tab-through is invisible. Combined with 236 instances of ≤10 px text in app pages/components, the app fails basic WCAG focus + text-size guidance.

5. **[High] Design language is genuinely strong but inconsistently applied across the marketing↔app seam.** The amber "premium reactor" system (`.premium-card`, `.gold-ring`, `.gold-ring-surface`, `.num-gold`, Orbitron/Space-Grotesk display) is distinctive and avoids AI-slop — but it lives almost entirely in the **app** theme (`src/app/index.css`). The **marketing** theme (`src/index.css`) is a *different palette* (blue-grey `--background: 228 26% 13%` + Cinzel/Inter) with its own `.surface-3d`/`.token-card-3d`. The two surfaces read as two products; tokens like `--card-border`, `--primary` resolve to different hues across the boundary the user crosses constantly (logo click in the dashboard does a full reload to `/`).

---

## 2. Per-Surface Findings

### 2A. Marketing Site (官网)

- **[High] Marketing pages are not code-split.** `src/app-router.tsx:7-18` imports `Home`, `Projects`, `Rune` (163 KB), `Tools` (102 KB), `Dashboard` (135 KB), `Recruit` (63 KB), `Tutorial` (78 KB), etc. all eagerly. Every visitor downloads all of them. **Fix:** wrap each in `lazy()` + `<Suspense>` exactly as the app shell already does for its pages (`dashboard-shell.tsx:11-25`).

- **[Medium] Hero typography hierarchy is muddled and locale-branchy.** `src/pages/home.tsx:206-295` hand-forks the H1 into three near-duplicate JSX blocks (en/zh/other) with inconsistent emphasis — English leads with a muted `text-foreground/80` "Institutional-Grade" then gold "DeFi Analysis", the non-en branch inverts which line is gold and adds an uppercase tracking-widest tagline. The result is three different visual hierarchies for the same hero. **Fix:** one template, drive label/sub via i18n keys; pick a single gold-accent line.

- **[Medium] Marketing color system diverges from the brand.** `src/index.css:100` sets `--background: 228 26% 13%` (blue-grey) and a dotted amber grid at 0.12 alpha (`:174`), while the brand wordmark/logo and the entire app are warm amber on `28 16% 10%`. The hero uses `chart-2`/`chart-3` (teal/blue) orbs (`home.tsx:181-182`) that don't appear anywhere in the amber app. **Fix:** unify `--background`/`--card` hues toward the app's warm-neutral, or at minimum drop the teal accents.

- **[Low] Footer brand mark uses a third font (`Cinzel`) inline-styled** (`layout.tsx:508`) while the header wordmark is an image mask and the app uses Orbitron — three brand treatments. Consolidate.

- **[Low] External "PREDICTIONS/LIBRARY" nav item** opens `https://www.rune-protocol.com` in a new tab (`layout.tsx:33`) with no visual "external" affordance in the desktop nav (only an icon in the drawer). Add an external-link glyph for predictability.

### 2B. The App (`/app/*`)

- **[High] Onboarding "hard gate" is correct in intent but fragile in UX.** `BindReferrerModal` (`src/components/rune/bind-referrer-modal.tsx:142-149`) disables Esc/outside-click/X — the *only* exits are "sign" or "断开钱包" (disconnect). This is intentional, but: (1) the disconnect link is an 11.5 px muted ghost button at the very bottom (`:245-254`) — easy to miss, so users feel trapped; (2) the modal has no "what is a referrer / where do I get one" help for organic visitors who arrived without a `?ref=`. **Fix:** promote the disconnect to a clearly-labelled secondary button, add a one-line "no referrer? use the official root" helper.

- **[High] Post-bind auto-redirect + disconnect-eject can feel like navigation hijacking.** `RuneOnboarding` (`src/components/rune/rune-onboarding.tsx:86-135`) force-navigates to `/app/profile` on bind and ejects to `/` on disconnect. The code already documents fighting itself (the `ONBOARDING_PATHS` allowlist at `:126`, the sessionStorage `postBindRedirected` guard at `:63`). It works, but the layering is brittle — any new landing route silently changes behaviour. **Fix (P2):** centralise routing intent in one guard component with explicit state, not effect side-effects racing `location`.

- **[Medium] `ShellHeader` logo is a full-page-reload `<a href="/">`** (`dashboard-shell.tsx:124-139`). Intentional (to escape the `base="/app"` wouter router), but it throws away SPA state and re-downloads the 4.2 MB chunk every time a user taps the logo. Once chunking is fixed this is less painful; consider a wouter-aware "exit app" that uses `history` + a top-level route reset instead of a hard reload.

- **[Medium] Premium-card system adoption is uneven.** `dashboard.tsx` uses `.premium-card`/`.gold-ring` consistently (good), but `vault.tsx` and `profile-nodes.tsx` re-implement the *same* header strip (amber edge lines, reactor icon, gradient title) inline (`vault.tsx:62-126`, `profile-nodes.tsx:76-113`) with copy-pasted markup and per-page `<style>` blocks (`vault.tsx:56-60`, `profile-nodes.tsx:68-70`). This is the "premium reactor" language applied by duplication, not abstraction. **Fix:** extract a `<PageHeader icon title subtitle action>` component.

- **[Medium] Two nav models, two icon sets, for the same destinations.** `BottomNav` (`bottom-nav.tsx:14-20`) uses LayoutDashboard/Eye/Shield/BarChart2/User for home/predict/vault/trade/profile, while `DesktopSidebar` (`desktop-sidebar.tsx:6-25`) uses Home/BarChart3/custom-svg/Brain/TrendingUp/User and adds a `/market` item the bottom-nav omits. The mobile and desktop primary navs are not the same IA. **Fix:** single source-of-truth nav config shared by both.

- **[Low] `copy-trading.tsx` route exists** (`dashboard-shell.tsx:16,168`) but is a 1.5 KB stub — surface it as "coming soon" or remove from the router to avoid a dead destination.

---

## 3. Mobile (phone-first — `max-w-lg`, BottomNav, `lg:` desktop switch)

The app is clearly phone-targeted and mostly handles it well; specific issues:

- **[High] Bottom-nav tap targets are below 44 px.** `bottom-nav.tsx:66` buttons are `py-2.5` (10 px) around a 19 px icon + ~11 px label ≈ **~40 px tall**, inside a bar with `mb-2.5`. Apple/WCAG target is ≥44 px. **Fix:** raise to `py-3`/`min-h-[44px]`.

- **[High] Pervasive sub-11 px text.** 236 occurrences of `text-[7px]…text-[10.5px]` in `src/app/pages` + `components`. The bottom-nav English code drops to **7.5 px** in CJK mode (`bottom-nav.tsx:136`). At 320–360 px this is unreadable and below the 11 px iOS minimum. Muted text already sits at `--muted-foreground: 40 14% 72%` on `28 16% 10%` — borderline contrast — so tiny + low-contrast compounds. **Fix:** floor body/label text at 11–12 px; reserve ≤10 px for non-essential decoration only.

- **[Medium] Base shadcn `DialogContent` has no mobile sheet/scroll treatment.** `src/components/ui/dialog.tsx:43` is a fixed `max-w-lg`, centered, `p-6`, `sm:rounded-lg` box with **no `max-height` and no internal scroll**. Short modals (bind, no-node) are fine, but any dialog whose content exceeds the viewport will clip/overflow at 320–667 px. The **purchase modal correctly overrides** this (`purchase-node-modal.tsx:125`: `max-h-[88dvh] overflow-y-auto`, good `dvh` usage) — but that fix should live in the primitive. **Fix:** add `max-h-[90dvh] overflow-y-auto` + optional bottom-sheet variant (vaul is already a dependency) to `DialogContent`.

- **[Medium] Horizontal scroll regions hide their scrollbar.** `trade.tsx:802` and `market.tsx:441` use `overflow-x-auto scrollbar-hide` for coin/category selectors. Fine on touch, but on desktop/trackpad there's zero affordance that more content exists off-edge. **Fix:** add edge fade-masks (the `node-dialog-scroll` mask recipe already exists in `app/index.css`) or visible-on-hover scrollbars.

- **[Good] Safe-area insets are handled** where it matters: BottomNav uses `env(safe-area-inset-bottom)` (`bottom-nav.tsx:33`) and pages reserve `pb-20`/`pb-24` for it (`dashboard-shell.tsx:198`, `vault.tsx:36`). Sticky header uses `top-0 z-40` with backdrop blur — fine.

- **[Good] Sidebar↔bottom-nav switch is clean** at `lg` (`desktop-sidebar.tsx:47` `hidden lg:flex`; bottom-nav `lg:hidden`). Main column `max-w-lg lg:max-w-4xl` + `overflow-x-hidden` (`dashboard-shell.tsx:198`) prevents horizontal-scroll traps at the page level.

- **[Low] Mobile drawer width `78vw max-w-[300px]`** (`layout.tsx:379`) is good; but its hard-coded dark `bg-[#080f1e]` (blue-black) doesn't match the warm app/header background — visible seam when open.

---

## 4. Cross-Cutting

### Design System
- **[High] Two parallel design-token files** (`src/index.css` marketing vs `src/app/index.css` app) define the *same* variable names (`--background`, `--card`, `--primary`, `--border`) to **different values and even different color models** (marketing 228° blue-grey; app 28° warm). Shared shadcn primitives (`Card`, `Dialog`, `Button`) therefore render differently depending on which surface mounts them. **Fix:** one canonical token layer; let the app be a *tint* of marketing, not a fork.
- **[Medium] `.surface-3d` is defined twice** (marketing `index.css:479` and app `index.css:1035`) with the same body — duplication that will drift.
- **[Good] The premium-card / gold-ring system is genuinely high quality** — `@property --gold-angle` conic animation with mask-composite ring + blurred halo (`app/index.css:1068-1186`), tabular-num `.num`/`.num-gold` financial type, corner-bracket HUD motif. This is distinctive, on-theme, and not generic. Preserve and *spread* it (including into marketing).

### Accessibility
- **[High] No focus-visible strategy** app-wide (see Exec #4). `.floating-nav-item { outline: none }` with no replacement.
- **[Medium] Color-contrast of muted text** — `--muted-foreground` 72% L on 10% L background, frequently rendered at ≤10 px and at reduced opacity (`text-amber-200/65`, `text-foreground/40`). Many of these will fail 4.5:1. Audit the smallest/faintest labels.
- **[Good] `prefers-reduced-motion` is respected** for the AI-analysis animations, gold-ring, marquee (`app/index.css:716-752, 1188-1192`). **But** the dozens of *infinite* framer-motion loops in `layout.tsx`/`dashboard-shell.tsx` `AnimatedRuneLogo` (5 simultaneous infinite `motion.div`s) and the header orbs are **not** gated by reduced-motion (they're JS-driven `animate={{...repeat:Infinity}}`). **Fix:** wrap framer infinite loops in a `useReducedMotion()` check.
- **[Medium] Icon-only buttons lack labels** — e.g. the market-analysis icon button (`dashboard.tsx:224`) has `data-testid` but no `aria-label`; the mobile hamburger has one (`layout.tsx:351`, good) — apply consistently.

### Performance
- **[Critical] Entry-chunk bloat** (Exec #1): no `manualChunks`, eager marketing pages, eager `ThirdwebProvider`, eager 12-locale i18n, direct `recharts` imports in `rune.tsx`/`tools.tsx`/`dashboard.tsx`/`legend-atm.tsx`/`b18.tsx`/`hyperliquid.tsx`.
- **[High] Animation cost.** Many *always-on infinite* loops compound on first paint: `AnimatedRuneLogo` runs 5 infinite motion animations and is mounted in **both** the marketing header and the app header; marketing header adds 2 more drifting orbs; vault/nodes pages each run an infinite diagonal `backgroundPosition` sweep (`vault.tsx:44-54`) plus pulse-line keyframes; the conic gold-ring repaints continuously. Conic-gradient + `filter: blur(10–14px)` animating `--gold-angle` is GPU-paint-heavy on low-end Android. **Fix:** pause off-screen animations (IntersectionObserver), reduce simultaneous infinite loops, and gate by reduced-motion.
- **[Medium] Image handling** — logos are PNGs loaded via `<img>`/CSS mask with manual `filter: brightness()` (`layout.tsx:107-120`); no `loading="lazy"`, no width/height on decorative imgs (the wordmark uses an invisible sizing `<img>` trick, `dashboard-shell.tsx:95`). Provide intrinsic dimensions / lazy-load below-fold imagery to cut CLS.

### i18n
- **[Critical] Dual desynced systems + mismatched language sets + default conflict** (Exec #2).
- **[High] Missing RTL for `ar`** (Exec #3).
- **[Medium] Inconsistent fallback ergonomics.** App pages mix `t("key")` (react-i18next, silent key-echo on miss) with `t("key", "English fallback")` (good, e.g. `dashboard-sub-tabs.tsx:53`, `vault.tsx:122`) and the marketing `t()` warns-then-echoes the key in DEV (`language-context.tsx:57`). The app i18n has no analogous missing-key surfacing. Standardise on inline fallbacks for all user-facing strings so a missing key never shows a raw `profile.nodesPageTitle` to a user.
- **[Low] Some app strings are hard-coded Chinese fallbacks** (e.g. `no-node-reminder.tsx:33` `"节点持有者方可获得直推返佣"`, `profile-referral.tsx:31` `"请先连接钱包"`) — fine as fallbacks, but English readers see Chinese if the key is missing in their locale.

---

## 5. Prioritized Optimization Plan

### P0 — Quick wins (≤1 day each, high ROI)
1. **Add `build.rollupOptions.output.manualChunks`** splitting `thirdweb`, `recharts`, `framer-motion`, and the locale JSONs into vendor chunks. *Touches:* `vite.config.ts`. *Effort:* S. Biggest single perf win.
2. **`lazy()`-load all marketing pages** in the router, mirroring the app shell. *Touches:* `src/app-router.tsx`. *Effort:* S.
3. **Bottom-nav tap targets + min text size:** `py-3`/`min-h-[44px]`, floor labels at ≥11 px. *Touches:* `src/app/components/bottom-nav.tsx`. *Effort:* S.
4. **Add `max-h-[90dvh] overflow-y-auto` to base `DialogContent`.** *Touches:* `src/components/ui/dialog.tsx`. *Effort:* XS.
5. **Set `dir` on language change** (`document.documentElement.dir = isRtl ? 'rtl' : 'ltr'` for `ar`). *Touches:* `src/contexts/language-context.tsx`, `src/app/components/lang-switcher.tsx`. *Effort:* S (layout polish follows in P1).
6. **Add `aria-label` to icon-only buttons** + restore a visible `:focus-visible` ring globally (one utility, applied via base layer). *Touches:* `src/app/index.css` (remove blanket `outline:none`, add focus-visible), icon buttons in `dashboard.tsx` etc. *Effort:* S.

### P1 — (2–4 days each)
7. **Reconcile the two language sets + defaults + bridge.** Make both switchers offer the *same* list, agree on a default, and stop mapping fr/de/ar/pt→en (backfill marketing dictionaries or hide unsupported langs in marketing). *Touches:* `src/contexts/i18n/*`, `src/components/language-toggle.tsx`, `src/app/components/lang-switcher.tsx`, `src/app/lib/i18n.ts`. *Effort:* M.
8. **Lazy-load `recharts` consumers** (dynamic import chart components behind Suspense). *Touches:* `vault-charts.tsx`, `market.tsx`, `trading-vault-banner.tsx`, marketing `rune.tsx`/`tools.tsx`/`dashboard.tsx`/`legend-atm.tsx`/`b18.tsx`/`hyperliquid.tsx`. *Effort:* M.
9. **Extract a shared `<PageHeader>`** for the reactor-strip header duplicated across vault/nodes (and adopt on profile sub-pages). *Touches:* new `src/app/components/page-header.tsx`, `vault.tsx`, `profile-nodes.tsx`. *Effort:* M.
10. **Single nav config** shared by `BottomNav` + `DesktopSidebar` (same icons, same destinations, decide on `/market` placement). *Touches:* new `src/app/lib/nav.ts`, both nav components. *Effort:* M.
11. **Gate all infinite framer-motion loops behind `useReducedMotion()`** and pause off-screen page animations. *Touches:* `layout.tsx`, `dashboard-shell.tsx`, `vault.tsx`, `profile-nodes.tsx`. *Effort:* M.
12. **Contrast/typography pass:** audit ≤10 px + reduced-opacity muted text against 4.5:1; bump failing cases. *Touches:* app pages broadly. *Effort:* M.

### P2 — (larger / structural)
13. **Unify the design-token layer** so marketing and app are one palette (app = tint of marketing). Dedupe `.surface-3d`. Spread the premium-card/gold-ring system into marketing cards. *Touches:* `src/index.css`, `src/app/index.css`, marketing card components. *Effort:* L. Removes the "two products" seam.
14. **Refactor onboarding routing** into one explicit guard component instead of racing effects; promote the bind-modal disconnect to a real secondary button + add "no referrer?" help. *Touches:* `rune-onboarding.tsx`, `bind-referrer-modal.tsx`. *Effort:* M–L.
15. **Replace the hard-reload app→marketing logo exit** with a router-aware transition once chunking is split. *Touches:* `dashboard-shell.tsx`, router. *Effort:* M.
16. **Image pipeline:** intrinsic dimensions + lazy-loading for decorative/below-fold imagery; consider WebP for logos. *Touches:* `layout.tsx`, `dashboard-shell.tsx`, project pages. *Effort:* M.

---

### What's genuinely good (keep)
- The amber "premium reactor" identity (gold-ring conic animation, num-gold financial type, corner-bracket HUD, Orbitron display) is distinctive and avoids generic AI aesthetics — exactly the kind of committed direction the design lens rewards. The problem is *consistency and reach*, not taste.
- Loading/empty/error states are present and on-brand (skeleton pulses in `dashboard.tsx:272/320`, `common.noData` empty states, wallet-not-configured banner in `wallet-connect-button.tsx:27`, `isResolvingWallet` skeleton CTA in `home.tsx:317`).
- `dvh` usage and safe-area insets show real mobile care.
- `prefers-reduced-motion` coverage for CSS animations is above average.
