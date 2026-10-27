# GenifySuite

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
![Next.js](https://img.shields.io/badge/Next.js-16-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Node](https://img.shields.io/badge/node-%E2%89%A520.9-green)

A full-stack developer toolkit built with Next.js: test-card validation and generation, fake test data, everyday
dev utilities (passwords, UUIDs, QR codes, JSON, colors, IP lookup), and a set of AI tools including a real
tool-calling agent. Includes accounts, per-tool save-to-history, bring-your-own-key AI, and optional Stripe billing.

GenifySuite 2.0 is a rebuild of an earlier HTML/CSS/JS learning project.

## Contents

- [Tools](#tools)
- [Tech stack](#tech-stack)
- [Quick start](#quick-start)
- [Environment variables](#environment-variables)
- [Scripts](#scripts)
- [AI features](#ai-features)
- [Dashboard](#dashboard)
- [Accounts, email and security](#accounts-email-and-security)
- [Access model](#access-model)
- [Tests](#tests)
- [Deployment](#deployment)
- [Project structure](#project-structure)
- [Extending it](#extending-it)
- [Design system notes](#design-system-notes)
- [A note on the card tools](#a-note-on-the-card-tools)
- [License](#license)

## Tools

| Category | Tools |
|---|---|
| **AI tools** | AI agent, Regex generator, Commit message writer, Schema to fake data, API mock generator, Cron builder & explainer, Error explainer |
| **Card tools** | Card validator (Luhn + network detection), Test card generator |
| **Data & text** | Profile generator, Lorem ipsum generator |
| **Dev utilities** | JSON formatter, Password generator, UUID generator, Color palette generator, QR code generator |
| **Network** | IP address finder |

Every tool has its own page under `/tools/<slug>`, an animated result reveal, and a **Cmd+K / Ctrl+K** command
palette (also reachable from the navbar) that jumps to any tool or action. Signed-in users can save results to
their history.

## Tech stack

- **Next.js 16** (App Router, TypeScript, Turbopack), pinned exactly. Requires **Node 20.9 or newer**
- **React 19**
- **Prisma 5 + PostgreSQL**
- **Auth.js (NextAuth v4)**: email/password, plus optional Google and GitHub OAuth
- **Tailwind CSS 3** with a custom design system
- **Stripe** (optional billing) and **Resend** (verification and password-reset email)
- **Vitest** for tests, with no database, network or API keys needed
- An alternate **Cloudflare Workers** build via vinext (see [Deployment](#deployment))

## Quick start

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Get a PostgreSQL database** and copy its connection string. Any of these work:
   - [Supabase](#setting-up-supabase)
   - [Neon](https://neon.tech) (serverless Postgres, generous free tier)
   - [Vercel Postgres](https://vercel.com/storage/postgres)
   - A local Postgres, for example `postgresql://postgres:postgres@localhost:5432/genifysuite`

3. **Create your env file**

   ```bash
   cp .env.example .env
   ```

   At minimum set `DATABASE_URL`, `DIRECT_URL`, `NEXTAUTH_SECRET` (generate with `openssl rand -base64 32`) and
   `NEXTAUTH_URL` (`http://localhost:3000` locally). For a non-Supabase database you can point both URLs at the
   same string. To use the AI tools, also set `ENCRYPTION_KEY` (same generator). Everything else is optional; see
   [Environment variables](#environment-variables).

4. **Create the tables**

   ```bash
   npm run db:push
   ```

   Run this again after pulling changes that touch `prisma/schema.prisma`.

5. **Run it**

   ```bash
   npm run dev
   ```

   Open <http://localhost:3000>. With no email provider configured, verification and password-reset emails
   (with their links) are printed in your terminal during development.

### Setting up Supabase

GenifySuite uses Supabase only as a plain Postgres host through Prisma. No Supabase Auth, Storage or Edge
Functions are needed.

1. Create a project at [supabase.com](https://supabase.com) and set a database password (you will need it below).
2. Go to **Project Settings → Database → Connection string**.
3. Use the **pooler** strings, not the plain direct connection (that one is IPv6-only and unreachable from most
   networks):
   - **Transaction pooler** (port `6543`) is your `DATABASE_URL`. Append `?pgbouncer=true`.
   - **Session pooler** (port `5432`) is your `DIRECT_URL`.

   Replace `[YOUR-PASSWORD]` in both with your database password.
4. Run `npm run db:push`, start the app, and register an account to confirm rows appear under
   **Table Editor → User**.

### Google and GitHub sign-in (optional)

Email/password works with no extra setup. To add OAuth:

- **Google:** [Cloud Console](https://console.cloud.google.com/apis/credentials) → Create OAuth client ID → Web
  application → redirect URI `http://localhost:3000/api/auth/callback/google` (plus your production URL).
- **GitHub:** [Developer Settings](https://github.com/settings/developers) → New OAuth App → callback URL
  `http://localhost:3000/api/auth/callback/github`.

Put the client ID and secret in the matching `*_CLIENT_ID` / `*_CLIENT_SECRET` variables, then set
`NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED=true` and/or `NEXT_PUBLIC_GITHUB_OAUTH_ENABLED=true` so the sign-in page shows
the buttons.

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | Pooled Postgres connection used at runtime |
| `DIRECT_URL` | yes | Direct connection used by `prisma db push` / `migrate` |
| `NEXTAUTH_SECRET` | yes | Session signing secret. In production it must be 32+ characters and not the placeholder |
| `NEXTAUTH_URL` | yes | Your public address. Emailed links are built from this, never from the request's `Host` header. Must be your real `https://` URL in production |
| `RESEND_API_KEY`, `EMAIL_FROM` | production | Email delivery. Verify a sending domain in [Resend](https://resend.com) first. Without them, dev prints emails to the terminal and production sends nothing |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | no | OAuth providers |
| `NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED`, `NEXT_PUBLIC_GITHUB_OAUTH_ENABLED` | no | Show the matching sign-in buttons |
| `ENCRYPTION_KEY` | for AI tools | AES-256-GCM key that encrypts saved provider API keys. Generate with `openssl rand -base64 32` |
| `ANTHROPIC_API_KEY` | no | *Your* key, enabling the optional "use GenifySuite's key" path |
| `GENIFY_SHARED_MODEL` | no | Model for the shared-key path (default `claude-haiku-4-5`) |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_PRO` | no | Paid tiers for the shared key |
| `GENIFY_TRUSTED_IP_HEADER` | recommended in production | Header your host sets with the real client IP (for example `cf-connecting-ip` on Cloudflare). Leave blank on Vercel |
| `GENIFY_TRUSTED_PROXY_HOPS` | no | When the header is `x-forwarded-for`: how many of your proxies append to it (default 1) |
| `GENIFY_ALLOW_PRIVATE_AI_HOSTS` | no | `true` only on a self-hosted install that really runs Ollama or another model server on localhost or a private network |

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server at `http://localhost:3000` |
| `npm run build` / `npm start` | Production build (runs `prisma generate` first) and server |
| `npm test` / `npm run test:watch` | Run the Vitest suite once / in watch mode |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run check` | Typecheck and tests |
| `npm run db:push` | Push the Prisma schema to your database |
| `npm run db:migrate` | `prisma migrate dev` |
| `npm run db:studio` | Open Prisma Studio |
| `npm run dev:vinext` / `build:vinext` / `start:vinext` | Cloudflare (vinext) build: dev on port 3001, build, preview |
| `npm run deploy:vinext` | Deploy the vinext build to Cloudflare Workers |
| `npm run deploy:response-store` | Deploy the companion response-store worker |

## AI features

The AI tools run on an AI provider that is configured **per user**, in **Settings → AI provider keys**
(`/settings/ai`), not per deployment. Until a user adds a key, the tools simply say so.

### Bring your own key (BYOK)

Supported providers: **Anthropic**, **OpenAI**, **Ollama**, **NVIDIA NIM**, and any other OpenAI-compatible
endpoint (Groq, Together, LM Studio and so on: choose *Custom* and give the base URL). Keys are encrypted with
`ENCRYPTION_KEY` before they are stored and are never sent back to the browser. BYOK usage has a flat cap of
200 requests per user per day as an abuse guard (`BYOK_DAILY_LIMIT` in `src/lib/ai/usage.ts`).

### "Use GenifySuite's key" (optional)

Only offered if you set `ANTHROPIC_API_KEY`. Signed-in users with a verified email get a small free allowance and
can subscribe for more:

| Tier | Shared-key requests per day |
|---|---|
| Free | 3 |
| Starter | 50 |
| Pro | 300 |

The numbers live in `SHARED_KEY_DAILY_LIMIT` in `src/lib/ai/usage.ts`; they are placeholders, so tune them to what
each tier's price actually covers. To enable paid tiers:

1. Create two Products/Prices in the [Stripe Dashboard](https://dashboard.stripe.com/products) and put their Price
   IDs in `STRIPE_PRICE_STARTER` and `STRIPE_PRICE_PRO`.
2. Set `STRIPE_SECRET_KEY`.
3. Add a webhook endpoint at `https://yourdomain.com/api/billing/webhook` for
   `customer.subscription.created`, `customer.subscription.updated` and `customer.subscription.deleted`, and put
   its signing secret in `STRIPE_WEBHOOK_SECRET`.

A paid tier only counts while the Stripe subscription is `active` or `trialing`. None of this is needed to use
the app: BYOK works with no billing setup.

### The agent

`/tools/ai-agent` is real tool-calling, not a scripted demo. It can call these tools, which run the same
functions as the standalone tool pages: `generate_password`, `generate_uuids`, `generate_time_ordered_ids`,
`generate_fake_profiles`, `generate_lorem_ipsum`, `generate_color_palette`, `generate_test_cards`, `format_json`,
`cron_next_runs` and `list_saved_history` (labels only; saved values are never exposed to the model).

- **Streaming:** replies stream token by token. Both provider adapters parse Server-Sent Events
  (`src/lib/ai/sse.ts`) and reassemble the differently fragmented tool-call arguments of Anthropic and
  OpenAI-compatible APIs. The route streams newline-delimited JSON to the browser, so the client does not need
  to know which provider answered. Auth, key lookup, rate limit and daily cap are all checked *before* streaming
  starts, so those failures are ordinary HTTP errors (401, 429, ...). A **Stop** button aborts the request and
  stops paying for tokens nobody is reading.
- **Saved workflows:** save any agent prompt with a name and re-run it in one click (up to 30 per user). Export all
  workflows to a `.json` file, or import someone else's; import respects the same cap.
- **Cron is verified, not trusted:** `src/lib/cron.ts` is a small dependency-free cron parser and next-run
  calculator. Whatever expression the model returns is parsed and its next runs computed locally, so a wrong
  answer shows up as a wrong-looking preview or a validation error. The chat renders the same next-run list the
  dedicated cron tool shows.
- Pure-LLM features (fixtures, mocks, error explanations) are deliberately *not* wrapped as agent tools: the agent
  is already an LLM, so a nested call would double the cost for the same answer.

### Single-shot AI tools

The regex generator, commit message writer, schema-to-fake-data, API mock generator, cron tool and error
explainer all go through one endpoint, `POST /api/ai/run`, driven by the registry in `src/lib/ai/features.ts`.

### AI assist on existing tools

Opt-in and signed-in, using your chosen key: the JSON formatter can explain JSON or convert it to TypeScript or
Zod; the profile generator takes a plain-English description; the color palette takes a "vibe". For palettes the
AI only steers the base color and harmony: the palette itself still comes from the deterministic tool. On the
dashboard, **Ask your history** searches your saved items in plain English; only tool names, dates and short labels
are sent to your provider, never the saved payloads.

### Rate limiting

Every AI request passes a database-backed fixed-window limiter (`src/lib/rate-limit.ts`) first: **6 per minute**
on the shared key and **20 per minute** on BYOK. It is database-backed rather than in-memory because on serverless
hosts your app runs across many instances, and an in-memory counter would let someone multiply their limit by the
number of warm instances. A request is taken from the daily allowance *before* the provider is called and handed
back only when the failure certainly cost nothing (a network error or provider 5xx). The agent also caps
conversation size (`src/lib/ai/agent-limits.ts`).

### Privacy

Anything pasted into an AI tool (stack traces, schemas, JSON) is sent to whichever provider the user selected.
The error explainer says so on the page. Strip secrets first.

## Dashboard

An overview rather than just a history list: quick links to the agent, AI settings, billing and the tools index;
stat cards (items saved, today's shared-key and BYOK usage against your caps, keys and workflows); a 14-day
activity chart; and a most-used-tools breakdown. It is plain CSS with no charting library. The 14-day window is
built from UTC calendar-day boundaries, not a rolling "now minus 14 x 24 hours", so the oldest day the database
returns always lines up exactly with the oldest bucket the chart draws.

## Accounts, email and security

**Email verification and password reset** work out of the box locally (the email and its link print in your
terminal). In production, create a [Resend](https://resend.com) account, verify a domain, and set
`RESEND_API_KEY` and `EMAIL_FROM`.

- **Sign-in throttling** counts only *failed* attempts, three ways: this account from this address (8 per 15
  minutes), one address across many accounts (40), and one account from anywhere (40). Keying on email plus
  address means a stranger hammering your email cannot lock you out of your own device, and successful sign-ins
  never use up the allowance. Attempts are counted before the password is checked, so parallel guesses cannot
  outrun the limit.
- **No account enumeration:** "forgot password" answers identically, and in the same time (the email is sent after
  the response), whether or not the address has an account. A missing account still does a full bcrypt comparison
  at sign-in so timing does not give it away.
- **One-time, hashed tokens:** only a SHA-256 of each link's token is stored. Verification links last 24 hours and
  reset links 1 hour; each works once; a reset link cannot be used as a verification link or vice versa; and a
  too-weak new password is rejected *before* the link is consumed.
- **Revocable sessions:** changing or resetting a password, or "Sign out everywhere", sets
  `User.sessionsValidAfter`, and every session read compares against it, so stolen cookies stop working at once.
  Deleting an account kills its sessions the same way.
- **Password policy:** 8+ characters, not a common password, not containing your email, and at most 72 bytes
  (bcrypt silently ignores anything longer).
- **Verified email is required** for the shared AI key and for subscribing. Bringing your own key needs nothing.
  Google and GitHub sign-ups count as verified.
- **Account page** (`/settings/account`): confirm email, change password, sign out everywhere, and delete the
  account (which cancels an active Stripe subscription first, and stops if it cannot).
- **Startup checks:** in production the app refuses to sign anyone in if `NEXTAUTH_SECRET` is missing, shorter
  than 32 characters or still the `.env.example` placeholder, and checks `ENCRYPTION_KEY` the same way when set.
- **AI provider URLs:** a saved base URL is called by the server, so in production it must be a public `https`
  address (private, loopback and metadata addresses, credentials, query strings and redirects are refused, and
  the hostname's DNS is checked). A local Ollama therefore only works in development, or on a self-hosted install
  with `GENIFY_ALLOW_PRIVATE_AI_HOSTS=true`. See `src/lib/ai/url-safety.ts`.
- **Client IP:** set `GENIFY_TRUSTED_IP_HEADER` for your host, or per-IP rate limits cannot tell clients apart
  reliably.
- Post-login redirects only go to paths on your own site, and standard security headers are set
  (`X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS, `frame-ancestors 'none'`). A full
  script-src Content-Security-Policy is deliberately not included, since the app uses inline scripts and a strict
  policy needs per-request nonces.

Known trade-offs: registration still says when an email is already taken (the friendlier choice; it is
rate-limited per address), and per-address limits trust the configured IP header, so set it correctly for your
host. The per-account limits protect you either way.

## Access model

- **Public:** home, `/tools` (the list), `/pricing`, `/about`.
- **Preview only when signed out:** each `/tools/<slug>` page. `ToolShell` renders the tool as an inert, blurred
  preview with an unlock card and opens the login/sign-up popup (`components/auth-modal.tsx`). Open it from
  anywhere with `openAuthModal({ mode: "login" | "register" })` from `src/lib/auth-modal.ts`.
- **Enforced on the server:** every AI route (`/api/ai/*`), `/api/ip-lookup`, history, workflows, account and
  billing routes return 401 without a session. The dashboard and settings are also redirected by `src/proxy.ts`,
  but that is only a coarse first gate: every protected page and route checks the session itself.

## Tests

```bash
npm test            # run the whole suite once
npm run test:watch  # re-run on change
npm run typecheck   # tsc --noEmit
npm run check       # typecheck + tests
```

The suite (Vitest) needs no database, network or API keys. Prisma is replaced by a small in-memory fake
(`test/fake-prisma.ts`), and AI providers by local fake servers (`test/helpers/http.ts`) that deliberately deliver
streams in awkward chunks (cut mid-line and mid-character, the way a real TCP stream can). It covers the cron
engine, card generation and Luhn checks, every generator, the SSE parser, both provider adapters, the agent loop
and AI features, rate limiting, usage caps, credential resolution (including "cannot use someone else's key"), the
account system, and sign-in, session invalidation and the throttled-login path using the real NextAuth library
with real JWT cookies.

## Deployment

All hosts need the same environment variables as local, with production values: a production `NEXTAUTH_URL`,
production OAuth redirect URIs, and `GENIFY_TRUSTED_IP_HEADER` set for your host.

### Vercel

1. Push the repo to GitHub and **New Project → import** it in Vercel.
2. Add the variables from `.env` (`DATABASE_URL` and `DIRECT_URL` if you use Supabase).
3. Deploy. Vercel runs `npm run build`, which runs `prisma generate` before `next build`.
4. After the first deploy, run `npx prisma db push` once against the production `DATABASE_URL` (locally, or via
   Vercel's CLI) to create the tables.

### Netlify

Works through Netlify's Next.js runtime with the same variables and `npm run build`. Neon or Supabase both work as
the database.

### Cloudflare Workers (vinext)

An alternate build path is included: `vite.config.ts` and `cloudflare.config.ts` build the app with
[vinext](https://www.npmjs.com/package/vinext) for Cloudflare Workers, with a companion response-store worker
(`genifysuite-response-store`) for caching.

```bash
npm run dev:vinext             # dev server on :3001
npm run build:vinext           # production build
npm run deploy:response-store  # deploy the response-store worker
npm run deploy:vinext          # deploy the app
```

Set `GENIFY_TRUSTED_IP_HEADER=cf-connecting-ip` on Cloudflare.

## Project structure

```text
src/
  app/
    (auth)/login, (auth)/register   sign-in and sign-up pages
    api/                            auth, account, history, workflows, billing, ai, ip-lookup routes
    dashboard/                      overview and saved history (requires sign-in)
    settings/                       ai, account, billing
    tools/<slug>/                   one page per tool
    pricing/, about/                public pages
  components/                       shared UI (navbar, footer, tool shell, command palette, ...)
  hooks/                            client hooks
  lib/                              framework-independent logic, easy to unit test
  lib/ai/                           providers, agent, streaming, features, usage, URL safety
  proxy.ts                          coarse auth gate for /dashboard and /settings
prisma/schema.prisma                database schema
test/                               fake Prisma, HTTP helpers, route and auth tests
cloudflare.config.ts, vite.config.ts   Cloudflare (vinext) build
```

## Extending it

**Add a tool**

1. Put the pure logic in `src/lib/<tool>.ts` (with a `.test.ts` next to it).
2. Register it in `src/lib/tools-registry.ts` (name, description, category, icon).
3. Add a page at `src/app/tools/<slug>/page.tsx` using `<ToolShell>`, and `<SaveHistoryButton tool="<slug>" .../>`
   if it should support history.

**Add a single-shot AI feature:** add one entry to `src/lib/ai/features.ts` (a zod input schema, a prompt and a
parser). It is served by `POST /api/ai/run` with no new route.

**Add an agent tool:** add an entry to `src/lib/ai/tools.ts` with a JSON Schema for its arguments and an
`execute` function. Both the Anthropic and OpenAI-compatible adapters pick it up automatically.

## Design system notes

The UI is driven by CSS-variable tokens in `src/app/globals.css` (dark by default, light via
`data-theme="light"`). Token names are historical so existing components keep working: `brass` is the violet
primary accent, `sage` is success (emerald), `rust` is danger (rose), `ink` is surfaces, `paper` is text.

Reusable pieces, with no extra dependencies:

- `components/aurora-background.tsx`: page-wide animated aurora and grid
- `components/spotlight-card.tsx`: cursor-following glow card
- `components/marquee.tsx`: CSS infinite ticker
- `components/reveal.tsx`: scroll-in animation
- `components/section-heading.tsx`: `Eyebrow` pill and `PageHeader`
- `.border-beam`, `.glass`, `.text-gradient(-animated)` and `.spotlight` utilities in `globals.css`

## A note on the card tools

The original v1 project included a second card-number generator that accepted an arbitrary bank identification
number (BIN) and produced a full card number with CVV, expiry and a fake balance in a pipe-delimited format, the
same shape as card-fraud "checker" output rather than a checkout-form testing utility. It was intentionally not
carried forward. The `card-generator` tool only produces Luhn-valid numbers from the small set of generic prefixes
that card networks publish for their own test modes (the same category as Stripe's `4242 4242 4242 4242`), with
no BIN input and no balance field. It is for QA of checkout forms and must never be used with real payment
systems.

## License

Released under the [MIT License](LICENSE). Copyright (c) 2026 Archit Aggarwal.
