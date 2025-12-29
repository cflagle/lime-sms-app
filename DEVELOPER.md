# Lime SMS App — Developer Documentation

> **Version:** 1.0  
> **Last Updated:** December 2025  
> **Stack:** Next.js 16, Prisma ORM, SQLite/PostgreSQL, Lime Cellular API

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Tech Stack](#tech-stack)
4. [Getting Started](#getting-started)
5. [Project Structure](#project-structure)
6. [Database Schema](#database-schema)
7. [Core Features](#core-features)
8. [API Reference](#api-reference)
9. [Configuration Options](#configuration-options)
10. [Background Worker](#background-worker)
11. [Compliance & Safety Rules](#compliance--safety-rules)
12. [Deployment](#deployment)
13. [Troubleshooting](#troubleshooting)

---

## Overview

Lime SMS App is an **automated SMS advertising platform** that integrates with [Lime Cellular](https://mcpn.us) to manage subscriber lists and send promotional text messages. The system supports two brands:

- **WSWD** (Wall Street Watchdogs)
- **TA** (Trader's Alley)

### Key Capabilities

- Sync subscribers from Lime Cellular opt-in lists
- Create and manage a pool of promotional messages
- Automatically send messages based on configurable schedules
- Track clicks, purchases, and revenue with full attribution
- Enforce comprehensive compliance rules (time windows, frequency caps, engagement windows)
- Create shortened tracking links via Lime API

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         NEXT.JS APP                              │
├─────────────────────────────────────────────────────────────────┤
│  PAGES (App Router)                                              │
│  ├── /              Dashboard - stats & recent activity          │
│  ├── /messages      Message pool management (CRUD)               │
│  ├── /subscribers   View opted-in subscriber list                │
│  ├── /logs          Message delivery history                     │
│  └── /settings      Configuration & safety controls              │
├─────────────────────────────────────────────────────────────────┤
│  API ROUTES                                                      │
│  ├── /api/cron              Trigger sync + queue processing      │
│  ├── /api/send-direct       Send message to specific number      │
│  ├── /api/shorten           Create Lime tracking links           │
│  └── /api/webhooks/                                              │
│       ├── analytics         Receive click/purchase events        │
│       └── subscribe         Add subscribers directly             │
├─────────────────────────────────────────────────────────────────┤
│  CORE SERVICES (lib/)                                            │
│  ├── sms-service.ts         Sync, eligibility, selection, send   │
│  ├── lime-client.ts         Lime Cellular API wrapper            │
│  ├── config-service.ts      App configuration CRUD               │
│  ├── area-codes.ts          US/CA area code → timezone map       │
│  └── prisma.ts              Database client singleton            │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      BACKGROUND WORKER                           │
│  scripts/worker.ts                                               │
│  ├── Every 15 min: Sync subscribers from Lime                   │
│  └── Every 1 min:  Process send queue                           │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    EXTERNAL SERVICES                             │
│  ├── Lime Cellular API (https://mcpn.us)                        │
│  │    ├── sendsmsapi        Send one-way SMS                    │
│  │    ├── limeApi           Get opted-in numbers, check status  │
│  │    └── apiTrackingLink   Create shortened tracking links     │
│  └── PostgreSQL / SQLite                                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Database | SQLite (dev) / PostgreSQL (prod) via Prisma ORM |
| Styling | Tailwind CSS 4 |
| HTTP Client | Axios |
| Date/Time | Day.js with timezone plugin |
| Phone Parsing | libphonenumber-js |
| Scheduling | node-cron |
| Runtime | Node.js 20+ |

---

## Getting Started

### Prerequisites

- Node.js 20+
- npm or yarn
- Lime Cellular API credentials

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd lime-sms-app

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your credentials

# Initialize database
npx prisma migrate dev

# Seed database (optional)
npx prisma db seed

# Start development server
npm run dev

# In a separate terminal, start the background worker
npm run worker
```

### Environment Variables

Create a `.env` file with:

```env
# Database
DATABASE_URL="file:./dev.db"                    # SQLite for dev
# DATABASE_URL="postgresql://user:pass@host:5432/db"  # PostgreSQL for prod

# Lime Cellular API
LIME_USER="your_username"
LIME_API_ID="your_api_id"
LIME_DOMAIN="sms1.px1.co"                       # Your custom short domain

# Security (optional)
CRON_SECRET="your_secret_for_cron_endpoint"
```

---

## Project Structure

```
lime-sms-app/
├── app/                          # Next.js App Router
│   ├── api/                      # API routes
│   │   ├── cron/route.ts         # Sync + queue processing trigger
│   │   ├── send-direct/route.ts  # Direct message sending
│   │   ├── shorten/route.ts      # Link shortening
│   │   └── webhooks/
│   │       ├── analytics/route.ts   # Click/purchase tracking
│   │       └── subscribe/route.ts   # Direct subscriber registration
│   ├── logs/page.tsx             # Delivery logs page
│   ├── messages/                 # Message management
│   │   ├── page.tsx
│   │   ├── actions.ts            # Server actions for CRUD
│   │   ├── CreateMessageForm.tsx
│   │   └── MessageItem.tsx
│   ├── settings/                 # App configuration
│   │   ├── page.tsx
│   │   ├── actions.ts
│   │   └── TimeScheduler.tsx
│   ├── subscribers/page.tsx      # Subscriber list
│   ├── layout.tsx                # Root layout with sidebar
│   ├── page.tsx                  # Dashboard
│   └── globals.css
├── components/
│   └── AppSidebar.tsx            # Navigation sidebar
├── lib/                          # Core business logic
│   ├── sms-service.ts            # Main SMS orchestration
│   ├── lime-client.ts            # Lime API wrapper
│   ├── config-service.ts         # Configuration management
│   ├── area-codes.ts             # Area code → timezone mapping
│   └── prisma.ts                 # Database client
├── prisma/
│   ├── schema.prisma             # Database schema
│   └── migrations/               # Migration history
├── scripts/
│   └── worker.ts                 # Background job runner
├── public/                       # Static assets
└── package.json
```

---

## Database Schema

### Models

#### Subscriber
Represents an opted-in user who can receive SMS messages.

| Field | Type | Description |
|-------|------|-------------|
| `id` | Int | Primary key |
| `phone` | String | Unique phone number |
| `name` | String? | Subscriber name |
| `email` | String? | Email for attribution matching |
| `subscribe_wswd` | Boolean | Subscribed to Wall Street Watchdogs |
| `subscribe_ta` | Boolean | Subscribed to Trader's Alley |
| `status` | String | `ACTIVE` or `OPTOUT` |
| `last_engagement` | DateTime? | Last click/purchase date |
| `timezone` | String? | e.g., "America/New_York" |
| `hasClicked` | Boolean | True if subscriber has ever clicked a link |
| `hasPurchased` | Boolean | True if subscriber has ever purchased |
| `firstClickAt` | DateTime? | Timestamp of first click |
| `firstPurchaseAt` | DateTime? | Timestamp of first purchase |
| `totalClicks` | Int | Cumulative click count |
| `totalPurchases` | Int | Cumulative purchase count |
| `totalRevenue` | Float | Cumulative purchase revenue |
| `createdAt` | DateTime | When subscriber was added |
| `updatedAt` | DateTime | Last update timestamp |

#### Message
A promotional message that can be sent to subscribers.

| Field | Type | Description |
|-------|------|-------------|
| `id` | Int | Primary key |
| `name` | String | **Required, unique, immutable.** Internal name used for tracking attribution |
| `content` | String | SMS body text |
| `brand` | String | `WSWD` or `TA` |
| `active` | Boolean | Whether message is in rotation |
| `cooldownDays` | Int | Days before re-sending to same user (default: 14) |
| `campaignId` | Int? | Optional campaign grouping |

#### Campaign
Groups messages with shared weekly impression limits.

| Field | Type | Description |
|-------|------|-------------|
| `id` | Int | Primary key |
| `name` | String | Campaign name |
| `maxImpressionsPerWeek` | Int | Max sends per user per week (default: 2) |

#### SentLog
Record of every message sent.

| Field | Type | Description |
|-------|------|-------------|
| `id` | Int | Primary key |
| `subscriberId` | Int | FK to Subscriber |
| `messageId` | Int | FK to Message |
| `brand` | String | Brand that sent the message |
| `sentAt` | DateTime | Timestamp |

#### TrackingEvent
Captures clicks, purchases, and other conversion events.

| Field | Type | Description |
|-------|------|-------------|
| `id` | Int | Primary key |
| `eventType` | String | `CLICK`, `PURCHASE`, etc. |
| `publisher` | String? | Attribution: publisher |
| `offer` | String? | Attribution: offer |
| `trafficSource` | String? | Attribution: traffic source |
| `landingPage` | String? | Attribution: landing page URL |
| `trafficSourceAccount` | String? | Attribution: account |
| `utmSource` | String? | UTM parameter |
| `utmMedium` | String? | UTM parameter |
| `utmTerm` | String? | UTM parameter |
| `utmContent` | String? | UTM parameter |
| `utmCampaign` | String? | UTM parameter |
| `keyword` | String? | `t202kw` value (message name) |
| `gclid` | String? | Google Click ID |
| `email` | String? | User email if provided |
| `revenue` | Float? | Purchase amount |
| `subscriberId` | Int? | FK to Subscriber (if matched) |
| `messageId` | Int? | FK to Message (resolved from `keyword` → `Message.name`) |
| `createdAt` | DateTime | Event timestamp |

#### AppConfig
Singleton table for application settings.

| Field | Type | Description |
|-------|------|-------------|
| `id` | Int | Always 1 (singleton) |
| `sendingEnabled` | Boolean | Master on/off switch |
| `testMode` | Boolean | Only send to whitelist |
| `testNumbers` | String | Comma-separated test numbers |
| `batchSize` | Int | Messages per batch (unused currently) |
| `dailyLimitPerUser` | Int | Max messages per user per day |
| `minIntervalMinutes` | Int | Minimum gap between messages |
| `engagementWindowEnabled` | Boolean | Enforce engagement window |
| `engagementWindowDays` | Int | Days of inactivity before suppression |
| `sendTimes` | String | Comma-separated schedule times (e.g., "09:00,14:00") |

---

## Core Features

### 1. Subscriber Synchronization

**Location:** `lib/sms-service.ts` → `syncSubscribers()`

Fetches opted-in subscribers from Lime Cellular list ID `135859` and upserts them into the database.

**Keyword-based brand assignment:**
- Keyword contains "STOCK" → `subscribe_wswd = true`
- Keyword contains "TRADE" → `subscribe_ta = true`
- Neither → Both enabled as fallback

**Timezone derivation:**
- Parses phone number using libphonenumber-js
- Extracts area code (first 3 digits of national number)
- Looks up timezone in `lib/area-codes.ts` mapping
- Defaults to `America/New_York`

### 2. Queue Processing

**Location:** `lib/sms-service.ts` → `processQueue()`

Runs every minute (via worker) to:

1. Check if sending is enabled globally
2. Get all active subscribers
3. Filter to test numbers only (if test mode)
4. For each subscriber:
   - Check eligibility via `isEligibleToReceive()`
   - Select an appropriate message via `selectMessageFor()`
   - Send the message via `sendMessage()`

### 3. Eligibility Checking

**Location:** `lib/sms-service.ts` → `isEligibleToReceive()`

A subscriber is eligible if ALL conditions pass:

| Rule | Logic |
|------|-------|
| **Time Window** | 8am ≤ local hour < 8pm |
| **Daily Cap** | Messages sent today < `dailyLimitPerUser` |
| **Min Interval** | Minutes since last send ≥ `minIntervalMinutes` |
| **Schedule Match** | Current time within ±3 min of a scheduled slot |
| **Slot Not Used** | Haven't sent for this slot today |
| **Engagement Window** | Days since last engagement ≤ `engagementWindowDays` |

### 4. Message Selection

**Location:** `lib/sms-service.ts` → `selectMessageFor()`

1. Determine allowed brands based on subscriber preferences
2. Fetch all active messages for those brands
3. **Shuffle randomly** for fair rotation
4. For each message (in random order):
   - Skip if subscriber saw this message within cooldown period
   - Skip if campaign weekly cap exceeded
   - Return first eligible message

### 5. Message Sending

**Location:** `lib/sms-service.ts` → `sendMessage()`

1. **Safety check:** Verify opt-in status with Lime API before sending
2. If not opted in → Mark subscriber as `OPTOUT` and abort
3. Call `LimeClient.sendSMS()` to send
4. Log to `SentLog` table

### 6. Link Shortening

When creating a message with a URL:

1. User enters the long URL and message name
2. Frontend appends `?t202kw={messageName}` to the URL
3. Calls `/api/shorten` which calls `LimeClient.createTrackingLink()`
4. Returns shortened URL (e.g., `https://sms1.px1.co/abc123`)
5. Shortened URL is inserted into message content

---

## API Reference

### POST `/api/send-direct`

Send a message to a specific phone number immediately.

**Request:**
```json
{
  "phone": "1234567890",
  "messageId": 5
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `phone` | string | Yes | Phone number to send to |
| `messageId` | number | No | Specific message ID (random if omitted) |

**Response:**
```json
{
  "success": true,
  "messageId": 5
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Compliance Block: Message suppressed by safety rules..."
}
```

**Notes:**
- Respects all compliance rules
- Master switch must be enabled
- Subscriber must exist and be ACTIVE

---

### POST `/api/webhooks/analytics`

Receive click/purchase events for tracking and attribution.

**Request:**
```json
{
  "event": "click",
  "email": "user@example.com",
  "phone": "1234567890",
  "publisher": "affiliate123",
  "offer": "stock-picks",
  "traffic_source": "sms",
  "landing_page": "https://example.com/promo",
  "traffic_source_account": "acct1",
  "utm_source": "lime",
  "utm_medium": "sms",
  "utm_term": "alert",
  "utm_content": "v1",
  "utm_campaign": "december",
  "t202kw": "Promo123",
  "gclid": "abc123",
  "revenue": 99.99
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `event` | string | No | Event type (defaults to "UNKNOWN") |
| `email` | string | No | For subscriber matching |
| `phone` | string | No | For subscriber matching |
| `publisher` | string | No | Attribution |
| `offer` | string | No | Attribution |
| `traffic_source` | string | No | Attribution |
| `landing_page` | string | No | Attribution |
| `traffic_source_account` | string | No | Attribution |
| `utm_*` | string | No | UTM parameters |
| `t202kw` | string | No | Message name (keyword tracking) |
| `gclid` | string | No | Google Click ID |
| `revenue` | number | No | Purchase amount |

**Response:**
```json
{
  "success": true,
  "matched": true
}
```

**Notes:**
- If event is `CLICK` → sets `hasClicked = true`, increments `totalClicks`, sets `firstClickAt` if null
- If event is `PURCHASE` → sets `hasPurchased = true`, increments `totalPurchases`, adds to `totalRevenue`, sets `firstPurchaseAt` if null
- Always updates `last_engagement` for matched subscribers
- Matching priority: email first, then phone

---

### POST `/api/webhooks/enrich`

Enrich a subscriber with additional data (e.g., email from Woopra).

**Request:**
```json
{
  "phone": "1234567890",
  "email": "user@example.com",
  "name": "John Doe"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `phone` | string | Yes | Phone number to identify subscriber |
| `email` | string | Yes | Email to add to subscriber |
| `name` | string | No | Optional name update |

**Response:**
```json
{
  "success": true,
  "id": 42,
  "message": "Subscriber enriched successfully"
}
```

**Notes:**
- Use this endpoint to sync email addresses from Woopra or other identity providers
- Phone is normalized (10 digits → 11 with "1" prefix)
- Returns 404 if subscriber not found

---

### POST `/api/webhooks/subscribe`

Add or update a subscriber directly (without waiting for Lime sync).

**Request:**
```json
{
  "phone": "1234567890",
  "name": "John Doe",
  "email": "john@example.com",
  "keywords": "STOCK,TRADE"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `phone` | string | Yes | Phone number |
| `name` | string | No | Subscriber name |
| `email` | string | No | Email address |
| `keywords` | string | No | Brand keywords (STOCK, TRADE) |

**Response:**
```json
{
  "success": true,
  "id": 42
}
```

**Notes:**
- Normalizes phone (adds `1` prefix if 10 digits)
- Derives timezone from area code
- Defaults to WSWD if no keywords provided
- Uses upsert logic

---

### POST `/api/shorten`

Create a shortened tracking link via Lime Cellular.

**Request:**
```json
{
  "url": "https://example.com/long-page",
  "name": "Promo123"
}
```

**Response:**
```json
{
  "success": true,
  "shortLink": "https://sms1.px1.co/abc123"
}
```

---

### GET `/api/cron`

Trigger subscriber sync and queue processing manually.

**Headers (optional):**
```
Authorization: Bearer YOUR_CRON_SECRET
```

**Response:**
```json
{
  "success": true,
  "timestamp": "2025-12-17T20:00:00.000Z"
}
```

---

## Configuration Options

All settings are managed via the Settings page (`/settings`) and stored in `AppConfig`.

| Setting | Default | Description |
|---------|---------|-------------|
| **Master Sending Switch** | OFF | Global on/off for all message sending |
| **Test Mode** | ON | When enabled, only sends to whitelisted numbers |
| **Test Numbers** | (empty) | Comma-separated phone numbers for testing |
| **Daily Limit Per User** | 2 | Maximum messages any subscriber can receive per day |
| **Minimum Interval (Minutes)** | 0 | Minimum gap between messages to same subscriber |
| **Engagement Window (Days)** | 90 | Suppress users with no engagement beyond this period |
| **Enforce Engagement Window** | ON | Whether to apply the engagement window rule |
| **Scheduled Send Times** | (empty) | Comma-separated times like "09:00,14:00" |

### Scheduled Send Times Logic

When `sendTimes` is configured:
- Messages are ONLY sent within ±3 minutes of a scheduled time
- Each slot can only be used once per day per subscriber
- If a subscriber's minimum interval hasn't passed, they skip that slot

**Example:** With `sendTimes = "09:00,14:00"` and `minIntervalMinutes = 60`:
- User receives message at 9:00am
- 14:00 slot arrives → 5 hours since last message → User is eligible
- If they received at 13:30 instead → 14:00 slot would be skipped (only 30 min gap)

---

## Background Worker

**Location:** `scripts/worker.ts`

The worker runs as a separate process alongside the Next.js app.

**Start command:**
```bash
npm run worker
# or
tsx scripts/worker.ts
```

**Scheduled Jobs:**

| Schedule | Task |
|----------|------|
| `*/15 * * * *` | Sync subscribers from Lime Cellular |
| `* * * * *` | Process send queue |
| (on startup) | Process queue once immediately |

**For production:** Deploy as a separate Cloud Run service or use a process manager like PM2.

---

## Compliance & Safety Rules

The system enforces multiple layers of protection:

### Pre-Send Checks

1. **Master Switch** - Nothing sends if disabled
2. **Test Mode** - Limits sending to whitelist
3. **Time Window** - 8am-8pm in subscriber's timezone
4. **Daily Cap** - Max N messages per day
5. **Minimum Interval** - Gap between consecutive messages
6. **Schedule Matching** - Must align with configured times
7. **Engagement Window** - Requires recent activity
8. **Real-time Opt-in Verification** - Checks Lime before each send

### Per-Message Checks

1. **Cooldown Period** - Same message not repeated within N days
2. **Campaign Cap** - Max impressions per campaign per week

### Timezone Handling

- Timezones are derived from phone area codes
- All time-based rules (8am-8pm, schedules) use subscriber's local time
- Fallback timezone: `America/New_York`

---

## Deployment

### Docker

A `Dockerfile` is included for containerized deployment.

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build
CMD ["npm", "start"]
```

### Google Cloud Platform

The app is configured for Cloud Run deployment:

1. **Cloud SQL** - PostgreSQL database
2. **Cloud Run (Web)** - Next.js application
3. **Cloud Run (Worker)** - Background job processor
4. **Cloud Build** - CI/CD via `cloudbuild.yaml`

**Required secrets:**
- `DATABASE_URL`
- `LIME_USER`
- `LIME_API_ID`
- `CRON_SECRET`

### Database Migrations

```bash
# Generate migration from schema changes
npx prisma migrate dev --name description_of_changes

# Apply migrations in production
npx prisma migrate deploy

# Generate Prisma Client
npx prisma generate
```

---

## Troubleshooting

### Common Issues

**Messages not sending:**
1. Check Master Switch is ON in Settings
2. Verify subscriber is ACTIVE in database
3. Check if Test Mode is ON and number is whitelisted
4. Review eligibility logs in console output

**Subscriber not found after sync:**
1. Verify they opted in via Lime Cellular
2. Check list ID `135859` in `syncSubscribers()`
3. Manually trigger sync via `/api/cron`

**Timezone showing as default:**
1. Verify phone format includes area code
2. Check area code exists in `lib/area-codes.ts`

**Link shortening fails:**
1. Verify `LIME_USER` and `LIME_API_ID` in environment
2. Check Lime API response in console logs

### Debug Scripts

Several utility scripts are included:

| Script | Purpose |
|--------|---------|
| `check-db.js` | Verify database connection |
| `diagnose-eligibility.js` | Debug why a subscriber isn't eligible |
| `diagnose-state.ts` | View current worker state |
| `verify-interval.ts` | Test interval calculations |
| `trigger-sync.js` | Force subscriber sync |

### Logs

- Worker outputs to console with `[Cron]` prefix
- API errors logged with endpoint name prefix
- Use `DEBUG:` prefix in code for development logging

---

## Support

For questions or issues, contact the development team.

---

*This documentation is intended for developers working on the Lime SMS App codebase.*
