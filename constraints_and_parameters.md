# Lime SMS App — Constraints & Parameters

> **Last Updated:** December 2025  
> This document describes the eligibility constraints that govern when and to whom SMS messages can be sent.

---

## Overview

Before any message is sent, the system evaluates a series of constraints to ensure compliance with regulations, user preferences, and business rules. All constraints must pass for a message to be delivered.

---

## Constraint #1: Time Window (8am - 8pm Local Time)

**Purpose:** Comply with TCPA regulations and avoid messaging users at inappropriate hours.

**Logic:**
- The system determines the subscriber's timezone from their phone area code (via `lib/area-codes.ts`)
- Messages are ONLY sent when the subscriber's local time is between **8:00 AM (08:00)** and **8:00 PM (20:00)**
- If timezone cannot be determined, defaults to `America/New_York`

**Implementation:** `lib/sms-service.ts` → `isEligibleToReceive()` lines 165-169

```typescript
const localTime = now.tz(tz);
const hour = localTime.hour();
if (hour < 8 || hour >= 20) return false;
```

**Settings:** Not configurable — hardcoded for compliance.

---

## Constraint #2: Engagement Window

**Purpose:** Avoid messaging inactive users who may have lost interest.

**Logic:**
- If enabled, subscribers who have not engaged within X days are suppressed
- "Engagement" is defined as having a `last_engagement` timestamp (set by click/purchase events)
- If no engagement recorded, falls back to `createdAt` date

**Implementation:** `lib/sms-service.ts` → `isEligibleToReceive()` lines 243-250

```typescript
if (config.engagementWindowEnabled) {
    const windowDays = config.engagementWindowDays || 90;
    const lastActive = sub.last_engagement ? dayjs(sub.last_engagement) : dayjs(sub.createdAt);
    const daysSinceEngage = now.diff(lastActive, 'day');
    if (daysSinceEngage > windowDays) return false;
}
```

**Settings:**
| Setting | Location | Default |
|---------|----------|---------|
| `engagementWindowEnabled` | Settings Page | OFF (note: currently toggled off per user) |
| `engagementWindowDays` | Settings Page | 90 days |

---

## Constraint #3: Minimum Interval Between Messages

**Purpose:** Space out messages throughout the day, preventing users from receiving multiple messages in quick succession.

**Logic:**
- If configured (> 0), requires at least X minutes since the last message sent to this subscriber
- When **no schedule is configured** and no minimum interval is set, a default 1-hour gap is enforced

**Implementation:** `lib/sms-service.ts` → `isEligibleToReceive()` lines 177-193 and 232-241

```typescript
if (config.minIntervalMinutes && config.minIntervalMinutes > 0) {
    if (sub.sentLogs && sub.sentLogs.length > 0) {
        const lastSentLog = sub.sentLogs[0];
        const lastSentTime = dayjs(lastSentLog.sentAt);
        const minutesSince = now.diff(lastSentTime, 'minute');
        if (minutesSince < config.minIntervalMinutes) return false;
    }
}
```

**Settings:**
| Setting | Location | Default |
|---------|----------|---------|
| `minIntervalMinutes` | Settings Page | 0 (disabled, defaults to 1-hour if no schedule) |

---

## Constraint #4: Opt-Out / Unsubscribed Users

**Purpose:** TCPA/CAN-SPAM compliance. CRITICAL — Never message users who have unsubscribed.

**Logic:**
1. **Database Check:** Only `status = 'ACTIVE'` subscribers are included in the queue
2. **Real-time API Verification:** Before EVERY send, the system calls `LimeClient.checkOptInStatus()` to verify the user is still opted-in on Lime Cellular's system
3. **Auto-Update:** If Lime reports the user is not opted-in, the subscriber's status is updated to `OPTOUT` in the database

**Implementation:**
- Queue processing: `lib/sms-service.ts` → `processQueue()` line 111
- Real-time check: `lib/sms-service.ts` → `sendMessage()` lines 324-333
- Direct send check: `lib/sms-service.ts` → `sendDirectMessage()` lines 384-387

```typescript
const isOptedIn = await LimeClient.checkOptInStatus(sub.phone);
if (!isOptedIn) {
    await prisma.subscriber.update({
        where: { id: sub.id },
        data: { status: 'OPTOUT' }
    });
    return;
}
```

**Settings:** Not configurable — always enforced.

---

## Constraint #5: Message Cooldown Period

**Purpose:** Prevent users from seeing the same message too frequently.

**Logic:**
- Each message has a `cooldownDays` field (default: 14 days)
- If a user has been sent a specific message within its cooldown period, that message is skipped
- The system will try to find a different eligible message instead

**Implementation:** `lib/sms-service.ts` → `selectMessageFor()` lines 280-294

```typescript
const hasSeen = await prisma.sentLog.findFirst({
    where: {
        subscriberId: sub.id,
        messageId: msg.id,
        sentAt: {
            gte: dayjs().subtract(msg.cooldownDays, 'day').toDate()
        }
    }
});
if (hasSeen) continue;
```

**Settings:**
| Setting | Location | Default |
|---------|----------|---------|
| `cooldownDays` | Per-message (Messages Page) | 14 days |

---

## Constraint #6: Daily Message Limit Per User (Per Brand)

**Purpose:** Limit message fatigue by capping how many messages a user receives per day.

**Logic:**
- Users can receive at most `dailyLimitPerUser` messages per day
- The count is based on the subscriber's local timezone (start of day)
- This applies across ALL messages/brands the user is subscribed to

**Implementation:** `lib/sms-service.ts` → `isEligibleToReceive()` lines 171-175

```typescript
const dailyLimit = config.dailyLimitPerUser || 2;
const startOfDay = localTime.startOf('day').toDate();
const sentToday = sub.sentLogs.filter((l: any) => l.sentAt >= startOfDay);
if (sentToday.length >= dailyLimit) return false;
```

**Settings:**
| Setting | Location | Default |
|---------|----------|---------|
| `dailyLimitPerUser` | Settings Page | 2 messages/day |

---

## Additional Constraints

### Scheduled Send Times

When `sendTimes` is configured (e.g., "09:00,14:00"):
- Messages are ONLY sent within ±3 minutes of a scheduled time slot
- Each slot can only be used once per day per subscriber (with a 45-min buffer to prevent double-sends)

### Campaign Weekly Caps

If a message belongs to a Campaign:
- Users can only receive `maxImpressionsPerWeek` messages from that campaign
- Default: 2 impressions per week per campaign

### Test Mode

When enabled, messages are ONLY sent to phone numbers in the whitelist (`testNumbers`).

### Master Sending Switch

Global on/off switch. When disabled, NO messages are sent regardless of other settings.

---

## Configuration Summary

| Constraint | Configurable | Location | Default |
|------------|--------------|----------|---------|
| Time Window (8am-8pm) | ❌ No | Hardcoded | 08:00-20:00 |
| Engagement Window | ✅ Yes | Settings | 90 days (currently OFF) |
| Min Interval | ✅ Yes | Settings | 0 min (1hr fallback) |
| Opt-Out Check | ❌ No | Always on | N/A |
| Message Cooldown | ✅ Yes | Per-message | 14 days |
| Daily Limit | ✅ Yes | Settings | 2/day |
| Scheduled Times | ✅ Yes | Settings | Empty (greedy) |
| Campaign Caps | ✅ Yes | Per-campaign | 2/week |

---

## Constraint Evaluation Order

1. Master Switch enabled?
2. Subscriber status = ACTIVE?
3. Test Mode filter (if enabled)
4. Time Window (8am-8pm local)
5. Daily Cap not exceeded
6. Minimum Interval met
7. Schedule Slot matches (if configured)
8. Engagement Window valid (if enabled)
9. Real-time Lime opt-in verification
10. Message cooldown not active
11. Campaign cap not exceeded

---

*For implementation details, see `lib/sms-service.ts` and `DEVELOPER.md`.*
