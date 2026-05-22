# Rune-final

Clean architecture rebuild of the Rune frontend. Vite + React + Supabase + Thirdweb. No api-server, no monorepo coupling.

## Status

**Phase 0 — skeleton complete.** Subsequent phases (data layer, page migration, i18n merge, routing) are tracked in `RUNE_FINAL_MIGRATION.md` in the source `RUNE` repo.

## Stack

- Vite 7 + React 19
- Tailwind 4
- shadcn/ui (New York style)
- Supabase (auth + data + realtime)
- Thirdweb (wallet + on-chain)
- Wouter (routing)
- i18next (9 languages)

## Local dev

```bash
pnpm install
cp .env.example .env       # values already filled with mainnet
pnpm dev                    # http://localhost:5173
```

## Build

```bash
pnpm build:mainnet          # produces dist/public
```

## Deploy

Push to `main` triggers `.github/workflows/deploy.yml` → Cloudflare Pages (`rune-final` project).

Required GitHub secrets:
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

## Project structure (target)

```
src/
├── marketing/   # 官网公开页面（home, projects, rune, recruit, tools, …）
├── app/         # 会员登录后 dashboard（trade, vault, strategy, profile, …）
├── components/ui/  # 统一 shadcn 组件库
├── lib/         # supabase client, calculators, queries, formats
├── i18n/        # 9 语言（en, es, ja, ko, ru, th, vi, zh, zh-TW）
└── contexts/    # language, providers
```
