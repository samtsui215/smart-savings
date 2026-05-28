# Smart Savings Allocator

One real savings balance. Many virtual buckets. Every dollar accounted for.

The system guarantees one invariant at all times:

```
sum(category.balance for category in user.categories) === user.totalBalance
```

That property is enforced **inside every database transaction that mutates a
balance**. If the invariant would be violated, the transaction rolls back.

---

## System architecture

```
┌──────────────────────────┐        ┌────────────────────────────┐
│  Next.js App Router      │        │  Next.js API Routes        │
│  (React + Tailwind +     │  HTTP  │  (route handlers, Node     │
│   Zustand + Recharts)    │ ─────► │   runtime, JWT cookies)    │
│                          │        │                            │
│  /dashboard, /login, …   │        │  /api/auth/*               │
└──────────────────────────┘        │  /api/categories/*         │
                                    │  /api/transactions/*       │
            ▲                       │  /api/dashboard            │
            │ httpOnly cookie       │  /api/afford               │
            │ (JWT, jose, edge      └──────────────┬─────────────┘
            │  middleware gates                    │
            │  protected routes)                   │ Prisma
                                                   ▼
                                    ┌────────────────────────────┐
                                    │  PostgreSQL                │
                                    │  Users, Categories,        │
                                    │  Transactions (cents)      │
                                    └────────────────────────────┘
```

### Design decisions

| Decision | Why |
|---|---|
| **Integer cents** for all money | JS floats can't represent `0.10` exactly. `1.10 + 2.20 !== 3.30`. Storing dollars-as-floats silently breaks the ledger. |
| **`prisma.$transaction` around every balance mutation** | Deposit/withdraw mutate two rows (category + user); transfer mutates two categories. They must succeed or fail together. |
| **`assertBalanceInvariant` inside each transaction** | A read-back inside the same transaction means if any code path ever forgets to update one side, the transaction rolls back instead of corrupting the ledger silently. |
| **`Unassigned` is a system category** | Every user gets one at signup. It cannot be renamed or deleted. Deposits without a category land here so no dollar is ever lost. Deleting a non-system category sweeps its balance into Unassigned in the same transaction. |
| **JWT in httpOnly cookie + `jose`** | Edge-runtime safe (middleware can verify without `node:crypto`). `httpOnly` keeps the token out of JS, blocking XSS exfiltration; `SameSite=Lax` blocks the common CSRF surface. |
| **Server is the single source of truth** | The Zustand client store is a thin cache over `/api/dashboard`. After any mutation we refetch rather than re-implement balance math on the client — the front-end can't drift from the back-end. |
| **Money serialized as dollar-strings over HTTP** | Avoids float ambiguity on the wire. The API accepts `"12.34"` or `12.34`; internal handling is cents. |

---

## Database schema

```prisma
model User {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  totalBalance Int      @default(0)   // cents
  categories   Category[]
  transactions Transaction[]
}

model Category {
  id           String   @id @default(cuid())
  userId       String
  name         String
  balance      Int      @default(0)   // cents
  targetAmount Int?                   // cents, optional
  isUnassigned Boolean  @default(false)
  @@unique([userId, name])
}

enum TransactionType { DEPOSIT WITHDRAWAL TRANSFER }

model Transaction {
  id              String   @id @default(cuid())
  userId          String
  type            TransactionType
  amount          Int                 // cents, always positive
  note            String?
  categoryId      String?             // for DEPOSIT / WITHDRAWAL
  fromCategoryId  String?             // for TRANSFER
  toCategoryId    String?             // for TRANSFER
  createdAt       DateTime @default(now())
  @@index([userId, createdAt])
}
```

Full schema with relations: `prisma/schema.prisma`.

---

## API endpoints

All routes return JSON. Money fields in responses are dollar-strings; bodies
accept dollar-strings or numbers. Auth uses an httpOnly cookie set on
register/login.

| Method | Path | Body / Query | Notes |
|---|---|---|---|
| POST | `/api/auth/register` | `{ email, password }` | 8+ char password. Sets cookie + creates Unassigned bucket. |
| POST | `/api/auth/login` | `{ email, password }` | Sets cookie. |
| POST | `/api/auth/logout` | — | Clears cookie. |
| GET  | `/api/auth/me` | — | Returns `{ user }` or `{ user: null }`. |
| GET  | `/api/categories` | — | List user's categories. |
| POST | `/api/categories` | `{ name, targetAmount? }` | Creates a bucket. |
| PATCH | `/api/categories/:id` | `{ name?, targetAmount? }` | Cannot rename Unassigned. |
| DELETE | `/api/categories/:id` | — | Sweeps balance into Unassigned. Cannot delete Unassigned. |
| POST | `/api/transactions/deposit` | `{ amount, categoryId?, note? }` | Omit `categoryId` → goes to Unassigned. |
| POST | `/api/transactions/withdraw` | `{ amount, categoryId, note? }` | 409 if bucket can't cover it. |
| POST | `/api/transactions/transfer` | `{ amount, fromCategoryId, toCategoryId, note? }` | totalBalance unchanged. |
| GET  | `/api/transactions` | `?type=&categoryId=&before=&limit=` | Cursor-paginated history. |
| GET  | `/api/dashboard` | — | One-shot payload: totals, categories with goal progress, recent transactions, `consistent` flag. |
| POST | `/api/afford` | `{ amount }` | "Can I afford this?" — suggests which bucket to draw from. |

### Error model

- `400` — validation failure (Zod)
- `401` — not authenticated
- `404` — referenced category not found / not owned by user
- `409` — insufficient funds, or unique-name conflict
- `500` — server bug; invariant violations log `INVARIANT_VIOLATION:` server-side

---

## Folder structure

```
savingsfullstack/
├── prisma/
│   ├── schema.prisma          # DB schema
│   └── seed.ts                # Optional demo user
├── src/
│   ├── middleware.ts          # Edge auth gate (JWT verify)
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── globals.css
│   │   ├── page.tsx           # Landing
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   ├── dashboard/page.tsx # Server: requireSession + redirect
│   │   └── api/
│   │       ├── auth/{register,login,logout,me}/route.ts
│   │       ├── categories/route.ts
│   │       ├── categories/[id]/route.ts
│   │       ├── transactions/route.ts                # list
│   │       ├── transactions/deposit/route.ts
│   │       ├── transactions/withdraw/route.ts
│   │       ├── transactions/transfer/route.ts
│   │       ├── dashboard/route.ts
│   │       └── afford/route.ts
│   ├── components/
│   │   ├── Dashboard.tsx
│   │   ├── CategoryCard.tsx
│   │   ├── CategoryForm.tsx
│   │   ├── TransactionPanel.tsx
│   │   ├── AllocationChart.tsx       # Recharts pie
│   │   ├── AffordCheck.tsx
│   │   └── TransactionHistory.tsx
│   ├── lib/
│   │   ├── prisma.ts          # Singleton client
│   │   ├── auth.ts            # JWT sign/verify + cookie helpers
│   │   ├── money.ts           # dollars<->cents
│   │   ├── invariants.ts      # assertBalanceInvariant
│   │   ├── validation.ts      # Zod request schemas
│   │   ├── api.ts             # Client fetch wrapper
│   │   └── http.ts            # Server error mapping
│   ├── store/useStore.ts      # Zustand dashboard cache
│   └── types/index.ts         # API DTOs
├── .env.example
├── next.config.js
├── package.json
├── postcss.config.js
├── tailwind.config.ts
└── tsconfig.json
```

---

## Setup

### Prerequisites

- Node 18+ (Next.js 14 requires it)
- A running PostgreSQL instance you can write to

### 1. Install dependencies

```bash
npm install
```

This also runs `prisma generate` (via `postinstall`) so the typed client
is ready before you run anything else.

### 2. Configure environment

```bash
cp .env.example .env
# edit .env:
#   DATABASE_URL  → your Postgres
#   JWT_SECRET    → openssl rand -base64 48
```

### 3. Create the database schema

```bash
npm run db:migrate -- --name init
```

(Use `npm run db:deploy` in production.)

### 4. (Optional) Seed a demo user

```bash
npm run db:seed
# logs in with: demo@example.com / demo1234
```

### 5. Run the dev server

```bash
npm run dev
# http://localhost:3000
```

### Useful scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Next.js dev server with HMR |
| `npm run build` | Generates Prisma client, then builds |
| `npm run start` | Runs the built app |
| `npm run db:migrate` | Apply schema changes in dev |
| `npm run db:studio` | Visual DB inspector |
| `npm run db:seed` | Create the demo user |

---

## Where the invariant is enforced

If you only read three files in this repo, read these:

1. **`src/lib/invariants.ts`** — the assertion itself.
2. **`src/app/api/transactions/deposit/route.ts`** — canonical pattern:
   single `prisma.$transaction`, mutate both sides, then call
   `assertBalanceInvariant(tx, userId)` before returning.
3. **`src/app/api/transactions/transfer/route.ts`** — the only mutation
   that leaves `totalBalance` unchanged; the invariant catches mistakes
   on either side of the transfer.

Withdraw and category-delete follow the same pattern.

---

## Extending this

- **Auto-allocation rules** — add a `model AllocationRule { userId, categoryId, percentBps }` and route `/api/transactions/auto-allocate` that splits a deposit across rules in one transaction (sum of percents must equal 10000 bps to keep the invariant).
- **Timeline projections** — given recent deposit velocity per category and a `targetAmount`, project an ETA on the dashboard card. Pure read-side, no schema change needed.
- **Filtered history view** — `/api/transactions` already supports `type` and `categoryId` filters with cursor pagination; the UI just needs a list page.
