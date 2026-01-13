/**
 * Unmapped Area Codes Tracker
 * 
 * Persistently logs phone numbers with area codes that are not in our mapping.
 * This allows us to identify gaps in our area code coverage and add new mappings.
 */

import { prisma } from './prisma';

// In-memory cache to avoid logging duplicates within a sync run
const loggedThisSession = new Set<string>();

/**
 * Extracts the area code from a phone number.
 * @param phone - Raw phone number (can be 10 or 11 digits)
 * @returns 3-digit area code or null if invalid
 */
export function extractAreaCode(phone: string | number): string | null {
    const cleaned = String(phone).replace(/\D/g, '');

    if (cleaned.length === 11 && cleaned.startsWith('1')) {
        return cleaned.substring(1, 4);
    } else if (cleaned.length === 10) {
        return cleaned.substring(0, 3);
    }

    return null;
}

/**
 * Logs an unmapped area code to the database for later review.
 * Only logs each area code once per session to prevent spam.
 * 
 * @param phone - The phone number that couldn't be mapped
 * @param areaCode - The extracted area code
 */
export async function logUnmappedAreaCode(phone: string, areaCode: string): Promise<void> {
    // Skip if already logged this session
    if (loggedThisSession.has(areaCode)) {
        return;
    }

    loggedThisSession.add(areaCode);

    try {
        // Upsert to UnmappedAreaCode table - increment count if exists
        await prisma.unmappedAreaCode.upsert({
            where: { areaCode },
            update: {
                count: { increment: 1 },
                lastSeenAt: new Date(),
                samplePhone: phone // Update sample
            },
            create: {
                areaCode,
                count: 1,
                samplePhone: phone,
                lastSeenAt: new Date()
            }
        });

        console.log(`[Area Code Tracking] Logged unmapped area code: ${areaCode} (sample: ${phone})`);
    } catch (error: any) {
        // If the table doesn't exist yet, just log to console
        if (error.code === 'P2021' || error.message?.includes('does not exist')) {
            console.warn(`[Area Code Tracking] Unmapped: ${areaCode} (sample: ${phone}) - Table not yet created`);
        } else {
            console.error(`[Area Code Tracking] Error logging unmapped area code: ${error.message}`);
        }
    }
}

/**
 * Clears the session cache. Call at the start of each sync.
 */
export function resetUnmappedCache(): void {
    loggedThisSession.clear();
}

/**
 * Gets summary of unmapped area codes (for admin UI).
 */
export async function getUnmappedAreaCodeSummary(): Promise<Array<{
    areaCode: string;
    count: number;
    samplePhone: string;
    lastSeenAt: Date;
}>> {
    try {
        return await prisma.unmappedAreaCode.findMany({
            orderBy: { count: 'desc' },
            take: 50
        });
    } catch {
        return [];
    }
}
