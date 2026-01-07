# Scaling Plan: 50,000 Messages + 10,000 Click Events

## Current Architecture Issues

### Critical Bottlenecks Identified

| Issue | Current Behavior | Impact at Scale |
|-------|------------------|-----------------|
| **Sequential Processing** | `for (sub of batch) { await send() }` | 50k × 200ms = **2.8 hours** to send |
| **N+1 Campaign Queries** | DB query per message per subscriber | Millions of queries per run |
| **No Rate Limiting** | Unlimited Lime API calls | Risk of API throttling/blocking |
| **Single Worker Instance** | One cron job processes everything | No parallelism, single point of failure |
| **Missing Indexes** | No indexes on frequently queried columns | Slow lookups as tables grow |
| **No Event Batching** | Each click = immediate DB write | 10k clicks = 10k transactions |

---

## Phase 1: Database Optimizations (Keep Current Stack)

### 1.1 Add Critical Indexes

Add these indexes to dramatically speed up queries:

```prisma
// In schema.prisma - add to existing models

model SentLog {
  // ... existing fields

  @@index([subscriberId, sentAt])           // Daily cap checks
  @@index([subscriberId, messageId, sentAt]) // Cooldown checks
  @@index([messageId, sentAt])              // Campaign analytics
}

model Subscriber {
  // ... existing fields

  @@index([email])           // Webhook matching
  @@index([status])          // Active subscriber queries
  @@index([status, id])      // Cursor pagination
}

model TrackingEvent {
  // ... existing fields

  @@index([keyword])         // Message attribution
  @@index([subscriberId])    // User history
  @@index([createdAt])       // Time-based queries
}
```

### 1.2 Optimize Campaign Cap Check

The current code queries the database for EVERY message candidate. Pre-fetch instead:

```typescript
// In selectMessageFor() - batch fetch campaign counts once
const campaignCounts = await prisma.sentLog.groupBy({
  by: ['messageId'],
  where: {
    subscriberId: sub.id,
    sentAt: { gte: startOfWeek },
    message: { campaignId: { not: null } }
  },
  _count: true
});

// Then use in-memory lookup instead of per-message DB query
```

---

## Phase 2: Parallel Processing (Major Performance Gain)

### 2.1 Concurrent Message Sending

Change sequential to parallel with controlled concurrency:

```typescript
// Current (SLOW):
for (const sub of batchToProcess) {
  await this.sendMessage(sub, message, config);
}

// Optimized (FAST):
const CONCURRENCY = 25; // Process 25 at a time
for (let i = 0; i < batchToProcess.length; i += CONCURRENCY) {
  const chunk = batchToProcess.slice(i, i + CONCURRENCY);
  await Promise.all(chunk.map(sub => this.processSubscriber(sub, config)));
}
```

**Impact**: 50k messages with 25 concurrency @ 200ms = **~7 minutes** (vs 2.8 hours)

### 2.2 Add Rate Limiting for Lime API

Protect against API throttling:

```typescript
// Simple in-memory rate limiter
class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private maxTokens: number;
  private refillRate: number; // tokens per second

  constructor(maxPerSecond: number) {
    this.maxTokens = maxPerSecond;
    this.tokens = maxPerSecond;
    this.refillRate = maxPerSecond;
    this.lastRefill = Date.now();
  }

  async acquire(): Promise<void> {
    this.refill();
    if (this.tokens < 1) {
      const waitMs = (1 / this.refillRate) * 1000;
      await new Promise(r => setTimeout(r, waitMs));
      return this.acquire();
    }
    this.tokens--;
  }

  private refill() {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }
}

// Usage in LimeClient
const limiter = new RateLimiter(50); // 50 requests/second

static async sendSMS(mobile: string, message: string) {
  await limiter.acquire();
  // ... existing send logic
}
```

---

## Phase 3: Analytics Webhook Optimization

### 3.1 Batch Event Processing

For 10k click events arriving quickly:

```typescript
// Add event buffer with periodic flush
let eventBuffer: TrackingEventData[] = [];
let flushTimer: NodeJS.Timeout | null = null;

export async function POST(request: Request) {
  // ... validation ...

  // Buffer events instead of immediate write
  eventBuffer.push(eventData);

  // Flush every 100 events or 500ms, whichever comes first
  if (eventBuffer.length >= 100) {
    await flushEvents();
  } else if (!flushTimer) {
    flushTimer = setTimeout(flushEvents, 500);
  }

  return NextResponse.json({ success: true, queued: true });
}

async function flushEvents() {
  if (eventBuffer.length === 0) return;

  const batch = eventBuffer;
  eventBuffer = [];
  flushTimer = null;

  // Batch insert
  await prisma.trackingEvent.createMany({ data: batch });

  // Batch update subscribers
  // ... group updates by subscriberId
}
```

### 3.2 Add Subscriber Email Index

The current email lookup uses `findFirst` without an index:

```prisma
model Subscriber {
  email String? @index  // Add this
}
```

---

## Phase 4: Job Queue (Optional - If Needed)

If you need guaranteed delivery, retries, or true horizontal scaling, add **Google Cloud Tasks** (native to GCP, serverless, cheap):

### 4.1 Architecture Change

```
Current:  Worker (cron) → Direct DB + API calls
Proposed: Worker (cron) → Cloud Tasks Queue → Worker endpoints → DB + API
```

### 4.2 Implementation

```typescript
// In processQueue() - enqueue instead of process directly
import { CloudTasksClient } from '@google-cloud/tasks';

const client = new CloudTasksClient();
const queue = `projects/${PROJECT}/locations/us-central1/queues/sms-sends`;

// Instead of: await this.sendMessage(sub, msg, config)
// Do: enqueue task
await client.createTask({
  parent: queue,
  task: {
    httpRequest: {
      url: `${APP_URL}/api/internal/send-task`,
      httpMethod: 'POST',
      body: Buffer.from(JSON.stringify({ subscriberId: sub.id, messageId: msg.id })),
      headers: { 'Content-Type': 'application/json' }
    },
    scheduleTime: { seconds: Date.now() / 1000 } // Immediate or spread over time
  }
});
```

**Benefits**:
- Automatic retries with exponential backoff
- Spread 50k sends over 5-10 minutes automatically
- Pay only for what you use (~$0.40 per million tasks)
- Built into GCP, no extra infrastructure

---

## Phase 5: Database Scaling

### 5.1 SentLog Table Partitioning

At scale (50k × 2 msgs/day × 365 = 36M rows/year), partition by month:

```sql
-- Run in Cloud SQL
ALTER TABLE "SentLog" RENAME TO "SentLog_old";

CREATE TABLE "SentLog" (
  id SERIAL,
  "subscriberId" INT NOT NULL,
  "messageId" INT NOT NULL,
  brand VARCHAR(10),
  "sentAt" TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (id, "sentAt")
) PARTITION BY RANGE ("sentAt");

-- Create monthly partitions
CREATE TABLE "SentLog_2026_01" PARTITION OF "SentLog"
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
-- ... more partitions
```

### 5.2 Connection Pooling

Add PgBouncer or increase Prisma pool:

```typescript
// In prisma.ts
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  },
  // Increase connection pool for high concurrency
  // Add to DATABASE_URL: ?connection_limit=25&pool_timeout=30
});
```

---

## Recommended Implementation Order

| Priority | Change | Effort | Impact |
|----------|--------|--------|--------|
| **1** | Add database indexes | Low | High - immediate query speedup |
| **2** | Parallel processing (25 concurrent) | Medium | Very High - 2.8hr → 7min |
| **3** | Rate limiter for Lime API | Low | Medium - prevents API blocks |
| **4** | Pre-fetch campaign counts | Low | Medium - eliminates N+1 queries |
| **5** | Analytics event batching | Medium | High - handles 10k clicks smoothly |
| **6** | Cloud Tasks queue | Medium | High - guaranteed delivery, retries |
| **7** | Table partitioning | Medium | Medium - long-term performance |

---

## Cost Estimates (Google Cloud)

| Service | Current | At Scale (50k/day) |
|---------|---------|-------------------|
| Cloud Run (Web) | ~$20/mo | ~$30/mo |
| Cloud Run (Worker) | ~$30/mo | ~$50/mo |
| Cloud SQL (db-f1-micro) | ~$10/mo | Upgrade to db-g1-small: ~$50/mo |
| Cloud Tasks | $0 | ~$5/mo (for 1.5M tasks/mo) |
| **Total** | ~$60/mo | ~$135/mo |

---

## Quick Wins (Implement Today)

1. **Add indexes** - Single migration, huge impact
2. **Parallel processing** - ~30 lines of code change in `lib/sms-service.ts`
3. **Rate limiter** - Simple class addition to `lib/lime-client.ts`

These three changes alone will get you to 50k messages in under 10 minutes without adding any new services.
