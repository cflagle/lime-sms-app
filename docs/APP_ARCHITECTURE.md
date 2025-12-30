# Lime SMS App - Complete Architecture Documentation

This document provides comprehensive documentation for building an SMS campaign management application. It covers all core components, data models, services, APIs, and deployment considerations.

---

## Table of Contents

1. [Overview](#overview)
2. [Technology Stack](#technology-stack)
3. [Project Structure](#project-structure)
4. [Database Schema](#database-schema)
5. [Core Services](#core-services)
6. [API Endpoints](#api-endpoints)
7. [UI Pages](#ui-pages)
8. [Background Worker](#background-worker)
9. [Authentication](#authentication)
10. [Deployment](#deployment)
11. [Environment Variables](#environment-variables)

---

## Overview

This application is an **SMS Campaign Management System** that:

- **Syncs subscribers** from the Lime Cellular API
- **Manages a message pool** with multiple messages/ads
- **Sends scheduled SMS messages** to subscribers based on complex eligibility rules
- **Tracks analytics** (clicks, purchases, revenue) via webhooks
- **Provides a dashboard** for monitoring campaign performance
- **Supports segmentation** for targeted messaging

### Key Features

| Feature | Description |
|---------|-------------|
| **Subscriber Sync** | Automatically syncs opted-in numbers from Lime Cellular every 15 minutes |
| **Message Pool** | Create multiple messages with brand tagging and cooldown periods |
| **Smart Scheduling** | Send times configurable per brand with timezone awareness |
| **Frequency Capping** | Daily limits per user, per brand, with minimum intervals |
| **Safety Checks** | Opt-in verification before every send, global daily caps |
| **Analytics Tracking** | Webhook-based click and purchase tracking with revenue attribution |
| **Segmentation** | Rule-based targeting (new subscribers, purchasers, acquisition source) |
| **Dry Run Mode** | Test queue processing without sending real SMS |

---

## Technology Stack

| Component | Technology | Version |
|-----------|------------|---------|
| **Framework** | Next.js (App Router) | 16.x |
| **Runtime** | Node.js | ≥20.0.0 |
| **Language** | TypeScript | 5.x |
| **Frontend** | React | 19.x |
| **Styling** | Tailwind CSS | 4.x |
| **Database** | PostgreSQL | - |
| **ORM** | Prisma | 5.x |
| **HTTP Client** | Axios | 1.x |
| **Date Handling** | Day.js | 1.x |
| **Cron Jobs** | node-cron | 4.x |
| **Phone Parsing** | libphonenumber-js | 1.x |
| **XML Parsing** | xml2js | 0.6.x |
| **Icons** | Lucide React | - |

### NPM Scripts

```json
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "worker": "tsx scripts/worker.ts",
  "postinstall": "prisma generate"
}
```

---

## Project Structure

```
├── app/                          # Next.js App Router
│   ├── api/                      # API Routes
│   │   ├── cron/                 # Cron trigger endpoint
│   │   ├── export/               # Data export
│   │   ├── send-direct/          # Direct message sending
│   │   ├── shorten/              # Link shortening
│   │   ├── subscribers/          # Subscriber management
│   │   └── webhooks/             # External webhooks
│   │       ├── analytics/        # Click/purchase tracking
│   │       ├── enrich/           # Subscriber enrichment
│   │       └── subscribe/        # New subscriber handling
│   ├── login/                    # Login page
│   ├── logs/                     # Sent logs viewer
│   ├── messages/                 # Message pool management
│   ├── reporting/                # Analytics reports
│   ├── settings/                 # App configuration
│   ├── subscribers/              # Subscriber list
│   ├── tracking/                 # Tracking events viewer
│   ├── layout.tsx                # Root layout with sidebar
│   ├── page.tsx                  # Dashboard
│   └── globals.css               # Global styles
│
├── components/                   # Shared React components
│   └── AppSidebar.tsx           # Navigation sidebar
│
├── lib/                          # Core services
│   ├── analytics-logger.ts      # Structured logging
│   ├── area-codes.ts            # US/CA area code → timezone map
│   ├── auth-constants.ts        # Auth configuration
│   ├── config-service.ts        # App configuration CRUD
│   ├── lime-client.ts           # Lime Cellular API client
│   ├── prisma.ts                # Prisma client singleton
│   ├── segmentation-service.ts  # Rule-based filtering
│   └── sms-service.ts           # Core SMS orchestration
│
├── prisma/
│   ├── schema.prisma            # Database schema
│   ├── migrations/              # Migration history
│   └── seed.js                  # Seed data
│
├── scripts/
│   └── worker.ts                # Background worker (cron jobs)
│
├── middleware.ts                 # Basic auth middleware
├── Dockerfile                    # Container definition
├── cloudbuild.yaml              # Google Cloud Build config
└── docker-compose.yml           # Local dev setup
```

---

## Database Schema

### Entity Relationship Diagram

```mermaid
erDiagram
    Subscriber ||--o{ SentLog : "receives"
    Subscriber ||--o{ TrackingEvent : "triggers"
    Message ||--o{ SentLog : "sent_as"
    Message ||--o{ TrackingEvent : "attributed_to"
    Campaign ||--o{ Message : "contains"
    
    Subscriber {
        int id PK
        string phone UK
        string name
        string email
        string status
        string timezone
        boolean hasClicked
        boolean hasPurchased
        float totalRevenue
    }
    
    Message {
        int id PK
        string name UK
        string content
        string brand
        boolean active
        int cooldownDays
        int campaignId FK
    }
    
    SentLog {
        int id PK
        int subscriberId FK
        int messageId FK
        string brand
        datetime sentAt
    }
    
    TrackingEvent {
        int id PK
        string eventType
        float revenue
        int subscriberId FK
        int messageId FK
        string keyword
    }
    
    Campaign {
        int id PK
        string name UK
        int maxImpressionsPerWeek
    }
    
    Segment {
        int id PK
        string name UK
        string rules
        boolean isActive
    }
    
    AppConfig {
        int id PK
        boolean sendingEnabled
        boolean testMode
        int dailyLimitPerUser
    }
```

### Model Details

#### Subscriber

Represents an opted-in phone number.

| Field | Type | Description |
|-------|------|-------------|
| `phone` | String (unique) | Primary identifier, E.164 format |
| `name` | String? | Display name |
| `email` | String? | Used for analytics matching |
| `status` | String | `ACTIVE` or `OPTOUT` |
| `timezone` | String? | IANA timezone (e.g., `America/New_York`) |
| `subscribe_wswd` | Boolean | Opted in to WSWD brand |
| `subscribe_ta` | Boolean | Opted in to TA brand |
| `hasClicked` | Boolean | Behavioral flag |
| `hasPurchased` | Boolean | Behavioral flag |
| `totalClicks` | Int | Lifetime click count |
| `totalPurchases` | Int | Lifetime purchase count |
| `totalRevenue` | Float | Lifetime revenue attributed |
| `firstName` | String? | For personalization |
| `lastName` | String? | For personalization |
| `last_engagement` | DateTime? | Last click/purchase timestamp |
| `acq_source` | String? | Acquisition UTM source |
| `acq_campaign` | String? | Acquisition campaign |

#### Message

An SMS template in the message pool.

| Field | Type | Description |
|-------|------|-------------|
| `name` | String (unique) | Identifier used in tracking (immutable after creation) |
| `content` | String | SMS body text (include tracking links) |
| `brand` | String | `WSWD` or `TA` |
| `active` | Boolean | Whether message is in rotation |
| `cooldownDays` | Int | Days before re-sending to same subscriber |
| `campaignId` | Int? | Optional campaign grouping |

#### SentLog

Record of every SMS sent.

| Field | Type | Description |
|-------|------|-------------|
| `subscriberId` | Int | Who received it |
| `messageId` | Int | Which message was sent |
| `brand` | String | Brand at time of send |
| `sentAt` | DateTime | Timestamp |

#### TrackingEvent

Webhook-received analytics events.

| Field | Type | Description |
|-------|------|-------------|
| `eventType` | String | `CLICK`, `PURCHASE`, etc. |
| `revenue` | Float? | Revenue amount (for purchases) |
| `subscriberId` | Int? | Matched subscriber (if found) |
| `messageId` | Int? | Attributed message (via `keyword` field) |
| `keyword` | String? | `t202kw` value = message name |
| `email` | String? | Used for subscriber matching |
| Various UTM fields | String? | Attribution tracking |

#### Campaign

Grouping for impression capping.

| Field | Type | Description |
|-------|------|-------------|
| `name` | String (unique) | Campaign identifier |
| `maxImpressionsPerWeek` | Int | Max messages per campaign per subscriber per week |

#### Segment

Rule-based subscriber filtering.

| Field | Type | Description |
|-------|------|-------------|
| `name` | String (unique) | Segment identifier |
| `rules` | String | JSON rules object |
| `isActive` | Boolean | Enable/disable segment |

**Example Rules JSON:**
```json
{
  "createdInLastDays": 7,
  "hasPurchased": false,
  "acqSource": "facebook"
}
```

#### AppConfig

Single-row configuration table (ID always = 1).

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `sendingEnabled` | Boolean | `false` | Master on/off switch |
| `testMode` | Boolean | `true` | Only send to test numbers |
| `testNumbers` | String | `""` | Comma-separated allowed phones |
| `dryRunMode` | Boolean | `false` | Log sends without API calls |
| `dailyLimitPerUser` | Int | `2` | Max SMS per subscriber per day |
| `dailyLimitWSWD` | Int | `2` | WSWD brand daily limit |
| `dailyLimitTA` | Int | `2` | TA brand daily limit |
| `sendTimesWSWD` | String | `""` | Comma-separated times (e.g., `09:00,14:00`) |
| `sendTimesTA` | String | `""` | Comma-separated times |
| `minIntervalMinutes` | Int | `0` | Minimum minutes between messages |
| `engagementWindowEnabled` | Boolean | `true` | Enable engagement window filter |
| `engagementWindowDays` | Int | `90` | Days since last engagement |
| `globalDailyCap` | Int | `0` | Max total sends per day (0 = unlimited) |
| `limeListId` | String | `"135859"` | Lime Cellular list ID to sync |
| `activeSegmentId` | Int? | `null` | Optional segment filter |

---

## Core Services

### SMS Service (`lib/sms-service.ts`)

The main orchestration service with three key methods:

#### `syncSubscribers()`

Syncs subscribers from Lime Cellular.

1. Fetches all opted-in numbers from configured Lime list
2. Parses XML response
3. Derives timezone from phone area code
4. Determines brand permissions from keyword
5. Upserts each subscriber in batches of 50

**Keyword Logic:**
- Contains `STOCK` → `subscribe_wswd = true`
- Contains `TRADE` → `subscribe_ta = true`
- Neither → Both enabled (fallback)

#### `processQueue()`

Main message sending loop.

1. Check if sending is enabled
2. Check global daily cap
3. Fetch active subscribers with cursor pagination (batches of 500)
4. Filter by test mode (if enabled)
5. Apply segmentation filter (if active segment set)
6. For each eligible subscriber:
   - Check `isEligibleToReceive()`
   - Select message via `selectMessageFor()`
   - Send via `sendMessage()`

#### `isEligibleToReceive(subscriber, config)`

Checks if subscriber can receive a message RIGHT NOW.

| Check | Rule |
|-------|------|
| **Time Window** | 8 AM - 8 PM in subscriber's timezone |
| **Scheduled Send** | Current time matches configured send times (±3 min) |
| **Min Interval** | Enough time since last message |
| **Slot Usage** | Haven't already sent in current time slot (±45 min buffer) |
| **Engagement Window** | Active within X days (if enabled) |

#### `selectMessageFor(subscriber, config)`

Picks the best message to send.

1. Determine eligible brands based on subscription + daily limits + schedule match
2. Query active messages for eligible brands
3. Shuffle randomly
4. Filter by cooldown (hasn't seen in X days)
5. Check campaign impression caps
6. Return first valid message or `null`

#### `sendMessage(subscriber, message, config)`

Sends the actual SMS.

1. **Opt-in Safety Check:** Call `LimeClient.checkOptInStatus()` (skipped in dry run)
2. If not opted-in: Mark subscriber as OPTOUT, skip send
3. Send SMS via `LimeClient.sendSMS()`
4. Create `SentLog` record

#### `sendDirectMessage(phone, messageId?)`

Immediate send bypassing queue (for testing).

1. Find subscriber by phone
2. Verify ACTIVE status (compliance)
3. Run eligibility checks
4. Send message
5. Log to database

---

### Segmentation Service (`lib/segmentation-service.ts`)

Rule-based subscriber filtering.

```typescript
SegmentationService.checkEligibility(subscriber, rulesJson): boolean
```

**Supported Rules:**

| Rule | Type | Description |
|------|------|-------------|
| `createdInLastDays` | number | Subscriber created within X days |
| `hasPurchased` | boolean | Has made a purchase |
| `isEngaged` | boolean | Has any `last_engagement` date |
| `acqSource` | string | Matches `acq_source` field |
| `acqCampaign` | string | Matches `acq_campaign` field |

---

### Config Service (`lib/config-service.ts`)

Simple CRUD for the single `AppConfig` row.

- `getAppConfig()`: Fetch config, create with defaults if missing
- `updateAppConfig(updates)`: Partial update

---

### Lime Client (`lib/lime-client.ts`)

See **LIME_API_REFERENCE.md** for complete documentation. Summary:

| Method | Description |
|--------|-------------|
| `sendSMS(mobile, message)` | Send one-way SMS |
| `createTrackingLink(url, name)` | Create shortened tracking URL |
| `getOptedInNumbers(listId)` | Fetch all subscribers from list |
| `checkOptInStatus(mobile)` | Verify opt-in before send |

---

## API Endpoints

### Internal APIs

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/shorten` | POST | Create Lime tracking link |
| `/api/send-direct` | POST | Send immediate SMS to phone |
| `/api/subscribers` | GET | List/search subscribers |
| `/api/cron` | POST | Trigger queue processing (for manual/external triggers) |
| `/api/export` | GET | Export data |

### Webhooks (External)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/webhooks/analytics` | POST | Receive click/purchase events |
| `/api/webhooks/enrich` | POST | Enrich subscriber data |
| `/api/webhooks/subscribe` | POST | Handle new subscriptions |

#### Analytics Webhook

Receives tracking events from external systems (e.g., affiliate networks, Woopra).

**Request Body:**
```json
{
  "api_key": "your_app_password",
  "event": "CLICK",
  "email": "user@example.com",
  "phone": "12125551234",
  "t202kw": "message_name",
  "revenue": 49.99,
  "utm_source": "sms",
  "utm_campaign": "holiday_promo"
}
```

**Processing:**
1. Authenticate via `api_key`
2. Match subscriber by email or phone
3. Resolve message from `t202kw` (message name)
4. Create `TrackingEvent` record
5. Update subscriber behavioral flags (`hasClicked`, `hasPurchased`, etc.)
6. Update `last_engagement` timestamp

**Response:**
```json
{
  "success": true,
  "matched": true,
  "eventId": 123,
  "messageId": 45,
  "subscriberId": 678
}
```

---

## UI Pages

### Dashboard (`/`)

Main overview with KPI cards:
- Active Subscribers (with week-over-week growth)
- Messages Sent Today
- Total Revenue
- Total Clicks
- Recent Send Activity table

### Messages (`/messages`)

Message pool management:
- Create new messages (name, content, brand, cooldown)
- View/edit existing messages
- Toggle active/archived
- Per-message stats (sends, clicks, purchases, revenue)

### Settings (`/settings`)

Configuration panel:
- Master switches (Sending Enabled, Test Mode, Dry Run)
- Test numbers list
- Frequency controls (daily limits, intervals)
- Brand-specific settings (limits, send times per brand)
- Lime integration settings (List ID)
- Safety controls (Global Daily Cap)

### Subscribers (`/subscribers`)

Subscriber list with search/filter.

### Logs (`/logs`)

Sent log history.

### Tracking (`/tracking`)

View all tracking events.

### Reporting (`/reporting`)

Analytics reports and charts.

---

## Background Worker

The worker runs as a separate process (`npm run worker`).

### Cron Schedule

| Schedule | Job | Description |
|----------|-----|-------------|
| `*/15 * * * *` | `syncSubscribers()` | Sync from Lime every 15 minutes |
| `* * * * *` | `processQueue()` | Check and send messages every minute |

### Implementation

```typescript
// Run sync every 15 minutes
cron.schedule('*/15 * * * *', async () => {
    await SmsService.syncSubscribers();
});

// Process queue every minute
cron.schedule('* * * * *', async () => {
    await SmsService.processQueue();
});

// Run immediately on startup
await SmsService.processQueue();

// HTTP server for health checks (Cloud Run requirement)
http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Worker is running');
}).listen(process.env.PORT || 8080);
```

---

## Authentication

### Basic Auth Middleware

The app uses HTTP Basic Authentication via `middleware.ts`:

- Credentials checked against `APP_USERNAME` and `APP_PASSWORD` env vars
- Protects all routes except `/api/webhooks/*` (for external access)
- Webhooks authenticate via `api_key` in request body

---

## Deployment

### Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npx prisma generate
RUN npm run build
CMD ["npm", "start"]
```

### Google Cloud Run

Two services deployed:
1. **Web App**: Next.js frontend + API
2. **Worker**: Background cron jobs

Both share the same database and secrets.

### Cloud Build (`cloudbuild.yaml`)

Builds Docker image and deploys both services with secrets.

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `LIME_USER` | Yes | Lime Cellular username |
| `LIME_API_ID` | Yes | Lime Cellular API ID |
| `LIME_DOMAIN` | No | Short link domain (default: `sms1.px1.co`) |
| `APP_USERNAME` | Yes | Basic auth username |
| `APP_PASSWORD` | Yes | Basic auth password + webhook API key |
| `PORT` | No | Server port (default: 3000/8080) |

### Example `.env`

```bash
DATABASE_URL="postgresql://user:password@localhost:5432/limedb"
LIME_USER="your_lime_username"
LIME_API_ID="your_lime_api_id"
LIME_DOMAIN="sms1.px1.co"
APP_USERNAME="admin"
APP_PASSWORD="secure_password_here"
```

---

## Quick Start for New App

1. **Initialize Project**
   ```bash
   npx create-next-app@latest your-app-name --typescript --tailwind --app
   cd your-app-name
   ```

2. **Install Dependencies**
   ```bash
   npm install @prisma/client prisma axios dayjs node-cron libphonenumber-js xml2js lucide-react
   npm install -D @types/xml2js tsx
   npx prisma init
   ```

3. **Set Up Database**
   - Copy schema from this document
   - Configure `DATABASE_URL`
   - Run `npx prisma migrate dev`

4. **Copy Core Services**
   - `lib/lime-client.ts`
   - `lib/sms-service.ts`
   - `lib/config-service.ts`
   - `lib/segmentation-service.ts`
   - `lib/area-codes.ts`

5. **Create API Routes**
   - Webhooks for analytics
   - Shorten endpoint
   - Direct send

6. **Build UI Pages**
   - Dashboard with stats
   - Message management
   - Settings panel

7. **Set Up Worker**
   - Create `scripts/worker.ts`
   - Add npm script: `"worker": "tsx scripts/worker.ts"`

8. **Deploy**
   - Set up database (Cloud SQL, etc.)
   - Configure secrets
   - Deploy web + worker containers

---

*Last Updated: December 30, 2024*
