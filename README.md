# LendLoop

**Neighbourhood tool-lending board** — Share tools, build community.

LendLoop connects neighbours to share tools they own but rarely use. Borrow a drill for a weekend project, lend out your pressure washer when you're not using it.

## Tech Stack

- **Frontend**: Next.js 16 (App Router) + TypeScript + Tailwind CSS
- **Authentication**: Clerk
- **Backend/Database**: Convex (serverless functions + real-time database)
- **Automation**: n8n (self-hosted via Docker)

## Quick Start

### Prerequisites

- Node.js 20+
- npm 10+
- Docker (for n8n)
- Clerk account (free tier works)
- Convex account (free tier works)

### 1. Clone and Install

```bash
git clone <repo-url>
cd lendloop
npm install
```

### 2. Configure Environment

Copy the example environment file:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your credentials:

```env
# Clerk (https://dashboard.clerk.com)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Convex (https://dashboard.convex.dev)
NEXT_PUBLIC_CONVEX_URL=https://your-project.convex.cloud

# Webhook security (generate: openssl rand -hex 32)
N8N_WEBHOOK_SECRET=your_32_byte_hex_secret
```

### 3. Set Up Convex

```bash
npx convex dev
```

This will:
- Prompt you to log in to Convex
- Create a new project or link to existing
- Deploy your schema and functions
- Watch for changes

### 4. Set Up Clerk

1. Create a Clerk application at https://dashboard.clerk.com
2. Enable Email authentication (or your preferred method)
3. Copy your API keys to `.env.local`
4. Add your Convex deployment URL to Clerk's JWT Templates (optional, for server-side auth)

### 5. Run the App

```bash
npm run dev
```

The app runs at http://localhost:3847

### 6. Set Up n8n (Optional - for automation)

```bash
docker-compose up -d
```

Access n8n at http://localhost:5678 (default: admin/changeme)

Then import the workflows:
1. Open n8n dashboard
2. Go to Workflows → Import
3. Import both files from `n8n-workflows/`
4. Configure environment variables in n8n:
   - `CONVEX_HTTP_URL`: Your Convex HTTP URL (e.g., `https://your-project.convex.site`)
   - `N8N_WEBHOOK_SECRET`: Same value as in `.env.local`

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key | Yes |
| `CLERK_SECRET_KEY` | Clerk secret key | Yes |
| `NEXT_PUBLIC_CONVEX_URL` | Convex deployment URL | Yes |
| `N8N_WEBHOOK_SECRET` | HMAC secret for webhook auth | For automation |

## Project Structure

```
├── convex/               # Convex backend
│   ├── schema.ts         # Database schema
│   ├── auth.ts           # Authorization helpers
│   ├── users.ts          # User management
│   ├── tools.ts          # Tool CRUD operations
│   ├── borrowRequests.ts # Loan request handling
│   ├── automation.ts     # Automation event handling
│   ├── http.ts           # HTTP endpoints for webhooks
│   └── seed.ts           # Demo data seeder
├── src/
│   ├── app/              # Next.js App Router pages
│   │   ├── page.tsx      # Public landing page
│   │   ├── dashboard/    # Authenticated dashboard
│   │   └── providers.tsx # Clerk + Convex providers
│   └── middleware.ts     # Auth middleware
├── n8n-workflows/        # Importable n8n workflow JSON
├── tests/                # Vitest test suite
└── docker-compose.yml    # n8n container config
```

## Architecture

### Data Model

- **users**: Clerk-linked user profiles with role (member/admin) and trusted-lender status
- **tools**: Listings with owner reference, availability, condition
- **borrowRequests**: Loan requests with status state machine
- **automationEvents**: Outbox for webhook delivery
- **remindersSent**: Idempotency tracking for reminders

### Authorization

All authorization is enforced in Convex functions (server-side):
- Members can only CRUD their own tools
- Members can only manage their own requests
- Lenders can approve/decline/return their tool loans
- Admins can view all data and manage users

The frontend never trusts client-provided role or ownership claims.

### Webhook Security

Convex HTTP endpoints use HMAC-SHA256 signatures with timestamp-based replay protection:
- Signature: `HMAC(secret, timestamp + "." + body)`
- Timestamp must be within 5 minutes
- Constant-time comparison prevents timing attacks

### n8n Workflows

1. **Request Notifications**: Polls Convex for pending events, sends notifications (mock logged), marks events processed
2. **Overdue Reminders**: Daily scheduled check for overdue loans, sends reminders, marks loans overdue with idempotent write-back

Both workflows use signed HTTP requests to Convex endpoints.

## Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch
```

Test coverage:
- Authorization logic (owner, role, access control)
- Date validation and overlap detection
- State machine transitions
- Webhook signature verification
- Timestamp/replay protection
- Idempotency for reminders
- Data minimization (public vs authenticated views)
- n8n workflow schema validation

## Development

```bash
# Type check
npx tsc --noEmit

# Lint
npm run lint

# Convex dashboard
npx convex dashboard
```

## What's Not Implemented

This is a demo/take-home project. Missing for production:

- **Real notifications**: Replace mock logging with email/SMS/push
- **Image uploads**: Tool photos
- **Search**: Full-text search
- **Geolocation**: Proximity-based listings
- **Messaging**: In-app chat between users
- **Reviews/ratings**: Trust system
- **Email verification**: Clerk handles this but not enforced
- **Rate limiting**: Convex has built-in limits but custom limits not added
- **Monitoring/alerting**: Add observability
- **Backup/disaster recovery**: Convex handles this
- **Audit logging**: Beyond automation events
- **GDPR compliance**: Data export/deletion
- **Accessibility audit**: Basic a11y included, needs review

## Production Considerations

1. **Secrets rotation**: Plan for N8N_WEBHOOK_SECRET rotation
2. **Convex scaling**: Review function timeouts and memory
3. **n8n reliability**: Consider n8n Cloud or HA self-hosted setup
4. **Error tracking**: Add Sentry or similar
5. **Rate limits**: Add per-user request limits
6. **Data retention**: Implement cleanup for old records
7. **Backup**: Export Convex data regularly

## License

Private — not for redistribution.

---

Built for Fluence take-home assignment. Synthetic demo data only.
