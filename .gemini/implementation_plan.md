# Lime SMS App Stability Fix Plan

## Overview
This plan addresses critical issues identified in the Cloud Run logs that are affecting the reliability and functionality of the Lime SMS application:

- **Issue #2**: Massive Sync Errors (`hasOwnProperty` error in libphonenumber-js) - ✅ IMPLEMENTED
- **Issue #3**: Database Connection Timeouts - Deferred
- **Issue #4**: Analytics Unauthorized Access - Skipped per user request
- **Issue #5**: GCP Logging Quota Exhaustion - ✅ IMPLEMENTED

**Additional Changes Implemented**:
- Sync frequency reduced from every 15 minutes to **once daily at 1 AM**
- Unmapped area codes are now persistently logged to database for later review

---

## Changes Made

### 1. Sync Schedule Changed (scripts/worker.ts)
**Before**: Sync ran every 15 minutes (`*/15 * * * *`)
**After**: Sync runs once daily at 1 AM (`0 1 * * *`)

This dramatically reduces:
- Log volume
- Database load
- API calls to Lime Cellular
- Phone enrichment service calls

### 2. Safe Phone Number Parsing (lib/sms-service.ts)
Added `safeParsePhoneNumber()` utility that:
- Normalizes phone numbers before parsing
- Handles edge cases that caused libphonenumber-js to throw
- Wraps individual enrichment calls with `.catch()` to prevent cascade failures

### 3. Unmapped Area Code Tracking (NEW FILES)
- **lib/unmapped-area-codes.ts**: Tracks phones with unmapped area codes
- **prisma/schema.prisma**: Added `UnmappedAreaCode` model

When a phone number's area code isn't in our `AREA_CODE_TIMEZONES` mapping:
- The area code is logged to the `UnmappedAreaCode` table
- Includes count, sample phone, and timestamps
- You can query this later to add missing area codes

### 4. Log Volume Reduction (lib/log-sampler.ts)
- Created `sampledLog()` utility that batches similar errors
- Batch processing logs reduced (only log every 500 leads, not every 25)
- `flushSampledLogs()` called at end of sync to output summary

### 5. Reduced Batch Size & Added Delays
- Batch size reduced from 50 to 25 concurrent operations
- 100ms delay between batches to prevent overwhelming the system

---

## Files Changed

| File | Status | Description |
|------|--------|-------------|
| `scripts/worker.ts` | Modified | Sync schedule: 1 AM daily |
| `lib/sms-service.ts` | Modified | Safe parsing, area code tracking, sampled logging |
| `lib/log-sampler.ts` | **Created** | Log volume reduction utility |
| `lib/unmapped-area-codes.ts` | **Created** | Persistent unmapped area code tracking |
| `prisma/schema.prisma` | Modified | Added `UnmappedAreaCode` model |

---

/**
 * Fallback timezone derivation using area code map.
 */
function getTimezoneFromAreaCode(phone: string | number): string | null {
    const cleaned = String(phone).replace(/\D/g, '');
    
    // Extract area code (positions 1-3 for 11-digit, 0-2 for 10-digit)
    let areaCode: string;
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
        areaCode = cleaned.substring(1, 4);
    } else if (cleaned.length === 10) {
        areaCode = cleaned.substring(0, 3);
    } else {
        return null;
    }
    
    return AREA_CODE_TIMEZONES[areaCode] || null;
}
```

#### Step 2.2: Update syncSubscribers Enrichment Logic
Replace the phone enrichment block (lines 69-90) with robust handling:

```typescript
// Phone number enrichment using libphonenumber (with fallback)
let tz: string | null = null;
let carrierName: string | null = null;
let location: string | null = null;

// First, try libphonenumber parsing
const parsedPhone = safeParsePhoneNumber(phone);

if (parsedPhone && parsedPhone.isValid()) {
    try {
        const [tzResult, carrierResult, geoResult] = await Promise.all([
            timezones(parsedPhone).catch(() => null),
            carrier(parsedPhone).catch(() => null),
            geocoder(parsedPhone).catch(() => null)
        ]);

        tz = tzResult?.[0] || null;
        carrierName = carrierResult || null;
        location = geoResult || null;
    } catch (e) {
        // Individual enrichment failed, will use fallback
    }
}

// Fallback: Use area code map if timezone still null
if (!tz) {
    tz = getTimezoneFromAreaCode(phone);
    if (tz) {
        console.log(`Sync: Used area code fallback for ${phone} → ${tz}`);
    } else {
        console.warn(`Sync: Could not determine timezone for ${phone} (no fallback available)`);
    }
}
```

#### Step 2.3: Reduce Concurrency During Sync
The batch processing with `Promise.all()` of 50 concurrent enrichments is overwhelming. Reduce to 10:

```typescript
// Change line 37 from:
const BATCH_SIZE = 50;
// To:
const BATCH_SIZE = 25;
```

Also add a small delay between batches (after line 127):
```typescript
// Add after the batch loop
await new Promise(r => setTimeout(r, 100)); // 100ms between batches
```

---

## Issue #3: Database Connection Timeouts

### Problem
Logs show repeated `PrismaClientKnownRequestError` with connection limit and timeout metadata:
```
meta: { modelName: 'Subscriber', connection_limit: 5, timeout: 10 }
```

### Root Cause
1. The default Prisma connection pool (5 connections) is insufficient for concurrent operations
2. No explicit connection URL parameters for connection limits
3. Multiple concurrent cron jobs may be exhausting the pool

### Fix Strategy
Configure explicit connection pooling parameters and add retry logic for transient failures.

### Files to Modify
1. `lib/prisma.ts`
2. `.env` (or environment configuration)

### Implementation Steps

#### Step 3.1: Update Prisma Client Configuration
Replace `lib/prisma.ts` with enhanced configuration:

```typescript
import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

function createPrismaClient(): PrismaClient {
    return new PrismaClient({
        log: process.env.NODE_ENV === 'development' 
            ? ['query', 'error', 'warn'] 
            : ['error'],
        datasources: {
            db: {
                // Use connection URL from environment
                // Connection pooling params should be in DATABASE_URL
                url: process.env.DATABASE_URL
            }
        }
    });
}

export const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma;
}

// Graceful shutdown
process.on('beforeExit', async () => {
    await prisma.$disconnect();
});
```

#### Step 3.2: Update DATABASE_URL Connection Parameters
In your environment configuration (Secret Manager or .env), update the DATABASE_URL to include pooling parameters:

```
# Existing format:
DATABASE_URL="postgresql://user:pass@host:5432/db"

# Updated format with connection pool settings:
DATABASE_URL="postgresql://user:pass@host:5432/db?connection_limit=10&pool_timeout=30"
```

**⚠️ IMPORTANT**: You will need to update this in Google Cloud Secret Manager for production.

#### Step 3.3: Add Retry Logic for Critical Database Operations
Create a new utility file `lib/db-utils.ts`:

```typescript
import { prisma } from './prisma';

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 500;

/**
 * Wraps a Prisma operation with retry logic for transient failures.
 */
export async function withRetry<T>(
    operation: () => Promise<T>,
    operationName: string = 'database operation'
): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            return await operation();
        } catch (error: any) {
            lastError = error;
            
            // Only retry on connection/timeout errors
            const isRetryable = 
                error.code === 'P1001' || // Can't reach database
                error.code === 'P1002' || // Timeout
                error.code === 'P1017' || // Connection closed
                error.message?.includes('connection') ||
                error.message?.includes('timeout');
            
            if (!isRetryable || attempt === MAX_RETRIES) {
                throw error;
            }
            
            console.warn(
                `[DB Retry] ${operationName} failed (attempt ${attempt}/${MAX_RETRIES}): ${error.message}. Retrying in ${RETRY_DELAY_MS}ms...`
            );
            
            await new Promise(r => setTimeout(r, RETRY_DELAY_MS * attempt));
        }
    }
    
    throw lastError;
}
```

#### Step 3.4: Use Retry Wrapper in Critical Paths
Update `config-service.ts` to use retry logic (this is hit on every cron tick):

```typescript
import { prisma } from './prisma';
import { withRetry } from './db-utils';

export async function getAppConfig() {
    return withRetry(async () => {
        let config = await prisma.appConfig.findFirst();
        if (!config) {
            config = await prisma.appConfig.create({
                data: {
                    sendingEnabled: false,
                    testMode: true,
                    // ... rest of defaults
                }
            });
        }
        return config;
    }, 'getAppConfig');
}
```

---

## Issue #4: Analytics Unauthorized Access

### Problem
The web service logs show repeated authorization failures:
```
[Analytics] [ERROR] Unauthorized access attempt { api_key: "SpaceCamo123$" ... }
```

### Root Cause
Looking at `app/api/webhooks/analytics/route.ts` (lines 19-26), the authorization check compares `body.api_key` against `process.env.APP_PASSWORD`. The issue is either:
1. `APP_PASSWORD` is not set in the Cloud Run environment
2. The API key being sent doesn't match what's configured

### Fix Strategy
1. Add diagnostic logging to help identify the mismatch
2. Add a fallback check mechanism
3. Improve the error response to help debugging without exposing secrets

### Files to Modify
1. `app/api/webhooks/analytics/route.ts`

### Implementation Steps

#### Step 4.1: Improve Auth Diagnostics
Update the auth check block (lines 19-26) to be more diagnostic:

```typescript
// Auth Check - Enhanced diagnostics
const configuredPassword = process.env.APP_PASSWORD;
const providedKey = body.api_key;

// Log config state (not the actual values!)
if (!configuredPassword) {
    logAnalytics('ERROR', 'APP_PASSWORD not configured', {
        requestId,
        hint: 'Set APP_PASSWORD in Cloud Run environment variables or Secret Manager'
    });
    return NextResponse.json({ 
        success: false, 
        error: 'Server configuration error',
        code: 'AUTH_CONFIG_MISSING'
    }, { status: 500 });
}

if (!providedKey) {
    logAnalytics('WARN', 'No api_key provided in request', {
        requestId,
        fields: Object.keys(body).join(',')
    });
    return NextResponse.json({ 
        success: false, 
        error: 'Missing api_key field',
        code: 'AUTH_KEY_MISSING'
    }, { status: 401 });
}

if (providedKey !== configuredPassword) {
    // Log partial key for debugging (first 4 chars only)
    logAnalytics('ERROR', 'API key mismatch', {
        requestId,
        providedKeyPrefix: providedKey.substring(0, 4) + '...',
        configuredKeyPrefix: configuredPassword.substring(0, 4) + '...',
        providedKeyLength: providedKey.length,
        configuredKeyLength: configuredPassword.length
    });
    return NextResponse.json({ 
        success: false, 
        error: 'Invalid API key',
        code: 'AUTH_KEY_INVALID'
    }, { status: 401 });
}

logAnalytics('DEBUG', 'Auth successful', { requestId });
```

#### Step 4.2: Verify Secret Configuration
After deployment, check that `APP_PASSWORD` is properly set in Cloud Run:

```bash
gcloud run services describe lime-sms-web --region us-central1 --project lime-sms-app --format='get(spec.template.spec.containers[0].env)'
```

If it's using Secret Manager, verify the secret exists and has the correct value.

---

## Issue #5: GCP Logging Quota Exhaustion

### Problem
```
8 RESOURCE_EXHAUSTED: Quota exceeded for quota metric 'Read requests' ... of service 'logging.googleapis.com'
```

### Root Cause
1. Excessive verbose logging during sync (logging every single batch and error)
2. No log sampling for high-volume operations
3. Potential external monitoring tools polling logs too frequently

### Fix Strategy
1. Implement log sampling for high-frequency events
2. Reduce sync verbosity
3. Batch error logging instead of individual errors

### Files to Modify
1. `lib/sms-service.ts`
2. Create `lib/log-sampler.ts`

### Implementation Steps

#### Step 5.1: Create Log Sampling Utility
Create `lib/log-sampler.ts`:

```typescript
/**
 * Log Sampler - Reduces log volume for high-frequency events.
 */

type LogCounter = {
    count: number;
    lastFlush: number;
    samples: string[];
};

const counters: Map<string, LogCounter> = new Map();
const FLUSH_INTERVAL_MS = 30000; // 30 seconds
const MAX_SAMPLES = 5;

/**
 * Samples logs to reduce volume. 
 * - First occurrence: always logs
 * - Subsequent: batches and flushes periodically
 * 
 * @param category - Log category (e.g., 'sync_error', 'enrichment_fail')
 * @param message - Individual log message
 * @param logger - Logger function (defaults to console.warn)
 */
export function sampledLog(
    category: string,
    message: string,
    logger: (msg: string) => void = console.warn
): void {
    const now = Date.now();
    
    if (!counters.has(category)) {
        counters.set(category, { count: 0, lastFlush: now, samples: [] });
        // First occurrence - log immediately
        logger(message);
        return;
    }
    
    const counter = counters.get(category)!;
    counter.count++;
    
    // Keep some samples for context
    if (counter.samples.length < MAX_SAMPLES) {
        counter.samples.push(message);
    }
    
    // Flush if interval elapsed
    if (now - counter.lastFlush > FLUSH_INTERVAL_MS) {
        logger(`[Batched] ${category}: ${counter.count} events in last ${Math.round((now - counter.lastFlush) / 1000)}s. Samples: ${counter.samples.slice(0, 3).join(' | ')}`);
        counter.count = 0;
        counter.lastFlush = now;
        counter.samples = [];
    }
}

/**
 * Forces flush of all pending sampled logs.
 * Call this at end of major operations.
 */
export function flushSampledLogs(): void {
    const now = Date.now();
    
    counters.forEach((counter, category) => {
        if (counter.count > 0) {
            console.log(`[Batched Summary] ${category}: ${counter.count} total events. Last samples: ${counter.samples.join(' | ')}`);
        }
    });
    
    counters.clear();
}
```

#### Step 5.2: Use Sampled Logging in Sync
Update `lib/sms-service.ts` to use sampled logging:

```typescript
// Add import at top
import { sampledLog, flushSampledLogs } from './log-sampler';

// In syncSubscribers, replace individual error logs with sampled version:

// Change this (around line 88):
console.warn(`Sync: Error enriching phone ${phone}:`, e);

// To this:
sampledLog('enrichment_error', `Sync: Error enriching phone ${phone}: ${(e as Error).message}`);

// Change this (around line 119):
console.error(`Sync: Error processing lead ${lead.MobileNumber}:`, err.message);

// To this:
sampledLog('lead_processing_error', `Sync: Error processing lead ${lead.MobileNumber}: ${err.message}`, console.error);

// At end of syncSubscribers (before "Sync: Completed"), add:
flushSampledLogs();
```

#### Step 5.3: Reduce Batch Logging Verbosity
In `syncSubscribers`, change batch logging from every batch to every 500:

```typescript
// Change (around line 42):
console.log(`Sync: Processing batch ${i} to ${i + chunk.length}...`);

// To:
if (i % 500 === 0 || i === 0) {
    console.log(`Sync: Processing batch ${i} to ${i + chunk.length}... (${Math.round(i / leads.length * 100)}% complete)`);
}
```

Similarly in `processQueue`, reduce logging frequency:

```typescript
// Change (around line 167):
console.log(`Processing Queue: Fetching batch of ${BATCH_SIZE} from ID > ${lastId}`);

// To (only log every 5th batch):
if (lastId === 0 || lastId % 2500 === 0) {
    console.log(`Processing Queue: Fetching batch of ${BATCH_SIZE} from ID > ${lastId}`);
}
```

---

## Deployment Checklist

### Pre-Deployment
- [ ] Run `npm run build` locally to verify no compile errors
- [ ] Review all changed files
- [ ] Ensure `.env` has `DATABASE_URL` with connection pool params locally

### Deployment Steps
1. **Update Secret Manager** (DATABASE_URL with pool params):
   ```bash
   # View current secret
   gcloud secrets versions access latest --secret=DATABASE_URL --project=lime-sms-app
   
   # Create new version with pool params
   echo -n 'postgresql://...<your-url>...?connection_limit=10&pool_timeout=30' | \
     gcloud secrets versions add DATABASE_URL --data-file=- --project=lime-sms-app
   ```

2. **Verify APP_PASSWORD secret exists**:
   ```bash
   gcloud secrets describe APP_PASSWORD --project=lime-sms-app
   ```

3. **Deploy to Cloud Run**:
   ```bash
   # Build and deploy (from project root)
   gcloud builds submit --config cloudbuild.yaml --project lime-sms-app
   ```

4. **Force new revision to pick up secret changes**:
   ```bash
   gcloud run services update lime-sms-worker --region us-central1 --project lime-sms-app
   gcloud run services update lime-sms-web --region us-central1 --project lime-sms-app
   ```

### Post-Deployment Verification
1. **Check worker logs for reduced error volume**:
   ```bash
   gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=lime-sms-worker" --limit 50 --project lime-sms-app --format="table(timestamp,textPayload)"
   ```

2. **Check for successful config loading**:
   ```bash
   gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=lime-sms-worker AND textPayload:getAppConfig" --limit 10 --project lime-sms-app
   ```

3. **Verify analytics auth is working** (if you have test traffic):
   ```bash
   gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=lime-sms-web AND textPayload:Auth" --limit 20 --project lime-sms-app
   ```

---

## Summary of Files Changed

| File | Changes |
|------|---------|
| `lib/sms-service.ts` | Safe phone parsing, fallback timezone, reduced concurrency, sampled logging |
| `lib/prisma.ts` | Enhanced Prisma client config with graceful shutdown |
| `lib/db-utils.ts` | **NEW** - Database retry utility |
| `lib/log-sampler.ts` | **NEW** - Log volume reduction utility |
| `lib/config-service.ts` | Use retry wrapper for DB operations |
| `app/api/webhooks/analytics/route.ts` | Enhanced auth diagnostics |
| `DATABASE_URL` (Secret) | Add connection pool parameters |

---

## Risk Assessment

| Change | Risk Level | Rollback Strategy |
|--------|------------|-------------------|
| Phone parsing changes | Low | Revert `sms-service.ts` |
| Prisma config | Medium | Revert `prisma.ts` and redeploy |
| Analytics auth | Low | Behavior change only, no data impact |
| Log sampling | Low | Remove imports and sampled calls |

---

## Notes

- **Database Migrations**: No schema changes required for these fixes.
- **Downtime**: No downtime expected; these are code-only changes.
- **Testing**: Recommend testing sync locally with a small list first using `npx tsx scripts/test-sync.ts` (if available) or triggering manually from the UI.
