# HCM Lite — AI-assisted Human Capital Management

**Live app:** https://hcm-lite-phi.vercel.app — opens at first-run setup (create the company and the Admin account there).

Saylani Hackathon (24 Oct 2026) submission. A web app for **Admin, HR and Employees** covering all 9 modules and 25 functionalities of the brief: auth & roles, organization setup, employees (with CSV import/export), attendance (web + optional camera/GPS), leave with approvals, payroll with PDF payslips, three dashboards, an AI assistant with permission-checked tools, and announcements / notifications / an append-only audit log.

**The system starts empty.** There is no seed or demo data: the first visit opens a setup wizard, the Admin configures the company, HR registers employees, and every number on every dashboard comes from what people do in the app.

---

## Stack

| Layer | Choice |
|---|---|
| App | Next.js 15 (App Router), React 19, TypeScript (strict) |
| UI | Tailwind CSS v4, Radix primitives (dialog, menu), Lucide icons, Recharts |
| Data | PostgreSQL + Prisma 6 (migrations, FK restrictions, unique + CHECK constraints) |
| Auth | bcrypt password hashes, HS256 JWT in an HTTP-only `SameSite=Lax` cookie, DB re-check on every request |
| Validation | Zod on every request body / query |
| AI | Provider adapter: Anthropic (official SDK) or any OpenAI-compatible API (Groq, Gemini, OpenRouter, OpenAI) — tool calling |
| PDF | pdf-lib (pure JS, works on serverless) |
| Tests | Vitest (unit + integration against a real Postgres), Playwright (end-to-end demo flow) |

## Run it locally (≈ 5 minutes)

Requirements: **Node 20.9+** and **PostgreSQL 14+** (local, Docker, or a free hosted DB such as Neon/Supabase).

```bash
npm install
cp .env.example .env          # then edit DATABASE_URL and JWT_SECRET
npm run db:migrate            # creates the empty schema
npm run dev                   # http://localhost:3000
```

Open the app → you land on **First-run setup** → enter the company name and the Admin email/password → you are signed in as Admin.

Production build: `npm run build && npm start`.

### Environment variables (`.env.example`)

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `JWT_SECRET` | yes | ≥ 32 random characters (`node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`) |
| `SESSION_TTL_HOURS` | no | Session lifetime, default 8 |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | no | If both are set, the setup wizard only asks for the company name and creates this Admin |
| `AI_PROVIDER` | no | `openai` (OpenAI-compatible) or `anthropic` |
| `AI_API_KEY` | no | Server-side only. Without it the app still works (see below) |
| `AI_BASE_URL` | no | For OpenAI-compatible providers, e.g. `https://api.groq.com/openai/v1` |
| `AI_MODEL` | no | e.g. `llama-3.3-70b-versatile` (Groq), `gemini-2.5-flash` (Gemini), `claude-opus-5-5` (Anthropic) |
| `AI_RATE_LIMIT_PER_HOUR` | no | Default 20 requests per user per hour |

### Creating the first Admin

1. **Wizard (default):** first visit → `/setup` → company name + Admin email/password.
2. **From env:** set `ADMIN_EMAIL` and `ADMIN_PASSWORD`; the wizard then only asks for the company name.

Setup is only possible while no company exists. After that `/api/setup` returns **409**, so nobody can create another Admin publicly.

### Setting the AI key

The browser never talks to the AI provider; the key stays in the server environment.

* **Groq (free tier):** `AI_PROVIDER=openai`, `AI_BASE_URL=https://api.groq.com/openai/v1`, `AI_MODEL=llama-3.3-70b-versatile`, `AI_API_KEY=gsk_…`
* **Google Gemini (free tier):** `AI_PROVIDER=openai`, `AI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai`, `AI_MODEL=gemini-2.5-flash`, `AI_API_KEY=…`
* **Anthropic Claude:** `AI_PROVIDER=anthropic`, `AI_MODEL=claude-opus-5-5`, `AI_API_KEY=sk-ant-…` (uses the official SDK, low effort for chat latency, and the server-side `fallbacks: "default"` refusal fallback)

**No key?** The chat, smart leave and dashboard summary keep working through a built-in, rule-based assistant that calls the same permission-checked tools. Its answers are labelled **"Built-in assistant"**, never "AI-generated".

## Deploying (free hosting)

**Vercel + Neon** (recommended):

1. Create a Neon (or Supabase) Postgres database and copy its connection string.
2. Import the Git repository into Vercel. Vercel runs the `vercel-build` script automatically (`prisma generate && prisma migrate deploy && next build`), so migrations apply on every deploy.
3. In Vercel → Settings → Environment Variables, set `DATABASE_URL`, `JWT_SECRET` and optionally the `AI_*` variables. **Never commit `.env`.**
4. Open the deployment URL: it starts at first-run setup.

Any Node host works the same way: `npm ci && npm run db:migrate && npm run build && npm start`.

## 5-minute demo script (matches the brief)

1. **Admin** completes setup → *Organization*: set office hours / location, add a department and designation, review leave types → *User accounts* → **Create HR login** (temporary password shown once).
2. **HR** signs in, sets a new password → *Employees* → **Register employee** (×2–3). Each one gets a login with a temporary password.
3. **Employee** signs in, changes the password, clicks **Check in** on the dashboard.
4. Employee → *Leave* → types *"I need next Monday and Tuesday off for my sister's wedding"* → **Fill the form** → reviews the pre-filled casual leave → **Confirm & submit**.
5. **HR** → *Leave → Approval inbox* → **Approve** with a comment. The dashboard shows present/late/pending numbers from the records; **Summarize** produces AI insights; the assistant answers *"Who is on leave today?"*. Then *Payroll* → **Prepare draft**.
6. **Admin** → *Payroll* → open the month → **Finalize payroll** (locks it and publishes the payslips).
7. **Employee** → *My payslips* → **PDF**. In the *AI assistant*, *"What is Sara's salary?"* → polite refusal.
8. **Admin** → *Audit log*.

## Roles and access (server-enforced)

The permission matrix lives in [`src/domain/permissions.ts`](src/domain/permissions.ts) and follows the brief's checklist row by row. Every route handler and server page calls the same services, and each service checks the permission and the data scope again.

| | Admin | HR | Employee |
|---|---|---|---|
| Company settings, departments, leave types, holidays | manage | view | — |
| Create HR logins, deactivate / reset any login | ✓ | — | — |
| Register / edit employees, salary structures, CSV import/export | view | manage | own phone & address |
| Check in / out, apply for leave, request corrections | — | own | own |
| Approve leave and corrections | view | ✓ (not own) | — |
| Payroll draft | view | prepare / recalculate | — |
| Finalize payroll | ✓ | — | — |
| Payslips | all | all | own, finalized only |
| Dashboards | company | HR | personal |
| AI | all data | HR data | own data + policy |
| Audit log | view | — | — |

Points worth knowing:

* **HR are employees too.** Rows 09 and 12 of the checklist give HR their own check-in and leave, so an HR login comes with an employee profile. HR cannot approve their own leave or corrections, and cannot change their own salary or employment record.
* **Admin has no employee profile**, so there is no check-in for Admin (row 09 marks it "—").
* An employee who changes an ID in a URL or API call gets **403** (verified by the integration tests). The directory never returns password hashes or temporary passwords.
* Deactivating a user or resetting their password bumps a token version, which **revokes open sessions immediately**.
* Mutating requests from a foreign `Origin` are rejected, on top of the `SameSite=Lax` cookie.

## Business rules and how they are implemented

| Rule (brief) | Implementation |
|---|---|
| Office 09:00, grace 15 min, half day < 5 h, weekend Sat–Sun, office radius | `company` row; editable by Admin. Each attendance record stores a **rules snapshot**, so settings changes apply to **new records only**. |
| Server stamps time; one record per day; second check-in = 409 | `@@unique([employeeId, date])` + 409 on the unique violation. The client never sends a time. |
| Late after 09:15; half day; missing checkout; absent | `src/domain/attendance-rules.ts` + `src/domain/metrics.ts`. Strictly after start + grace is late (09:15:00 is on time). A half day keeps its `isLate` flag for late counts. Open records from previous days become `MISSING_CHECKOUT`. Absent days are derived, not stored. |
| Corrections need a reason; HR approves with comment + audit | `attendance_corrections`; approval upserts the record (`source = CORRECTION`) and writes before/after JSON to the audit log. |
| Leave in working days, overlap / over-balance = 422 | `src/domain/leave-rules.ts`. Weekends and holidays are skipped. Overlap with pending/approved leave → 422 `OVERLAP`. Over balance → 422 `INSUFFICIENT_BALANCE`. |
| Quotas 14 / 8 / 10 / unpaid unlimited | Created at setup; editable. A balance row copies the quota when first used for a year. |
| Pending doesn't reduce balance; approval does; no double approvals | `remaining = entitled − approved`. New requests are checked against `remaining − pending`. Approval is an atomic `PENDING → APPROVED` transition plus a **conditional `UPDATE … WHERE used + days <= entitled`**, backed by a DB `CHECK (used <= entitled)`. Concurrent approvals are covered by a test. |
| Payroll formulas, proration, tax slabs | `src/domain/payroll.ts` (unit-tested slab by slab). |
| Only Admin finalizes; finalized runs are locked | Conditional `DRAFT → FINALIZED` update in one transaction with audit and notifications. A second finalize → **409**. Recalculate / PUT / PATCH / DELETE on a finalized run → **423 Locked**. |
| Audit log append-only | No update/delete endpoints, and a **Postgres trigger rejects UPDATE/DELETE** on `audit_logs`. |

### Interpretation choices (documented, not invented rules)

* **Company timezone** (default `Asia/Karachi`) defines "today", late marks and smart-leave dates.
* **Go-live date.** Absences are counted from the day the company was set up in HCM Lite. Without this, an employee registered with an earlier joining date would show every earlier working day as absent and lose that pay.
* **Today is not over.** A working day with no check-in only becomes *absent* the next day; until then the board shows *Not checked in*.
* **Weekend / holiday check-ins** are allowed (people do work weekends). They count as attended days but never as expected days, so they can't create absences.
* **Leave cannot span two calendar years** (balances are per year), can be backdated by at most 30 days, and approved leave can be cancelled only before it starts (the days return to the balance).
* **Salary changes:** payroll uses the latest salary structure effective on or before the month end (no mid-month split).
* **Payroll for the current month** counts absences only for days that have passed; recalculate the draft at month end.

### Payroll details and rounding

* Gross = basic + HRA (40%) + medical (10%) = 1.5 × basic. Per-day = gross ÷ working days in the month (weekends and holidays excluded).
* Proration: `employed working days ÷ working days` for joiners and leavers.
* Deduction = per-day × (absent + unpaid leave + 0.5 × half days [+ 0.5 per 3 lates if the optional late-penalty rule is enabled]), capped at the prorated gross.
* Tax = slab on (gross × 12) ÷ 12, prorated for partial months; never more than the earned amount.
* **All money is stored as integer paisa.** Each derived amount is rounded to the nearest paisa once, where it is computed (half away from zero). Fractional day counts are carried as half-day units, so nothing drifts.
* These are the brief's illustrative formulas, not a statement of legal tax compliance.

## Dashboards and metric definitions

All figures are computed on the server from database records and respect the **date-range and department filters**. AI answers and AI summaries use the **same service functions**, so they always match the dashboards.

| Metric | Definition |
|---|---|
| Headcount | Employees employed (joined ≤ date ≤ exit) on the period end date — i.e. active + probation |
| Attrition | exits in period ÷ ((headcount at start + headcount at end) ÷ 2) × 100 |
| Attendance rate | (present + late + missing_checkout + 0.5 × half_day) ÷ (working-day records − on_leave) |
| Late % | late ÷ (present + late) |
| Absenteeism | absent days ÷ expected working days, per department |
| Leave utilization | approved days this year ÷ (quota × headcount in scope), per leave type |
| Payroll cost | sum of earned gross and net by month and department (latest finalized run, else latest draft — labelled) |
| Average salary | mean monthly gross (1.5 × basic) of current employees, by department and designation |

**Zero denominators** return `null`, shown as "—" (never 0% or 100%). Before data exists, dashboards show zero-valued KPIs and empty states, never placeholder numbers. Every chart has a **table view** toggle.

## AI assistant

* `POST /api/ai/chat` → the server builds a system prompt (role, scope, the company's live rules from Section 3) → the model picks among 7 tools: `get_headcount`, `get_attendance_summary`, `get_late_comers`, `get_leave_summary`, `get_my_leave_balance`, `get_payroll_summary`, `search_employees`. The server executes each tool **as the signed-in user** and returns the answer labelled **AI-generated**.
* Tools call the same services as the REST API. Employees get only their own data: company aggregates return `FORBIDDEN`, and the payroll tool returns only the caller's own payslips. A deterministic guard also refuses colleague-salary questions before the model is even called.
* **Dashboard summary:** sends exactly the KPI JSON of the current filters and asks for 3–5 bullets, validated with Zod (retried once). Empty data gets a clear "not enough data" message.
* **Smart leave:** the model must return `{type, start, end, reason}`. It is Zod-validated and checked against the allowed leave types and past dates; on failure it retries once, then falls back to the built-in parser, then to the empty form. **Nothing is submitted automatically** — the employee confirms the pre-filled form.
* **Policy Q&A:** answered only from the policy text generated from the company's settings; otherwise "I don't know".
* **Guardrails:** 15 s timeout (no SDK retries), ~20 requests per user per hour (429), and every call logged in `ai_logs` (feature, tools, status, latency, input length — **no prompt text**). Prompt-injection rules are in the system prompt, and the model never sees the database.
* Bonus: understands **Roman Urdu** (system prompt + built-in parser handles *kal*, *parson*, *bukhar*, weekday names…).

## Optional / bonus features

* **Camera attendance (web):** the browser counts faces with MediaPipe (loaded from a CDN) and reads GPS. The server re-checks: exactly one face, accuracy ≤ 100 m (configurable), Haversine distance ≤ radius, plus normal attendance rules. No photo is uploaded or stored; users see what is collected before the camera starts. A failed check falls back to a normal check-in or an HR correction.
* **Late penalty rule** (3 lates = 0.5 day), off by default.
* **Dark mode** (account menu) with its own validated chart palette, and a web app manifest (no service worker / offline mode).

## Tests

```bash
npm run typecheck
npm run lint
npm test          # unit + integration (needs Postgres; uses a separate test DB)
npm run test:e2e  # Playwright: builds must exist (npm run build) and uses a separate *_e2e DB
```

* **Unit** (`tests/unit`): late / half-day / missing-checkout classification, timezone boundaries, geofence, working days, overlap and balance rules, every tax slab, proration and rounding, metric formulas and zero denominators, the permission matrix, smart-leave JSON validation, CSV validation.
* **Integration** (`tests/integration`, real Postgres via `TEST_DATABASE_URL`, default `postgresql://postgres@localhost:5432/hcm_lite_test`): first-run lockout, employee data isolation by ID tampering, HR/Admin boundaries, duplicate check-in 409, the correction workflow, **concurrent approvals cannot overspend**, payroll finalize/lock (409/423), DB-enforced append-only audit, AI tool scoping, chat orchestration with a mocked provider, the rate limit, smart-leave retry/fallback, and summaries built from KPIs only.
* **End-to-end** (`tests/e2e/demo-flow.spec.ts`, `E2E_DATABASE_URL`, default `…/hcm_lite_e2e`): the whole demo script through the UI — setup → HR login → register employees → password change → check-in → smart leave → approval → dashboard + summary → payroll draft → Admin finalize → payslip download → salary refusal → audit log.

The test databases must exist (e.g. `createdb hcm_lite_test`, `createdb hcm_lite_e2e`). Test helpers refuse to wipe a database whose name doesn't contain `test` / end with `_e2e`.

## Project structure

```
prisma/                 schema + migrations (incl. audit trigger and CHECK constraints)
src/domain/             pure business rules (no I/O) — fully unit-tested
src/server/
  auth/                 bcrypt, JWT, session (DB re-check, token versioning)
  services/             one module per feature; every function takes the actor and enforces permission + scope
  ai/                   provider adapter, tools, prompts/policy, fallback assistant, chat/summary/smart-leave
  http.ts               route wrapper: auth, permission, origin check, consistent error JSON
src/app/api/            thin REST route handlers → services
src/app/(app)/          role-aware pages (server components → services; client islands for actions)
src/components/         design system (cards, KPI, tables, badges, dialogs, toasts, charts, chat…)
tests/                  unit, integration, e2e
```

Errors use one JSON shape: `{ "error": { "code", "message", "details?" } }` with 400 / 401 / 403 / 404 / 409 / 422 / 423 / 429.

## What is done / not done

**Done:** all 25 functionalities in the checklist; three role dashboards with filters; the AI chat with 7 scoped tools, summaries, smart leave and policy Q&A; camera + GPS attendance on the web (bonus); late-penalty rule (bonus); Roman Urdu (bonus); dark mode (bonus); tests at all three levels.

**Not done / limitations:**

* No native mobile app (the web app is responsive down to 375 px and camera check-in works in mobile browsers).
* Face detection runs in the browser, so a modified client could lie about the face count. The server independently verifies location accuracy, distance and time, but not the image. Face matching / liveness (extra bonus) is not implemented.
* No email delivery: temporary passwords are shown once to the Admin/HR who created the account.
* The login brute-force throttle (10 failures / 15 min per email) is in-memory per server instance; the AI rate limit is DB-backed.
* Attrition-risk score and absence-anomaly flags (bonus ideas) are not implemented.
* Salary changes within a month are not split; the structure effective at month end applies.
