# Scaling & Optimization Guide

Production target: **100k subscribers per brand**, **40k concurrent messages**

---

## Table of Contents

1. [Current State Assessment](#current-state-assessment)
2. [Critical Issues for Scale](#critical-issues-for-scale)
3. [Database Optimizations](#database-optimizations)
4. [API & Service Optimizations](#api--service-optimizations)
5. [Worker Architecture](#worker-architecture)
6. [Recommended Changes](#recommended-changes)

---

## Current State Assessment

### ✅ What's Well Organized

| Aspect | Details |
|--------|---------|
| **Separation of Concerns** | Services are well-isolated (`lime-client`, `sms-service`, `config-service`, `segmentation-service`) |
| **Config Management** | Single-row `AppConfig` provides clear source of truth |
| **Safety Patterns** | Opt-in verification, fail-safe on errors, global daily cap |
| **Compliance** | Time windows, frequency caps, engagement windows |

### ⚠️ Current Limits

| Metric | Current Design | Production Target | Gap |
|--------|----------------|-------------------|-----|
| Subscribers | ~10k | 200k (100k × 2 brands) | **20×** |
| Concurrent Sends | Sequential | 40k | **Critical** |
| Sync Timeout | 10 minutes | Unknown | Risk |
| DB Queries/Send | 3-5 | Must reduce | **High** |

---

## Critical Issues for Scale

### 1. Sequential Processing (BLOCKING)

**Current Code:**
```typescript
for (const sub of batchToProcess) {
    await this.sendMessage(sub, message, config);
}
```

**Problem at Scale:**
- 40k messages × 200ms/API call = **2.2 hours** sequentially
- Must complete within cron interval (1 minute)

**Required:** Parallel processing with controlled concurrency (see [Worker Architecture](#worker-architecture))

---

### 2. N+1 Campaign Query (BLOCKING)

**Current Code:**
```typescript
for (const msg of shuffled) {
    const campaignsSent = await prisma.sentLog.count({
        where: { subscriberId: sub.id, message: { campaignId: msg.campaignId } }
    });
}
```

**Problem at Scale:**
- 200k subscribers × 20 messages = **4M queries** per queue run
- Database will be overwhelmed

**Required:** Pre-fetch all campaign counts with single aggregation query

---

### 3. Timezone Re-Parsing (PERFORMANCE)

**Current Code:**
```typescript
// Runs on EVERY eligibility check
const phoneNumber = parsePhoneNumber(sub.phone, 'US');
```

**Problem at Scale:**
- Phone parsing is CPU-intensive (~5ms)
- 200k × 5ms = **16 minutes** of CPU time

**Required:** Trust stored timezone, only derive if missing

---

### 4. Single Sync API Call (RISK)

**Current Code:**
```typescript
const leads = await LimeClient.getOptedInNumbers(listId);
// Returns 100k+ records in one XML response
```

**Problem at Scale:**
- 100k records × ~500 bytes = **50MB** XML payload
- Memory spike, timeout risk, no resume on failure

**Required:** Stream parsing or paginated sync if API supports it

---

### 5. SentLog Table Size (STORAGE)

**Projection:**
```
200k subscribers × 4 messages/day × 365 days = 292M rows/year
```

**Required:** Partitioning, archival strategy, proper indexes

---

## Database Optimizations

### Required Indexes

```sql
-- Critical for eligibility checks (daily cap)
CREATE INDEX idx_sentlog_subscriber_date 
ON "SentLog"("subscriberId", "sentAt" DESC);

-- Critical for campaign cap checks
CREATE INDEX idx_sentlog_subscriber_message 
ON "SentLog"("subscriberId", "messageId", "sentAt" DESC);

-- For sync upserts
CREATE INDEX idx_subscriber_phone 
ON "Subscriber"("phone");

-- For analytics matching
CREATE INDEX idx_subscriber_email 
ON "Subscriber"("email") WHERE "email" IS NOT NULL;

-- For tracking attribution
CREATE INDEX idx_tracking_keyword 
ON "TrackingEvent"("keyword") WHERE "keyword" IS NOT NULL;
```

### Prisma Schema Additions

```prisma
model SentLog {
  // ... existing fields
  
  @@index([subscriberId, sentAt(sort: Desc)])
  @@index([subscriberId, messageId, sentAt(sort: Desc)])
}

model Subscriber {
  // ... existing fields
  
  @@index([email])
  @@index([status, timezone])
}

model TrackingEvent {
  // ... existing fields
  
  @@index([keyword])
  @@index([messageId, eventType])
}
```

### Table Partitioning (PostgreSQL)

```sql
-- Partition SentLog by month
CREATE TABLE "SentLog" (
    id SERIAL,
    "subscriberId" INT NOT NULL,
    "messageId" INT NOT NULL,
    brand VARCHAR(10),
    "sentAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE ("sentAt");

-- Create monthly partitions
CREATE TABLE "SentLog_2025_01" PARTITION OF "SentLog"
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
```

---

## API & Service Optimizations

### 1. Batch Campaign Count Query

**Replace:**
```typescript
// ❌ N+1 pattern
for (const msg of shuffled) {
    const count = await prisma.sentLog.count({...});
}
```

**With:**
```typescript
// ✅ Single query
const campaignCounts = await prisma.sentLog.groupBy({
    by: ['messageId'],
    where: {
        subscriberId: sub.id,
        sentAt: { gte: startOfWeek }
    },
    _count: { id: true }
});

const countMap = new Map(campaignCounts.map(c => [c.messageId, c._count.id]));
```

### 2. Trust Stored Timezone

**Replace:**
```typescript
// ❌ Re-parse every time
let tz = sub.timezone;
if (!tz && sub.phone) {
    const phoneNumber = parsePhoneNumber(sub.phone, 'US');
    // ... derive timezone
}
```

**With:**
```typescript
// ✅ Only derive if truly missing
const tz = sub.timezone || 'America/New_York';
// Timezone was set during sync, trust it
```

### 3. Bulk Eligibility Pre-Check

Instead of checking one subscriber at a time, pre-filter in SQL:

```typescript
const eligibleSubscribers = await prisma.$queryRaw`
    SELECT s.* 
    FROM "Subscriber" s
    LEFT JOIN (
        SELECT "subscriberId", COUNT(*) as sent_today
        FROM "SentLog"
        WHERE "sentAt" >= ${startOfDay}
        GROUP BY "subscriberId"
    ) logs ON logs."subscriberId" = s.id
    WHERE s.status = 'ACTIVE'
    AND (logs.sent_today IS NULL OR logs.sent_today < ${dailyLimit})
    AND s."last_engagement" >= ${engagementCutoff}
`;
```

### 4. Rate Limiting on Lime API

```typescript
import Bottleneck from 'bottleneck';

const limiter = new Bottleneck({
    maxConcurrent: 50,      // 50 concurrent requests
    minTime: 20,            // 20ms between requests
    reservoir: 1000,        // 1000 requests per minute max
    reservoirRefreshAmount: 1000,
    reservoirRefreshInterval: 60 * 1000
});

export async function sendSMS(mobile: string, message: string) {
    return limiter.schedule(() => rawSendSMS(mobile, message));
}
```

---

## Worker Architecture

### Current: Single Process

```
┌─────────────────────────────────────┐
│           Worker Process            │
│  ┌─────────────────────────────┐   │
│  │  Cron: Sync (every 15 min)  │   │
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │  Cron: Queue (every 1 min)  │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

**Issues:**
- No parallelism
- No fault tolerance
- Can't scale horizontally

### Recommended: Job Queue Architecture

```
┌──────────────────┐     ┌──────────────────┐
│   Scheduler      │     │   Redis/Cloud    │
│   (Cron Trigger) │────▶│   Task Queue     │
└──────────────────┘     └────────┬─────────┘
                                  │
              ┌───────────────────┼───────────────────┐
              ▼                   ▼                   ▼
     ┌────────────────┐  ┌────────────────┐  ┌────────────────┐
     │   Worker 1     │  │   Worker 2     │  │   Worker 3     │
     │  (100 sends)   │  │  (100 sends)   │  │  (100 sends)   │
     └────────────────┘  └────────────────┘  └────────────────┘
```

### Implementation with BullMQ

```typescript
// queue.ts
import { Queue, Worker } from 'bullmq';

export const sendQueue = new Queue('sms-send', { connection: redis });

// scheduler.ts (runs every minute)
async function enqueueEligibleSubscribers() {
    const eligible = await getEligibleSubscribers();
    
    // Batch add to queue
    const jobs = eligible.map(sub => ({
        name: 'send-sms',
        data: { subscriberId: sub.id, messageId: selectedMessage.id }
    }));
    
    await sendQueue.addBulk(jobs);
}

// worker.ts (runs on multiple containers)
const worker = new Worker('sms-send', async (job) => {
    const { subscriberId, messageId } = job.data;
    await sendMessageToSubscriber(subscriberId, messageId);
}, {
    concurrency: 100,  // 100 concurrent per worker
    connection: redis
});
```

### Cloud Run Scaling

```yaml
# cloudrun-worker.yaml
apiVersion: serving.knative.dev/v1
kind: Service
spec:
  template:
    metadata:
      annotations:
        autoscaling.knative.dev/minScale: "1"
        autoscaling.knative.dev/maxScale: "10"
    spec:
      containerConcurrency: 100
```

**Throughput:** 10 workers × 100 concurrent = **1000 parallell sends**

With 200ms per send: **5000 messages/second** = 40k in 8 seconds ✅

---

## Recommended Changes

### Priority 1: BLOCKING (Must Have for Production)

| Change | Effort | Impact |
|--------|--------|--------|
| Add database indexes | 1 hour | 🔥🔥🔥 |
| Fix N+1 campaign query | 2 hours | 🔥🔥🔥 |
| Add concurrent processing | 4 hours | 🔥🔥🔥 |
| Add Lime API rate limiting | 2 hours | 🔥🔥🔥 |

### Priority 2: IMPORTANT (Should Have)

| Change | Effort | Impact |
|--------|--------|--------|
| Trust stored timezone | 30 min | 🔥🔥 |
| Bulk eligibility SQL query | 3 hours | 🔥🔥 |
| Job queue (BullMQ) | 1 day | 🔥🔥 |
| Event deduplication | 2 hours | 🔥🔥 |

### Priority 3: NICE TO HAVE

| Change | Effort | Impact |
|--------|--------|--------|
| Table partitioning | 4 hours | 🔥 |
| Log archival job | 2 hours | 🔥 |
| Stream XML parsing | 4 hours | 🔥 |
| Horizontal worker scaling | 1 day | 🔥 |

---

## Subscriber API Enhancement

The `/api/subscribers` endpoint should accept all subscriber fields for flexibility:

### Recommended Request Schema

```typescript
interface SubscriberUpsertRequest {
    phone: string;              // Required, unique identifier
    
    // Basic Info
    name?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    
    // Subscription Preferences
    subscribe_wswd?: boolean;
    subscribe_ta?: boolean;
    status?: 'ACTIVE' | 'OPTOUT';
    
    // Behavioral Data
    hasClicked?: boolean;
    hasPurchased?: boolean;
    firstClickAt?: string;      // ISO datetime
    firstPurchaseAt?: string;
    totalClicks?: number;
    totalPurchases?: number;
    totalRevenue?: number;
    
    // Engagement
    last_engagement?: string;   // ISO datetime
    lastPurchaseAt?: string;
    
    // Acquisition Attribution
    acq_source?: string;
    acq_campaign?: string;
    acq_medium?: string;
    acq_term?: string;
    acq_content?: string;
    
    // Enrichment
    form_title?: string;
    traits?: object;            // Stored as JSON string
    
    // System
    timezone?: string;          // IANA format
}
```

### Implementation

```typescript
// app/api/subscribers/route.ts
export async function POST(request: Request) {
    const body = await request.json();
    const { phone, ...updateData } = body;
    
    // Validate phone
    if (!phone) {
        return NextResponse.json({ error: 'Phone required' }, { status: 400 });
    }
    
    // Handle traits JSON
    if (updateData.traits && typeof updateData.traits === 'object') {
        updateData.traits = JSON.stringify(updateData.traits);
    }
    
    // Upsert subscriber
    const subscriber = await prisma.subscriber.upsert({
        where: { phone },
        update: updateData,
        create: { phone, ...updateData }
    });
    
    return NextResponse.json({ success: true, subscriber });
}
```

---

## Summary

For **100k subscribers** and **40k concurrent messages**, the current architecture needs:

1. **Database indexes** - Add immediately
2. **Query optimization** - Fix N+1 patterns
3. **Concurrent processing** - Add rate-limited parallelism
4. **Job queue** - Consider BullMQ for horizontal scaling

The code organization is solid—the main gaps are performance optimizations for scale.

---

*Last Updated: December 30, 2024*
