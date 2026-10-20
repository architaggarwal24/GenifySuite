# GenifySuite 2.0

A rebuild of a learning-project HTML/CSS/JS toolkit into a full-stack Next.js app: card
validation and dummy test-card generation, fake test data, and dev utilities (password, UUID,
QR, JSON, color, IP lookup), with accounts and per-tool save-to-history.

## Stack

- **Next.js 16** (App Router, TypeScript, Turbopack) - pinned exactly; needs Node 20.9 or newer
- **Prisma + PostgreSQL** for the database
- **Auth.js (NextAuth)** — email/password (credentials) and optional Google/GitHub OAuth
- **Tailwind CSS** with a custom design system (see `tailwind.config.ts`)

## What changed from v1

The original project had a second card-number generator (`advance.html`) that accepted an
arbitrary bank identification number (BIN) and produced full card number + CVV + expiry + a
fake balance in a pipe-delimited format — the same shape as "fullz" checker-tool output used
for card fraud, rather than a checkout-form testing utility. That tool was intentionally not
carried forward. The `card-generator` tool here only generates Luhn-valid numbers from the
small set of generic prefixes card networks publish for their own test-mode docs (the same
category as Stripe's `4242 4242 4242 4242`), with no BIN input and no balance field.

## Local setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Get a Postgres database.** Any of these work — pick one and copy its connection string:
   - [Supabase](https://supabase.com) — see the step-by-step below
   - [Neon](https://neon.tech) (serverless Postgres, generous free tier)
   - [Vercel Postgres](https://vercel.com/storage/postgres)
   - A local Postgres instance (`postgresql://postgres:postgres@localhost:5432/genifysuite`)

3. **Copy the env file and fill it in**

   ```bash
   cp .env.example .env
   ```

   - `DATABASE_URL` — the connection string from step 2
   - `NEXTAUTH_SECRET` — generate with `openssl rand -base64 32`
   - `NEXTAUTH_URL` — `http://localhost:3000` locally
   - OAuth vars are optional; leave them blank to use email/password only (see below)

4. **Push the schema to your database**

   ```bash
   npm run db:push
   ```

5. **Run it**

   ```bash
   npm run dev
   ```

   Visit `http://localhost:3000`.

## Adding Google / GitHub sign-in (optional)

Email/password works with zero extra setup. To add OAuth:

**Google** — [Google Cloud Console](https://console.cloud.google.com/apis/credentials) →
Create OAuth client ID → Web application → Authorized redirect URI:
`http://localhost:3000/api/auth/callback/google` (and your production URL once deployed).
Copy the client ID/secret into `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.

**GitHub** — [GitHub Developer Settings](https://github.com/settings/developers) → New OAuth
App → Authorization callback URL: `http://localhost:3000/api/auth/callback/github`. Copy the
client ID/secret into `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`.

Then set `NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED=true` and/or `NEXT_PUBLIC_GITHUB_OAUTH_ENABLED=true`
so the sign-in page shows the matching button.

## Setting up Supabase

1. Go to [supabase.com](https://supabase.com), sign in, and click **New project**. Pick an
   organization, name it (e.g. `genifysuite`), set a database password (save it — you'll need
   it in the connection strings below), pick a region close to you, and create it. It takes
   about a minute to provision.
2. Once it's ready, go to **Project Settings** (gear icon) → **Database**.
3. Under **Connection string**, switch the mode dropdown between these two — don't use the
   plain **URI** / direct connection option, it's IPv6-only and unreachable from most networks:
   - **Transaction pooler** (port `6543`) → this is your `DATABASE_URL`.
   - **Session pooler** (port `5432`) → this is your `DIRECT_URL`.
   Both host strings look like `aws-0-<region>.pooler.supabase.com`. Both use the same password
   you set in step 1 — replace `[YOUR-PASSWORD]` in the copied string with it.
4. Paste both into your `.env` file (see `.env.example` for the exact shape — note the pooled
   one needs `?pgbouncer=true` on the end).
5. Push the schema: `npm run db:push`. This creates all the tables (users, sessions, history)
   in your Supabase project — you'll see them appear under **Table Editor** in the Supabase
   dashboard.
6. Run `npm run dev` and create an account through the app's `/register` page to confirm it's
   writing to the database (check **Table Editor → User** in Supabase).

That's it — no Supabase Auth, Storage, or Edge Functions needed here, this project only uses
Supabase as a plain Postgres host via Prisma.

## UI polish

Per-tool icons (`src/components/tool-icon.tsx`, backed by `lucide-react`), a result-reveal
animation on every generated output (`src/components/result-reveal.tsx`), skeleton loading
states for network calls, and a **Cmd+K / Ctrl+K command palette** (`src/components/
command-palette.tsx`, via `cmdk`) that jumps to any tool or action - also reachable via the
"Search tools" button in the navbar for people without a keyboard shortcut habit.

The agent's replies render as Markdown once complete, and animate in progressively rather than
appearing all at once (`src/hooks/use-typewriter.ts`) - deliberately a client-side reveal of the
already-complete response, not literal token-by-token network streaming. True streaming through
a multi-provider, tool-calling loop would mean handling Anthropic's and OpenAI's very different
incremental tool-call-argument formats, which isn't something to bolt on without a live key to
verify against - worth revisiting if it matters enough to you to prioritize.

## AI features (BYOK, agent, billing)

Three new tools under "AI tools": an **agent** that calls your other tools via natural
language, a **regex generator**, and a **commit message writer**. All three need an AI
provider — configured per-user, not per-deployment, via **Settings → AI provider keys**
(`/settings/ai`).

**Bring your own key (BYOK).** Anthropic, OpenAI, a local or self-hosted Ollama, NVIDIA NIM, or
any other OpenAI-compatible endpoint (Groq, Together, LM Studio, etc. — pick "Custom" and point
it at the base URL). Keys are encrypted (`AES-256-GCM`) before they're written to the database
using `ENCRYPTION_KEY` (generate one the same way as `NEXTAUTH_SECRET`: `openssl rand -base64
32`) and are never sent back to the browser after saving. BYOK usage is capped at 200
requests/day/user as a flat abuse guard (it's still your server and database doing the work,
even on someone else's key) — tune `BYOK_DAILY_LIMIT` in `src/lib/ai/usage.ts`.

**"I don't have a key, use yours."** Optional — only appears if you set `ANTHROPIC_API_KEY` in
`.env` (this is *your* key, the operator's, separate from anything a user saves in Settings).
When set, signed-in users can use it directly with a small free trial (3 requests/day) or
subscribe to a paid tier for a higher daily cap:

1. Create two Products/Prices in your [Stripe Dashboard](https://dashboard.stripe.com/products)
   (Starter, Pro — whatever price you want), copy their Price IDs into `STRIPE_PRICE_STARTER`
   / `STRIPE_PRICE_PRO`.
2. Set `STRIPE_SECRET_KEY` from Stripe's API keys page.
3. Add a webhook endpoint in Stripe pointing at `https://yourdomain.com/api/billing/webhook`,
   listening for `customer.subscription.created/updated/deleted`, and copy its signing secret
   into `STRIPE_WEBHOOK_SECRET`.
4. Tier daily limits live in `SHARED_KEY_DAILY_LIMIT` in `src/lib/ai/usage.ts` — the numbers
   there are placeholders, tune them against what each tier's price actually covers in tokens.

None of this is required to use the app — BYOK works with zero billing setup, and the AI tools
simply show "add a key in Settings" until a user does.

**The agent** (`/tools/ai-agent`) is real tool-calling, not a scripted demo: it can call
`generate_password`, `generate_uuids`, `generate_fake_profiles`, `generate_lorem_ipsum`, and
`generate_color_palette` (defined in `src/lib/ai/tools.ts`) against the same functions your
other tool pages use. To add a new callable tool, add an entry there with a JSON Schema for its
arguments and an `execute` function — no other wiring needed, both the Anthropic and
OpenAI-compatible adapters pick it up automatically.

After pulling this update, run `npm run db:push` again — it adds the `ApiKey`, `Subscription`,
and `AiUsage` tables.

## More AI tools, AI assist, and a smarter agent

**Seven AI tools** now live under "AI tools": the agent, regex generator, commit message writer,
and four newer ones - **Schema to fake data** (`/tools/fixtures`), **API mock generator**
(`/tools/api-mock`), **Cron builder & explainer** (`/tools/cron`) and **Error explainer**
(`/tools/error-explainer`). All of the newer single-shot features run through one endpoint,
`POST /api/ai/run`, driven by the registry in `src/lib/ai/features.ts` - adding another is one
entry there (a zod input schema, a prompt, a parser), with no new route.

**AI assist on existing tools** (opt-in, signed-in, uses your chosen key): the JSON formatter can
explain JSON or convert it to TypeScript / Zod; the profile generator takes a plain-English
description; the color palette takes a "vibe". The AI only *steers* the palette (base color +
harmony) - the palette itself is still produced by the deterministic tool.

**Cron is verified, not trusted.** `src/lib/cron.ts` is a small dependency-free cron parser and
next-run calculator. Whatever expression the model returns is parsed and its next runs are
computed locally, so a wrong answer shows up as a wrong-looking preview (or a validation error)
instead of silently passing. The agent is instructed to call the same check before presenting any
cron expression.

**Agent additions.** New agent tools: test card numbers, JSON formatting, cron verification, and
`list_saved_history` (labels only - saved values are never exposed to the model). Pure-LLM
features like fixtures, mocks and error explanations are deliberately *not* wrapped as agent
tools: the agent is already an LLM, so a nested model call would just double the cost for the same
answer - it handles those in conversation directly.

**Saved workflows.** Save any agent prompt with a name, then re-run it in one click from the agent
page (up to 30 per user). This adds a `Workflow` table - **run `npm run db:push` again**.

**Ask your history.** The dashboard has a natural-language search over your saved items ("the QR
code I made for the wifi"). Only tool names, dates and short labels are sent to your AI provider;
saved payloads are not.

**Privacy note:** anything you paste into an AI tool (stack traces, schemas, JSON) is sent to
whichever provider you selected. The error explainer says so on the page - strip secrets first.

## Rate limiting, real streaming, and workflow import/export

**Per-minute rate limiting.** Every AI request (agent, and every `/api/ai/run` feature) now
passes through a database-backed fixed-window limiter (`src/lib/rate-limit.ts`) before anything
else happens - 6/minute on the shared key, 20/minute on BYOK. It's DB-backed rather than
in-memory because on Vercel your app runs across multiple instances, so an in-memory counter
would let someone multiply their limit by however many instances happen to be warm. This adds a
`RateLimit` table - **run `npm run db:push` again.**

**Real token streaming.** The agent's replies now stream token-by-token from the provider,
properly this time - both provider adapters parse Server-Sent Events (`src/lib/ai/sse.ts`) and
reassemble fragmented tool-call arguments (Anthropic and OpenAI-compatible APIs each fragment
these differently). This replaced the earlier client-side "typewriter" simulation entirely. The
route streams newline-delimited JSON events over a plain `Response` stream
(`src/lib/ai/ndjson-response.ts`) rather than the provider's raw SSE, so the client doesn't need
to know which provider produced it. Auth, key lookup, the rate limit and the daily cap are all
checked *before* streaming starts, so those still come back as proper HTTP errors (401/429/...)
instead of failing silently mid-stream. There's a **Stop** button that aborts the fetch, which
propagates through to stop paying the provider for tokens no one's reading.

I tested this against fake SSE servers for both provider formats that deliberately mangle chunk
boundaries mid-line and mid-multibyte-character (the way a real TCP stream does), covering: text
reassembly, parallel tool calls whose id/name/arguments arrive as separate fragments, event
ordering through the agent's tool-call loop, and aborting mid-run. One real bug surfaced and got
fixed this way: both adapters only parsed SSE when *we'd* asked for it, which breaks against a
server that streams regardless of the request flag (a real risk for the Ollama/Custom BYOK
paths) - they now key off the response's actual `content-type` instead.

**Cron runs, visually, in the agent chat.** When the agent calls `cron_next_runs`, the chat shows
the same verified-locally next-run list the dedicated cron tool shows, instead of a one-line text
summary.

**Workflow export/import.** Export all your saved workflows as a `.json` file, or import someone
else's - both live next to the workflow list on the agent page. Import respects the same
30-per-user cap and skips anything over it rather than failing the whole batch.

## Dashboard

The dashboard is now an actual overview, not just a history list: quick links to the agent,
AI settings, billing and the tools index; stat cards (items saved, today's shared-key and BYOK
usage against your daily caps, keys/workflows count); a 14-day activity chart; and a most-used-
tools breakdown. All plain CSS, no charting library.

The 14-day window is built from UTC calendar-day boundaries rather than a rolling "now minus
14×24h" - which sounds equivalent but isn't: the two only agree when "now" happens to be exactly
midnight UTC. Any other time of day, a rolling window's cutoff falls partway through a calendar
day, so the oldest day you fetch from the database doesn't line up with the oldest bucket the
chart draws, and that day's rows get silently dropped. I actually hit this while building it -
caught it with a script before it shipped, checked it across a plain day, exact midnight, a
month boundary, a leap day, and a year boundary. Now the query cutoff and the oldest bucket are
mathematically the same instant, always.

## Accounts, email and security

**Email verification and password reset** work out of the box locally (the email is printed in your
terminal, link included). For production, create a free [Resend](https://resend.com) account, verify a
domain, and set `RESEND_API_KEY` and `EMAIL_FROM` (see `.env.example`). Set `NEXTAUTH_URL` to your real
https address: emailed links are built from it, never from the incoming request's `Host` header (which
would let an attacker trigger a reset email that links to their own site).

What the account system does:

- **Sign-in throttling** that counts only *failed* attempts, three ways: this account from this address
  (8 / 15 min), one address across many accounts (40), and one account from anywhere (40). Keying on
  email + address together means a stranger hammering your email can't lock you out from your own
  device. Successful sign-ins never use up the allowance.
- **No account enumeration:** "forgot password" answers identically, in the same time (the email is
  sent after the response), whether or not the address has an account, and a missing account still does a
  full bcrypt comparison at sign-in so timing doesn't give it away.
- **One-time, hashed tokens.** Only a SHA-256 of each link's token is stored. Verification links last 24
  hours, reset links 1 hour; each works once; a reset link can't be used as a verification link or vice
  versa; and a too-weak new password is rejected *before* the link is consumed.
- **Sessions can be revoked.** Changing or resetting a password, or "Sign out everywhere", sets
  `User.sessionsValidAfter`; every session read compares against it, so stolen cookies die immediately.
  Deleting an account kills its sessions the same way.
- **Password policy:** 8+ characters, not a common password, not containing your email, and at most 72
  bytes (bcrypt silently ignores anything past that, so longer passwords would be quietly truncated).
- **Verified email required** for the shared AI key and for subscribing (bringing your own key needs
  nothing). Google/GitHub sign-ups count as verified.
- **Account page** (`/settings/account`): confirm email, change password, sign out everywhere, and delete
  the account (which cancels an active Stripe subscription first, and refuses to proceed if it can't).
- Post-login redirects only ever go to paths on your own site (no open redirect), and the usual
  security headers are set (`X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS).

Known trade-offs: registration still tells you when an email is already taken (the common, friendlier
choice; it's rate-limited per address), and per-address limits trust `x-forwarded-for`, which Vercel sets
itself but a bare self-hosted server does not - the per-account limits protect you either way.

## Tests

```bash
npm test            # run the whole suite once
npm run test:watch  # re-run on change
npm run typecheck   # tsc --noEmit
npm run check       # both of the above
```

The suite (Vitest) needs no database, network, or API keys: Prisma is replaced by a small in-memory fake
(`test/fake-prisma.ts`) and AI providers by local fake servers (`test/helpers/http.ts`) that deliberately
deliver streams in awkward chunks (cut mid-line, mid-character). It covers the cron engine, card
generation and Luhn checks, every generator, the SSE parser, both provider adapters, the agent loop and
all AI features, rate limiting, usage caps, credential resolution (including "can't use someone else's
key"), the whole account system, and - using the real NextAuth library with real JWT cookies - sign-in,
session invalidation and the throttled-login error path.

Writing it turned up real bugs, all fixed: the OpenAI adapter omitted `type: "function"` on echoed tool
calls (which the real OpenAI API rejects, breaking every multi-step agent run), the free-tier shared-key
allowance was being eaten by usage of your *own* key, `/login` couldn't be prerendered (so `next build`
failed outright), Diners Club cards weren't recognised, the sample-profile generator emitted real email
domains and phone numbers, JSON "Tab" indentation produced no indentation, and an empty secret couldn't
be decrypted.

## Deploying to Vercel

1. Push this repo to GitHub.
2. In Vercel: **New Project** → import the repo.
3. Add all the variables from `.env` (with production values — both `DATABASE_URL` and
   `DIRECT_URL` if you're on Supabase, a new `NEXTAUTH_URL` pointing at your Vercel domain, and
   production OAuth redirect URIs registered with Google/GitHub if you're using them).
4. Deploy. Vercel runs `npm run build`, which runs `prisma generate` before `next build`.
5. After the first deploy, run `npx prisma db push` once (locally, pointed at the production
   `DATABASE_URL`, or via Vercel's CLI) to create the tables in your production database.

### Deploying to Netlify

Netlify can host this too via its Next.js runtime — same environment variables, same
`npm run build` command. Neon or Supabase both work well as the database from Netlify.

## Project structure

```
src/
  app/
    (auth)/login, (auth)/register    — sign-in / sign-up pages
    api/                              — auth, history, and IP-lookup API routes
    dashboard/                        — saved history (requires sign-in)
    tools/<slug>/                     — one page per tool
  components/                         — shared UI (navbar, footer, buttons, tool shell)
  lib/                                — framework-independent tool logic (easy to unit test)
prisma/schema.prisma                  — database schema
```

## Adding a new tool

1. Add the pure logic to `src/lib/<tool>.ts`.
2. Register it in `src/lib/tools-registry.ts` (name, description, category).
3. Add a page at `src/app/tools/<slug>/page.tsx` using `<ToolShell>` for consistent chrome,
   and `<SaveHistoryButton tool="<slug>" .../>` if it should support history.

## Design system notes

The UI is driven by CSS-variable tokens in `src/app/globals.css` (dark default, light via `data-theme="light"`).
Token names are historical so existing components keep working: `brass` is the violet primary accent,
`sage` is success (emerald), `rust` is danger (rose), `ink` = surfaces, `paper` = text.

Reusable pieces (no extra dependencies):

- `components/aurora-background.tsx` — page-wide animated aurora + grid
- `components/spotlight-card.tsx` — cursor-following glow card
- `components/marquee.tsx` — CSS infinite ticker
- `components/reveal.tsx` — scroll-in animation
- `components/section-heading.tsx` — `Eyebrow` pill + `PageHeader`
- `.border-beam`, `.glass`, `.text-gradient(-animated)`, `.spotlight` utilities in `globals.css`

## Access model

- **Public:** home, `/tools` (browse the list), `/pricing`, `/about`.
- **Preview only when signed out:** each `/tools/<slug>` page. `ToolShell` renders the tool as an inert, blurred preview with an unlock card, and opens the login/signup popup (`components/auth-modal.tsx`). `app/tools/layout.tsx` passes it the server-verified session.
- **Enforced on the server:** every AI route (`/api/ai/*`), `/api/ip-lookup`, history, workflows, account and billing routes return 401 without a session. Dashboard and settings are also redirected by `src/proxy.ts`.
- Open the popup from anywhere with `openAuthModal({ mode: "login" | "register" })` from `src/lib/auth-modal.ts`.

## Security notes

- **Secrets:** in production the app refuses to sign anyone in if `NEXTAUTH_SECRET` is missing, shorter than 32 characters or still the `.env.example` placeholder (and checks `ENCRYPTION_KEY` the same way when set). Generate both with `openssl rand -base64 32`.
- **AI provider URLs:** a saved base URL is called by the server, so in production it must be a public `https` address (private/loopback/metadata addresses, credentials, query strings and redirects are refused, and the hostname's DNS is checked). A local Ollama therefore only works in development, or on a self-hosted install with `GENIFY_ALLOW_PRIVATE_AI_HOSTS=true`. See `src/lib/ai/url-safety.ts`.
- **Client IP:** set `GENIFY_TRUSTED_IP_HEADER` for your host (e.g. `cf-connecting-ip` on Cloudflare), or the per-IP rate limits can't tell clients apart reliably. See `.env.example`.
- **Daily AI allowance:** a request is taken from the allowance *before* the provider is called, and handed back only when the failure certainly cost nothing (network error, provider 5xx). The agent also caps conversation size (`src/lib/ai/agent-limits.ts`).
- **Plans:** a paid tier only counts while the Stripe subscription is `active` or `trialing` (`src/lib/billing-status.ts`).
- **Sign-in throttling:** attempts are counted before the password is checked, so parallel guesses can't outrun the limit; an address that has signed into an account before is exempt from the per-account cap, so strangers can't lock you out of your usual device.
