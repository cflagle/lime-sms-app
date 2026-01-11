# Daylight Hours Compliance Documentation

## Overview

This document describes how the Lime Cellular SMS application enforces **daylight hours compliance** - the legal requirement that SMS messages must only be delivered to recipients between **8:00 AM and 8:00 PM in their local timezone**.

The system determines each subscriber's timezone based on the **area code of their phone number**, then converts the current server time to the subscriber's local time before deciding whether to send.

---

## Table of Contents

1. [How Timezone is Determined](#1-how-timezone-is-determined)
2. [The Daylight Hours Check](#2-the-daylight-hours-check)
3. [Where the Check Happens in the Application Flow](#3-where-the-check-happens-in-the-application-flow)
4. [Complete Message Processing Flow](#4-complete-message-processing-flow)
5. [Database Schema](#5-database-schema)
6. [Entry Points / Triggers](#6-entry-points--triggers)
7. [Key Constants and Boundaries](#7-key-constants-and-boundaries)
8. [What Happens Outside Daylight Hours](#8-what-happens-outside-daylight-hours)
9. [Configuration](#9-configuration)

---

## 1. How Timezone is Determined

### Area Code to Timezone Mapping

**File:** `lib/area-codes.ts`

The application maintains a comprehensive mapping of **300+ North American area codes** to IANA timezone identifiers. This includes:

- All US states and territories
- Canadian provinces
- Special regions (Hawaii, Alaska, Puerto Rico, Guam, US Virgin Islands, etc.)

**Example mappings:**
| Area Code | Timezone | Region |
|-----------|----------|--------|
| 212, 646, 718 | `America/New_York` | New York |
| 312, 773, 847 | `America/Chicago` | Illinois |
| 213, 310, 323 | `America/Los_Angeles` | California |
| 808 | `Pacific/Honolulu` | Hawaii |
| 787, 939 | `America/Puerto_Rico` | Puerto Rico |
| 907 | `America/Anchorage` | Alaska |

### Phone Number Parsing

**File:** `lib/sms-service.ts` (Lines 65-81, 236-242)

The system extracts the area code from phone numbers using this logic:

```typescript
const phoneStr = String(phone).replace(/\D/g, ''); // Strip non-digits
let areaCode = '';

if (phoneStr.length === 11 && phoneStr.startsWith('1')) {
    // Format: 1XXXXXXXXXX (11 digits with country code)
    areaCode = phoneStr.substring(1, 4);
} else if (phoneStr.length === 10) {
    // Format: XXXXXXXXXX (10 digits, no country code)
    areaCode = phoneStr.substring(0, 3);
}
```

### Two Sources of Timezone Data

1. **Stored Timezone** (`Subscriber.timezone` field)
   - Populated during subscriber sync from Lime Cellular
   - Cached in the database for fast lookups

2. **Just-In-Time (JIT) Derivation**
   - If `Subscriber.timezone` is NULL, the system derives it from the phone's area code at send time
   - Uses the `AREA_CODE_TIMEZONES` lookup table

**Priority:** Stored timezone is used first. JIT derivation is the fallback.

---

## 2. The Daylight Hours Check

### Core Validation Function

**File:** `lib/sms-service.ts` (Lines 228-369)

**Method:** `SmsService.isEligibleToReceive(sub: any, config: any): boolean`

This is the **primary compliance gate**. Every message must pass this check before sending.

### The 8 AM to 8 PM Logic

**Lines 257-261:**

```typescript
const localTime = now.tz(tz);  // Convert current UTC time to subscriber's timezone
const hour = localTime.hour(); // Get the hour (0-23)

// 8am to 8pm check
if (hour < 8 || hour >= 20) return false;
```

**Breakdown:**
- `hour < 8` blocks hours 0-7 (midnight to 7:59 AM)
- `hour >= 20` blocks hours 20-23 (8:00 PM to 11:59 PM)
- Only hours 8-19 (8:00 AM to 7:59 PM) pass the check

### Timezone Resolution with Fallback

**Lines 232-255:**

```typescript
let tz = sub.timezone;  // Try stored timezone first

if (!tz && sub.phone) {
    // JIT derivation from area code
    const phoneStr = String(sub.phone).replace(/\D/g, '');
    let areaCode = '';

    if (phoneStr.length === 11 && phoneStr.startsWith('1')) {
        areaCode = phoneStr.substring(1, 4);
    } else if (phoneStr.length === 10) {
        areaCode = phoneStr.substring(0, 3);
    }

    if (areaCode && AREA_CODE_TIMEZONES[areaCode]) {
        tz = AREA_CODE_TIMEZONES[areaCode];
    }
}

// CRITICAL: If no timezone can be determined, BLOCK the message
if (!tz) {
    console.warn(`Eligibility Check: suppressed for ${sub.phone} - NO TIMEZONE AVAILABLE.`);
    return false;  // Fail-safe: Don't send if timezone is unknown
}
```

**Important:** If the timezone cannot be determined (unknown area code and no stored timezone), the message is **blocked** as a safety measure.

---

## 3. Where the Check Happens in the Application Flow

The daylight hours check is enforced at **two entry points**:

### 3.1 Scheduled Queue Processing

**File:** `lib/sms-service.ts` (Line 206)

```typescript
static async processQueue() {
    // ... fetch subscribers ...

    await Promise.all(chunk.map(async (sub) => {
        if (!this.isEligibleToReceive(sub, config)) return;  // <-- CHECK HERE

        const message = await this.selectMessageFor(sub, config);
        if (message) {
            await this.sendMessage(sub, message, config);
        }
    }));
}
```

### 3.2 Direct Send API

**File:** `lib/sms-service.ts` (Lines 667-669)

```typescript
static async sendDirectMessage(phone: string, messageId?: number, provider?: 'lime' | 'trackly') {
    // ... validation ...

    // COMPLIANCE: Safety Checks (Time window, Caps, Gaps)
    if (!this.isEligibleToReceive(sub, config)) {
        throw new Error("Compliance Block: Message suppressed by safety rules (Time window, Frequency Cap, or Cooldown).");
    }

    // ... send message ...
}
```

---

## 4. Complete Message Processing Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│  TRIGGER: Cron Job (every minute) or API Call (/api/cron)          │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  SmsService.processQueue()                                          │
│  • Check if sending is globally enabled                             │
│  • Check global daily cap                                           │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Fetch Active Subscribers (batches of 500)                          │
│  • Status = 'ACTIVE'                                                │
│  • Include sent logs from last 30 days                              │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  FOR EACH SUBSCRIBER:                                               │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│  isEligibleToReceive(sub, config)  ◄── DAYLIGHT HOURS CHECK         │
│                                                                     │
│  1. Resolve timezone (stored OR derive from area code)              │
│  2. Convert current time to subscriber's local time                 │
│  3. ❌ BLOCK if hour < 8 OR hour >= 20                              │
│  4. Check minimum interval between messages                         │
│  5. Check schedule slots (if configured)                            │
│  6. Check engagement window                                         │
│                                                                     │
│  Returns: TRUE (eligible) or FALSE (blocked)                        │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                          ┌─────────┴─────────┐
                          │                   │
                     FALSE│                   │TRUE
                          │                   │
                          ▼                   ▼
              ┌───────────────────┐  ┌─────────────────────────────────┐
              │  SKIP subscriber  │  │  selectMessageFor(sub, config)  │
              │  (no action)      │  │  • Check daily brand limits     │
              │                   │  │  • Match schedule slots         │
              └───────────────────┘  │  • Apply message cooldown       │
                                     └─────────────────────────────────┘
                                                      │
                                            ┌─────────┴─────────┐
                                            │                   │
                                       NULL │                   │ Message
                                            │                   │
                                            ▼                   ▼
                                ┌───────────────────┐  ┌─────────────────────┐
                                │  SKIP subscriber  │  │  sendMessage()      │
                                │  (no message)     │  │  • Verify opt-in    │
                                │                   │  │  • Send via Lime    │
                                └───────────────────┘  │  • Log to SentLog   │
                                                       └─────────────────────┘
```

---

## 5. Database Schema

### Subscriber Model

**File:** `prisma/schema.prisma` (Lines 14-63)

```prisma
model Subscriber {
  id              Int       @id @default(autoincrement())
  phone           String    @unique
  timezone        String?   // e.g. "America/New_York" - CRITICAL FIELD
  status          String    @default("ACTIVE")

  // ... other fields ...

  sentLogs        SentLog[]
}
```

**Key field:** `timezone` stores the IANA timezone identifier (e.g., `"America/New_York"`).

### SentLog Model

**File:** `prisma/schema.prisma` (Lines 103-115)

```prisma
model SentLog {
  id            Int       @id @default(autoincrement())
  subscriberId  Int
  messageId     Int
  brand         String    // "WSWD" or "TA"
  sentAt        DateTime  @default(now())

  @@index([subscriberId, sentAt])  // Used for daily cap checks
}
```

Used to track message history for:
- Daily cap enforcement
- Schedule slot deduplication
- Message cooldown periods

---

## 6. Entry Points / Triggers

### 6.1 Worker Process (Continuous)

**File:** `scripts/worker.ts`

```typescript
// Sync subscribers every 15 minutes
cron.schedule('*/15 * * * *', async () => {
    await SmsService.syncSubscribers();
});

// Process queue every minute
cron.schedule('* * * * *', async () => {
    await SmsService.processQueue();  // <-- Daylight check happens here
});

// Also runs immediately on startup
await SmsService.processQueue();
```

### 6.2 Cron API Endpoint

**File:** `app/api/cron/route.ts`

- **Route:** `POST /api/cron`
- **Auth:** Requires `api_key` matching `APP_PASSWORD` or `CRON_SECRET`
- **Actions:** Calls `syncSubscribers()` then `processQueue()`

### 6.3 Direct Send API

**File:** `app/api/send-direct/route.ts`

- **Route:** `POST /api/send-direct`
- **Purpose:** Send a single message to a specific phone number
- **Compliance:** Still enforces daylight hours check via `isEligibleToReceive()`

---

## 7. Key Constants and Boundaries

| Parameter | Value | Location | Purpose |
|-----------|-------|----------|---------|
| **Early boundary** | `hour < 8` | sms-service.ts:261 | Block before 8:00 AM |
| **Late boundary** | `hour >= 20` | sms-service.ts:261 | Block at/after 8:00 PM |
| **Schedule tolerance** | ±3 minutes | sms-service.ts:311 | Match window for schedule slots |
| **Slot buffer** | ±45 minutes | sms-service.ts:325 | Prevent duplicate sends in same slot |
| **Default interval** | 1 hour | sms-service.ts:355 | Gap between messages (no schedule) |
| **Batch size** | 500 | sms-service.ts:151 | Subscribers per database fetch |
| **Concurrency** | 25 | sms-service.ts:199 | Parallel sends per batch |
| **Process interval** | 1 minute | worker.ts:26 | Queue check frequency |

---

## 8. What Happens Outside Daylight Hours

When `isEligibleToReceive()` determines a subscriber is outside their 8 AM - 8 PM window:

1. **Function returns `false`**
2. **Subscriber is silently skipped** - no error logged, no exception thrown
3. **Message is NOT queued** - the system doesn't "remember" to send later
4. **Next cron run** (1 minute later) will re-evaluate the subscriber
5. **Message will be sent** once the subscriber enters their daylight window

**Example scenario:**

| Server Time (UTC) | Subscriber (NYC, UTC-5) | Local Time | Result |
|-------------------|-------------------------|------------|--------|
| 11:00 UTC | 212-555-1234 | 6:00 AM | ❌ BLOCKED |
| 12:00 UTC | 212-555-1234 | 7:00 AM | ❌ BLOCKED |
| 13:00 UTC | 212-555-1234 | 8:00 AM | ✅ ELIGIBLE |
| 00:30 UTC | 212-555-1234 | 7:30 PM | ✅ ELIGIBLE |
| 01:00 UTC | 212-555-1234 | 8:00 PM | ❌ BLOCKED |

---

## 9. Configuration

### What CAN Be Configured

Via the Settings page (`app/settings/page.tsx`):

| Setting | Field | Purpose |
|---------|-------|---------|
| Master Switch | `sendingEnabled` | Enable/disable all sending |
| Test Mode | `testMode` | Only send to whitelist |
| WSWD Schedule | `sendTimesWSWD` | Specific times for WSWD brand |
| TA Schedule | `sendTimesTA` | Specific times for TA brand |
| Daily Limits | `dailyLimitWSWD`, `dailyLimitTA` | Max messages per day per brand |
| Min Interval | `minIntervalMinutes` | Minimum gap between any messages |
| Engagement Window | `engagementWindowEnabled` | Require recent activity |
| Global Daily Cap | `globalDailyCap` | System-wide daily limit |

### What CANNOT Be Configured

The **8 AM to 8 PM daylight hours window is HARDCODED** and cannot be changed via settings.

**Location:** `lib/sms-service.ts`, line 261

```typescript
if (hour < 8 || hour >= 20) return false;
```

This is intentional - the daylight hours rule is a legal compliance requirement and should not be adjustable to prevent accidental violations.

---

## Summary

The Lime Cellular SMS application enforces daylight hours compliance through:

1. **Area Code Mapping** - 300+ area codes mapped to IANA timezones
2. **Timezone Storage** - Cached in database or derived JIT from phone number
3. **Time Conversion** - Uses dayjs with timezone plugin for accurate local time
4. **Hard Enforcement** - Check at `hour < 8 || hour >= 20` blocks sends outside window
5. **Fail-Safe** - Unknown timezones result in blocked messages
6. **No Override** - Daylight hours are hardcoded and cannot be disabled
7. **Continuous Processing** - Queue runs every minute, re-evaluating eligibility

The daylight hours check is the **first compliance gate** in the eligibility function, ensuring it's always evaluated before any other rules.
