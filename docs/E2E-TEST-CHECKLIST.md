# LendLoop E2E Test Checklist

This document describes the live end-to-end testing requirements for full provider integration.

## Prerequisites

### Required Accounts
- **Clerk**: Development instance (use existing app or create new)
- **Convex**: Project linked to this repository
- **Vercel**: For preview deployments (optional, for live E2E)
- **n8n**: Self-hosted instance (Docker) or n8n Cloud

### Required Environment Variables

```bash
# .env.local or Vercel Environment Variables
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CONVEX_URL=https://your-project.convex.cloud
CONVEX_HTTP_URL=https://your-project.convex.site
N8N_WEBHOOK_SECRET=<32-byte-hex-secret>
```

---

## Vercel Preview Deployment Configuration

For live E2E testing with a Vercel `*.vercel.app` development preview:

### 1. Vercel Environment Variables

Set these in Vercel Dashboard → Project → Settings → Environment Variables:

| Variable | Environment | Value |
|----------|-------------|-------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Preview | `pk_test_...` (development key) |
| `CLERK_SECRET_KEY` | Preview | `sk_test_...` (development key) |
| `NEXT_PUBLIC_CONVEX_URL` | Preview | Your Convex deployment URL |

**Important**: Use Clerk DEVELOPMENT instance keys only for preview deployments.

### 2. Clerk Configuration for Vercel Preview

In Clerk Dashboard → Configure → Paths:

1. **Allowed redirect origins**: Add your Vercel preview URLs
   - `https://your-project.vercel.app`
   - `https://your-project-*.vercel.app` (for PR previews)

2. **Sign-in/Sign-up URLs**: Configure for preview domain
   - Sign-in: `https://your-project.vercel.app/sign-in`
   - Sign-up: `https://your-project.vercel.app/sign-up`

3. **After sign-in/sign-up redirects**:
   - After sign-in: `/dashboard`
   - After sign-up: `/dashboard`

### 3. Convex Configuration

Convex deployment URL should be consistent across environments. The same Convex project can serve both local and Vercel preview.

### 4. Test Data Isolation

For preview E2E testing:
- Use clearly labeled test data (prefix with `[TEST]` or similar)
- Create dedicated test user accounts
- Clean up test data after E2E runs
- Never use production data in development instances

### Clerk Testing Setup

For automated E2E tests with Clerk, use `@clerk/testing`:

```typescript
import { clerkSetup, setupClerkTestingToken } from "@clerk/testing/playwright";

// In test setup
await clerkSetup();

// For isolated sessions
const testToken = await setupClerkTestingToken();
```

**Important**: Only use development/test instance keys. Never use production keys in tests.

---

## Test Categories

### 1. Public Access (No Auth)

| Test | Expected | Mock Status | Live Status |
|------|----------|-------------|-------------|
| View public tool list | Returns tools with name/category only | ✅ Tested | ⬜ Pending |
| No owner info visible | ownerId, description, condition hidden | ✅ Tested | ⬜ Pending |
| Filter by category | Returns filtered results | ✅ Tested | ⬜ Pending |
| Unavailable tools hidden | isAvailable=false not shown | ✅ Tested | ⬜ Pending |

### 2. Authenticated User (Member Role)

| Test | Expected | Mock Status | Live Status |
|------|----------|-------------|-------------|
| Sign in via Clerk | Redirects to dashboard | ⬜ N/A | ⬜ Pending |
| View full tool details | Shows owner, condition, description | ✅ Tested | ⬜ Pending |
| Create own tool | Tool created with user as owner | ✅ Tested | ⬜ Pending |
| Update own tool | Updates succeed | ✅ Tested | ⬜ Pending |
| Delete own tool | Tool removed | ✅ Tested | ⬜ Pending |
| Cannot update other's tool | Throws Forbidden | ✅ Tested | ⬜ Pending |
| Cannot delete other's tool | Throws Forbidden | ✅ Tested | ⬜ Pending |

### 3. Borrow Request Lifecycle

| Test | Expected | Mock Status | Live Status |
|------|----------|-------------|-------------|
| Create borrow request | Request created as pending | ✅ Tested | ⬜ Pending |
| Cannot borrow own tool | Throws error | ✅ Tested | ⬜ Pending |
| Lender approves | Status → approved | ✅ Tested | ⬜ Pending |
| Lender declines | Status → declined | ✅ Tested | ⬜ Pending |
| Borrower cancels | Request deleted | ✅ Tested | ⬜ Pending |
| Lender marks returned | Status → returned | ✅ Tested | ⬜ Pending |
| Borrower cannot approve | Throws Forbidden | ✅ Tested | ⬜ Pending |
| Borrower cannot mark returned | Throws Forbidden | ✅ Tested | ⬜ Pending |
| Date overlap rejected | Cannot approve overlapping dates | ✅ Tested | ⬜ Pending |

### 4. Admin Role

| Test | Expected | Mock Status | Live Status |
|------|----------|-------------|-------------|
| View all users | Returns all users | ✅ Tested | ⬜ Pending |
| View all loans | Returns all loans | ✅ Tested | ⬜ Pending |
| Delete any tool | Succeeds, declines pending requests | ✅ Tested | ⬜ Pending |
| Set trusted lender | Updates user flag | ✅ Tested | ⬜ Pending |
| Member cannot access admin queries | Throws admin error | ✅ Tested | ⬜ Pending |
| Member cannot set trusted lender | Throws admin error | ✅ Tested | ⬜ Pending |

### 5. n8n Webhook Integration

| Test | Expected | Mock Status | Live Status |
|------|----------|-------------|-------------|
| Import request-notifications.json | Successfully imported | ✅ Verified | ⬜ Pending |
| Import overdue-reminders.json | Successfully imported | ✅ Verified | ⬜ Pending |
| Signed GET request | Returns overdue loans | ⬜ N/A | ⬜ Pending |
| Signed POST request | Marks loan overdue | ⬜ N/A | ⬜ Pending |
| Invalid signature rejected | Returns 401 | ✅ Tested | ⬜ Pending |
| Expired timestamp rejected | Returns 401 | ✅ Tested | ⬜ Pending |
| Reminder idempotency | Same reminder not duplicated | ✅ Tested | ⬜ Pending |
| Event retry on failure | Attempts incremented | ✅ Tested | ⬜ Pending |
| Max retries reached | Status → failed | ✅ Tested | ⬜ Pending |

### 6. Visual/UI Tests

| Test | Expected | Mock Status | Live Status |
|------|----------|-------------|-------------|
| Public landing page | Shows tools, sign-in button | ⬜ N/A | ⬜ Pending |
| Dashboard layout | Tabbed navigation | ⬜ N/A | ⬜ Pending |
| My Listings view | Shows user's tools | ⬜ N/A | ⬜ Pending |
| My Requests view | Shows user's requests | ⬜ N/A | ⬜ Pending |
| Incoming Requests view | Shows requests for user's tools | ⬜ N/A | ⬜ Pending |
| Admin view | Shows all users and loans | ⬜ N/A | ⬜ Pending |
| Mobile responsive | Layout adapts | ⬜ N/A | ⬜ Pending |

---

## Running Tests

### Mock Tests (No External Services)

```bash
# Run all mock tests (181 tests)
npm test

# Run handler auth tests only
npm test -- tests/handler-auth.test.ts
```

### E2E Tests (Requires Configuration)

```bash
# Check configuration status
npm run test:e2e

# Tests will skip if config is missing
```

### Manual E2E Checklist

When running full E2E manually:

1. **Start services**
   ```bash
   npm run dev          # Next.js
   npx convex dev       # Convex
   docker-compose up -d # n8n
   ```

2. **Create test users in Clerk**
   - Regular member user
   - Admin user (manually set role in Convex)
   - Second member for cross-user tests

3. **Run through checklist**
   - [ ] Public view shows minimal data
   - [ ] Sign in works
   - [ ] Tool CRUD works for owner
   - [ ] Tool CRUD blocked for non-owner
   - [ ] Borrow flow works
   - [ ] Admin functions work
   - [ ] n8n workflows execute
   - [ ] Take screenshots for documentation

---

## Test Data

### Seed Data

Use `convex/seed.ts` to populate demo data:

```bash
npx convex run seed:seedDemoData
```

### Cleanup

```bash
npx convex run seed:clearAllData
```

---

## CI/CD Integration

For CI environments, set secrets:

| Secret Name | Source |
|-------------|--------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk Dashboard → API Keys |
| `CLERK_SECRET_KEY` | Clerk Dashboard → API Keys |
| `NEXT_PUBLIC_CONVEX_URL` | Convex Dashboard → Settings |
| `CONVEX_HTTP_URL` | Convex Dashboard → Settings |
| `N8N_WEBHOOK_SECRET` | Generate with `openssl rand -hex 32` |

---

## Distinguishing Mock vs Live Tests

| Category | What It Tests | Provider Required |
|----------|---------------|-------------------|
| **handler-auth.test.ts** | Actual handlers with mock DB | None |
| **convex-schema-db.test.ts** | Schema and indexes | None |
| **webhook-security.test.ts** | HMAC logic | None |
| **live-e2e.test.ts** | Full provider integration | All services |
| **Manual E2E** | UI + visual verification | All services |

Mock tests validate the **logic and authorization** but not:
- Network connectivity
- Provider-specific behavior
- UI rendering
- Real authentication flows
