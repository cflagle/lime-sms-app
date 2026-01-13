/**
 * Log Sampler - Reduces log volume for high-frequency events.
 * Batches similar logs and flushes them periodically to prevent quota exhaustion.
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
        counters.set(category, { count: 1, lastFlush: now, samples: [message] });
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
        const elapsed = Math.round((now - counter.lastFlush) / 1000);
        logger(`[Batched] ${category}: ${counter.count} events in last ${elapsed}s. Samples: ${counter.samples.slice(0, 3).join(' | ')}`);
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
    counters.forEach((counter, category) => {
        if (counter.count > 0) {
            console.log(`[Batched Summary] ${category}: ${counter.count} total events. Last samples: ${counter.samples.join(' | ')}`);
        }
    });

    counters.clear();
}
