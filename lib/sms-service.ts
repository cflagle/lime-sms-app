import { Subscriber, Message, SentLog } from '@prisma/client';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
// @ts-ignore
import { parsePhoneNumber } from 'libphonenumber-js';
import { AREA_CODE_TIMEZONES } from './area-codes';
import { LimeClient } from './lime-client';
import { prisma } from './prisma';
import { getAppConfig } from './config-service';
import { SegmentationService } from './segmentation-service';

dayjs.extend(utc);
dayjs.extend(timezone);


export class SmsService {

    /**
     * Syncs subscribers from Lime Cellular Lists.
     * This should be called periodically.
     */
    static async syncSubscribers() {
        try {
            console.log("Sync: Starting subscriber sync from Lime...");

            // Fetch from Lime using the Configured List ID
            const config = await getAppConfig();
            const listId = config.limeListId || '135859';
            console.log(`Sync: Fetching from Lime List ID: ${listId}`);

            const leads = await LimeClient.getOptedInNumbers(listId);

            console.log(`Sync: Found ${leads.length} subscribers on Lime.`);

            // Process in batches of 50 to avoid timeouts and improve speed
            const BATCH_SIZE = 50;
            let processed = 0;

            // Manual Skip Logic (Threshold)
            let startIndex = 0;
            if (config.syncSkip && config.syncSkip > 0) {
                console.log(`Sync: Skipping first ${config.syncSkip} contacts as requested.`);
                startIndex = config.syncSkip;
            }

            for (let i = startIndex; i < leads.length; i += BATCH_SIZE) {
                const chunk = leads.slice(i, i + BATCH_SIZE);
                console.log(`Sync: Processing batch ${i} to ${i + chunk.length}...`);

                await Promise.all(chunk.map(async (lead: any) => {
                    try {
                        // Map XML fields (PascalCase) to our DB fields
                        const phone = lead.MobileNumber;
                        if (!phone) return;

                        // Status isn't explicitly in the XML list, but if they are in the "Opted In" list, they are ACTIVE.
                        const status = 'ACTIVE';

                        const name = `${lead.FirstName || ''} ${lead.LastName || ''}`.trim() || 'Subscriber';
                        const firstName = lead.FirstName || '';
                        const lastName = lead.LastName || '';
                        const email = lead.Email;
                        const keywordRaw = (lead.Keyword || '').toUpperCase();

                        // Logic to set permissions based on Keyword
                        const subscribe_wswd = keywordRaw.includes('STOCK');
                        const subscribe_ta = keywordRaw.includes('TRADE');
                        const enableFallback = (!subscribe_wswd && !subscribe_ta);

                        // JIT Timezone derivation
                        let tz = 'America/New_York';
                        try {
                            const phoneNumber = parsePhoneNumber(String(phone), 'US');
                            if (phoneNumber && (phoneNumber.country === 'US' || phoneNumber.country === 'CA')) {
                                const national = phoneNumber.nationalNumber as string;
                                const areaCode = national.substring(0, 3);
                                if (AREA_CODE_TIMEZONES[areaCode]) {
                                    tz = AREA_CODE_TIMEZONES[areaCode];
                                }
                            }
                        } catch (e) { }

                        await prisma.subscriber.upsert({
                            where: { phone: String(phone) },
                            update: {
                                status: status,
                                subscribe_wswd: subscribe_wswd || enableFallback,
                                subscribe_ta: subscribe_ta || enableFallback,
                                timezone: tz,
                                firstName: firstName,
                                lastName: lastName
                            },
                            create: {
                                phone: String(phone),
                                name: name,
                                firstName: firstName,
                                lastName: lastName,
                                email: email,
                                status: status,
                                subscribe_wswd: subscribe_wswd || enableFallback,
                                subscribe_ta: subscribe_ta || enableFallback,
                                timezone: tz
                            }
                        });
                    } catch (err: any) {
                        console.error(`Sync: Error processing lead ${lead.MobileNumber}:`, err.message);
                    }
                }));

                processed += chunk.length;
                // Periodic logging
                if (processed % 1000 === 0) {
                    console.log(`Sync: Processed ${processed}/${leads.length} subscribers.`);
                }
            }
            console.log("Sync: Completed.");
        } catch (e: any) {
            console.error("Sync error:", e.message);
        }
    }


    /**
     * Main processing loop.
     */
    static async processQueue() {
        console.log("Processing SMS Queue...");

        const config = await getAppConfig();

        if (!config.sendingEnabled) {
            console.log("Processing Queue: Sending is DISABLED globally.");
            return;
        }

        // GLOBAL SAFETY CAP CHECK
        if (config.globalDailyCap && config.globalDailyCap > 0) {
            const startOfDay = dayjs().startOf('day').toDate();
            const sentTodayCount = await prisma.sentLog.count({
                where: { sentAt: { gte: startOfDay } }
            });

            if (sentTodayCount >= config.globalDailyCap) {
                console.warn(`Processing Queue: GLOBAL SAFETY CAP REACHED (${sentTodayCount}/${config.globalDailyCap}). Stopping.`);
                return;
            }
        }

        // 1. Get all active subscribers using CURSOR PAGINATION
        let lastId = config.queueMinId || 0;
        if (lastId > 0) console.log(`Processing Queue: Starting from ID > ${lastId} (Manual Override)`);
        const BATCH_SIZE = 500;

        while (true) {
            console.log(`Processing Queue: Fetching batch of ${BATCH_SIZE} from ID > ${lastId}`);

            const subscribers = await prisma.subscriber.findMany({
                where: {
                    status: 'ACTIVE',
                    id: { gt: lastId }
                },
                take: BATCH_SIZE,
                orderBy: { id: 'asc' },
                include: {
                    sentLogs: {
                        where: { sentAt: { gte: dayjs().subtract(30, 'day').toDate() } },
                        orderBy: { sentAt: 'desc' }
                    }
                }
            });

            if (subscribers.length === 0) {
                break; // Done
            }

            // Update Cursor for next batch
            lastId = subscribers[subscribers.length - 1].id;

            // 2. Filter for Test Mode (Optimization: Filter in-memory for the batch)
            let batchToProcess = subscribers;
            if (config.testMode) {
                const allowedNumbers = config.testNumbers.split(',').map(n => n.trim());
                batchToProcess = subscribers.filter(s => allowedNumbers.includes(s.phone));
            }

            // 3. Segmentation Filter
            if (config.activeSegmentId) {
                const segment = await prisma.segment.findUnique({ where: { id: config.activeSegmentId } });
                if (segment && segment.isActive) {
                    batchToProcess = batchToProcess.filter(sub =>
                        SegmentationService.checkEligibility(sub, segment.rules)
                    );
                }
            }

            console.log(`Processing Queue: Processing ${batchToProcess.length} eligible in this batch...`);

            for (const sub of batchToProcess) {
                // Re-check global cap periodically within batch? 
                // For perf, checking every message is slow. Checking per batch is safer.
                // We checked at start. Let's rely on that for now unless batch is huge.

                if (!this.isEligibleToReceive(sub, config)) continue;

                const message = await this.selectMessageFor(sub, config);
                if (message) {
                    await this.sendMessage(sub, message, config);
                }
            }

            // Small yield to allow other IO/events
            await new Promise(r => setTimeout(r, 100));
        }
    }


    /**
     * Checks if subscriber is eligible to receive a message RIGHT NOW.
     * Rules: 8am-8pm local time, Max N/day, Engagement Window.
     */
    public static isEligibleToReceive(sub: any, config: any): boolean {
        const now = dayjs();

        // Timezone 
        // If we don't have TZ, try to derive from phone
        let tz = sub.timezone;
        if (!tz && sub.phone) {
            try {
                // Remove + if present for parsing, though library handles it.
                // Assuming standard E.164 or national format
                const phoneNumber = parsePhoneNumber(sub.phone, 'US');
                if (phoneNumber && (phoneNumber.country === 'US' || phoneNumber.country === 'CA')) {
                    // Extract Area Code (National Number first 3 digits)
                    const national = phoneNumber.nationalNumber as string; // e.g. 2125551234
                    const areaCode = national.substring(0, 3);
                    if (AREA_CODE_TIMEZONES[areaCode]) {
                        tz = AREA_CODE_TIMEZONES[areaCode];
                    }
                }
            } catch (e) {
                // console.error("Error parsing phone for TZ", e);
            }

            if (!tz) tz = "America/New_York"; // Default fallback
        }

        const localTime = now.tz(tz);
        const hour = localTime.hour();

        // 8am to 8pm check
        if (hour < 8 || hour >= 20) return false;

        // Daily Cap Logic REMOVED (Moved to selectMessageFor)
        // Check remain for Schedule/Pacing
        const startOfDay = localTime.startOf('day').toDate();
        const sentToday = sub.sentLogs.filter((l: any) => l.sentAt >= startOfDay);

        // if (sentToday.length >= dailyLimit) return false; // <-- OLD GLOBAL CHECK

        // Minimum Interval Check (Global)
        if (config.minIntervalMinutes && config.minIntervalMinutes > 0) {
            // Find the very last message sent to this user (ever, or at least today? User said "since last message")
            // sentLogs in 'sub' might only be today's logs depending on query. configuration.
            // processQueue fetches: include: { sentLogs: { orderBy: { sentAt: 'desc' }, take: 10 } }
            // So we have the last 10 logs.
            if (sub.sentLogs && sub.sentLogs.length > 0) {
                const lastSentLog = sub.sentLogs[0]; // Ordered by desc
                const lastSentTime = dayjs(lastSentLog.sentAt);
                const minutesSince = now.diff(lastSentTime, 'minute');

                if (minutesSince < config.minIntervalMinutes) {
                    // console.log(`Ineligible: Min Interval ${config.minIntervalMinutes}m not met. Time since: ${minutesSince}m`);
                    return false;
                }
            }
        }

        // Scheduled Send Times Rule
        // If times are configured, we MUST match one of them (+/- 30 mins)
        // AND not have sent for that slot today.
        // Scheduled Send Times Rule
        // Logic: Return TRUE if current time matches ANY configured schedule (WSWD or TA).
        // Specific brand matching happens in selectMessageFor.
        const allSchedules = [
            ...(config.sendTimesWSWD || '').split(','),
            ...(config.sendTimesTA || '').split(',')
        ].map(t => t.trim()).filter(Boolean);

        if (allSchedules.length > 0) {
            const currentMinute = hour * 60 + localTime.minute(); // Minutes from midnight
            let matchedSlot = false;

            for (const timeStr of allSchedules) {
                const [h, m] = timeStr.split(':').map(Number);
                if (isNaN(h) || isNaN(m)) continue;

                const slotMinute = h * 60 + m;
                const diff = Math.abs(currentMinute - slotMinute);

                // Tolerance: +/- 3 mins
                if (diff <= 3) {
                    // Check if ANY log today matches this slot window
                    // NOTE: This checks if *any* message was sent in this slot. 
                    // If we want allow sending 1 WSWD AND 1 TA in the same slot, we should refine this to be brand-aware
                    // but isEligibleToReceive is a pre-filter. 
                    // Let's be permissive here: If slot matches time, allow passing. 
                    // selectMessageFor will filter if that brand already sent for this slot?
                    // Actually, to prevent double-send in same slot if we run 2x in 3 mins:
                    // We need to check if we sent *anything* recently? 
                    // Let's rely on the check inside loop:

                    const alreadySentForSlot = sentToday.some((log: any) => {
                        const logTime = dayjs(log.sentAt).tz(tz);
                        const logMinute = logTime.hour() * 60 + logTime.minute();
                        return Math.abs(logMinute - slotMinute) <= 45; // Buffer
                    });

                    // Wait, if I want to send WSWD @ 9:00 and TA @ 9:00, 
                    // alreadySentForSlot will be true after the first one sends.
                    // This blocks the second one in the same slot.
                    // FIX: We need to allow if we haven't sent for *at least one* available brand?
                    // But here we don't know which brand we will pick.
                    // Strategy: Allow if we haven't maxed out daily limits? 
                    // Schedule check is about "Is it the right time?". 
                    // If we have distinct schedules, this is fine. 
                    // If we have OVERLAPPING schedules (both @ 9am), we might only send one per day per slot due to this logic.
                    // For MVP, assuming non-overlapping or sequential processing is acceptable.

                    if (!alreadySentForSlot) {
                        matchedSlot = true;
                        break;
                    }
                }
            }

            if (!matchedSlot) return false;
        } else {
            // Default "Greedy" Pacing (only if NO schedule set)
            // Daily Cap is already checked above.
            // Pacing (1h gap) - fallback if minInterval NOT set?
            // If minInterval IS set, we already checked it above, so we don't need this default 1h gap.
            // If minInterval IS NOT set (0), then we keep this default 1h rule?
            if ((!config.minIntervalMinutes || config.minIntervalMinutes === 0) && sentToday.length > 0) {
                const lastSent = dayjs(sentToday[0].sentAt);
                if (now.diff(lastSent, 'hour') < 1) return false;
            }
        }

        // Engagement Window Rule (Global)
        if (config.engagementWindowEnabled) {
            const windowDays = config.engagementWindowDays || 90;
            const lastActive = sub.last_engagement ? dayjs(sub.last_engagement) : dayjs(sub.createdAt);

            const daysSinceEngage = now.diff(lastActive, 'day');
            if (daysSinceEngage > windowDays) return false;
        }

        return true;
    }


    public static async selectMessageFor(sub: any, config?: any) {
        // config is optional? It should be passed for limits.
        if (!config) config = await getAppConfig();

        // 1. Check Brand Limits
        const tz = sub.timezone || 'America/New_York';
        const startOfDay = dayjs().tz(tz).startOf('day').toDate();
        const sentToday = sub.sentLogs.filter((l: any) => l.sentAt >= startOfDay);

        const dailyLimit = config.dailyLimitPerUser || 2;

        // Determine allowed brands based on SUBSCRIPTION and LIMITS
        const brands = [];

        // Check WSWD
        if (sub.subscribe_wswd) {
            const sentWSWD = sentToday.filter((l: any) => l.brand === 'WSWD').length;
            const limitWSWD = config.dailyLimitWSWD || 2;

            // Schedule Check for WSWD
            let scheduleMatch = true;
            const schedulesWSWD = (config.sendTimesWSWD || '').split(',').map((t: string) => t.trim()).filter(Boolean);
            if (schedulesWSWD.length > 0) {
                const nowMinute = dayjs().tz(tz).hour() * 60 + dayjs().tz(tz).minute();
                scheduleMatch = schedulesWSWD.some((timeStr: string) => {
                    const [h, m] = timeStr.split(':').map(Number);
                    if (isNaN(h) || isNaN(m)) return false;
                    const slotMinute = h * 60 + m;
                    return Math.abs(nowMinute - slotMinute) <= 1; // 1 min tolerance
                });
            }

            if (sentWSWD < limitWSWD && scheduleMatch) {
                brands.push('WSWD');
            }
        }

        // Check TA
        if (sub.subscribe_ta) {
            const sentTA = sentToday.filter((l: any) => l.brand === 'TA').length;
            const limitTA = config.dailyLimitTA || 2;

            // Schedule Check for TA
            let scheduleMatch = true;
            const schedulesTA = (config.sendTimesTA || '').split(',').map((t: string) => t.trim()).filter(Boolean);
            if (schedulesTA.length > 0) {
                const nowMinute = dayjs().tz(tz).hour() * 60 + dayjs().tz(tz).minute();
                scheduleMatch = schedulesTA.some((timeStr: string) => {
                    const [h, m] = timeStr.split(':').map(Number);
                    if (isNaN(h) || isNaN(m)) return false;
                    const slotMinute = h * 60 + m;
                    return Math.abs(nowMinute - slotMinute) <= 1; // 1 min tolerance
                });
            }

            if (sentTA < limitTA && scheduleMatch) {
                brands.push('TA');
            }
        }

        // console.log(`DEBUG: Sub ${sub.phone} brands: ${brands.join(',')}`);

        if (brands.length === 0) return null;

        const messages = await prisma.message.findMany({
            where: {
                active: true,
                brand: { in: brands }
            },
            include: { campaign: true }
        });

        // console.log(`DEBUG: Found ${messages.length} messages for brands.`);

        // Shuffle messages to random pick
        const shuffled = messages.sort(() => 0.5 - Math.random());

        for (const msg of shuffled) {
            // Check History: Has user seen this recently?
            // OPTIMIZATION: Check in-memory logs instead of DB query
            const cooldownDate = dayjs().subtract(msg.cooldownDays, 'day').toDate();

            const hasSeen = sub.sentLogs.some((l: any) =>
                l.messageId === msg.id && new Date(l.sentAt) >= cooldownDate
            );

            if (hasSeen) {
                // console.log(`DEBUG: Skipping msg ${msg.id} (Cooldown)`);
                continue;
            }

            // Check Campaign caps
            if (msg.campaign) {
                // Count sends for this campaign to this user in last week
                const startOfWeek = dayjs().startOf('week').toDate();
                const campaignsSent = await prisma.sentLog.count({
                    where: {
                        subscriberId: sub.id,
                        message: { campaignId: msg.campaignId },
                        sentAt: { gte: startOfWeek }
                    }
                });

                if (campaignsSent >= msg.campaign.maxImpressionsPerWeek) {
                    // console.log(`DEBUG: Skipping msg ${msg.id} (Campaign Cap)`);
                    continue;
                }
            }

            return msg;
        }

        // console.log("DEBUG: No suitable message found.");
        return null;
    }

    private static async sendMessage(sub: any, msg: any, config?: any) {
        console.log(`Sending message ${msg.id} to ${sub.phone} (${sub.name})`);

        if (!config) config = await getAppConfig();

        // SAFETY CHECK: Verify Opt-in Status with Lime (If NOT Dry Run)
        // If Dry Run, we optionally skip this to be faster/freer, but usually good to check?
        // Let's respect Dry Run even for this check if we want to save API calls?
        // Or if we want to simulate accurately, we should check it. CheckStatus is cheap/free? 
        // User said "simulate sending". Let's skip the SAFETY check API call too if we want zero API hits.
        // But the user's main concern is "Safety Cap" preventing "Sending". 
        // Let's default to performing the check UNLESS in dry run?
        // Actually, if we are in Dry Run, we might want to test the logic exactly.
        // But if we want to test 10k numbers without hitting Lime, we should skip 10k API calls.

        let canSend = true;
        if (!config.dryRunMode) {
            const isOptedIn = await LimeClient.checkOptInStatus(sub.phone);
            if (!isOptedIn) {
                console.warn(`[Safety Block] ${sub.phone} is NOT active in Lime. Marking as OPTOUT.`);
                await prisma.subscriber.update({
                    where: { id: sub.id },
                    data: { status: 'OPTOUT' }
                });
                return;
            }
        } else {
            console.log(`[Dry Run] Skipping Lime Opt-in Check for ${sub.phone}`);
        }

        const finalContent = msg.content;

        try {
            if (config.dryRunMode) {
                console.log(`[DRY RUN] Would send SMS to ${sub.phone}: "${finalContent}"`);
            } else {
                await LimeClient.sendSMS(sub.phone, finalContent);
            }

            // Always log to DB to simulate "Sent" status and test capping logic
            await prisma.sentLog.create({
                data: {
                    subscriberId: sub.id,
                    messageId: msg.id,
                    brand: msg.brand
                }
            });
        } catch (e) {
            console.error("Send failed", e);
        }
    }

    /**
     * Sends a direct message to a phone number immediately.
     * Bypasses some scheduling rules but respects Master Switch.
     */
    static async sendDirectMessage(phone: string, messageId?: number) {
        console.log(`Direct Send: Request for ${phone}`);

        const config = await getAppConfig();
        if (!config.sendingEnabled) {
            throw new Error("Sending is globally disabled in Settings.");
        }

        // 1. Find subscriber with necessary logs for compliance checking
        let sub = await prisma.subscriber.findUnique({
            where: { phone },
            include: {
                sentLogs: {
                    orderBy: { sentAt: 'desc' },
                    take: 20 // Fetch enough logs to check daily limits
                }
            }
        });

        // COMPLIANCE: Strict Opt-in Check
        if (!sub || sub.status !== 'ACTIVE') {
            throw new Error("Compliance Block: Subscriber is not ACTIVE or does not exist.");
        }

        // COMPLIANCE: Safety Checks (Time window, Caps, Gaps)
        // Note: isEligibleToReceive expects 'sentLogs' to be populated.
        // We need to pass config now
        if (!this.isEligibleToReceive(sub, config)) {
            throw new Error("Compliance Block: Message suppressed by safety rules (Time window, Frequency Cap, or Cooldown).");
        }

        // 2. Resolve Message
        let msg: Message | null = null;
        if (messageId) {
            msg = await prisma.message.findUnique({ where: { id: messageId } });
        } else {
            // Pick random active message
            const count = await prisma.message.count({ where: { active: true } });
            if (count > 0) {
                const skip = Math.floor(Math.random() * count);
                const randomMessages = await prisma.message.findMany({
                    where: { active: true },
                    take: 1,
                    skip: skip
                });
                msg = randomMessages[0];
            }
        }

        if (!msg) {
            throw new Error("No active message found to send.");
        }

        // 3. Send
        console.log(`Direct Send: Sending message ${msg.id} to ${phone}`);

        // Prepare content (simple pass-through for now, later we can add personalization if sub exists)
        const content = msg.content;

        await LimeClient.sendSMS(phone, content);

        // 4. Log (Likely won't have subscriberId if not in DB, so we need to handle that)
        // If sub exists, log it. If not, maybe we should upsert a "Guest" sub? 
        // For now, only log if sub exists to avoid constraint errors, or make subscriberId optional? 
        // Schema says subscriberId is Int... checking schema... 
        // Subscriber is @relation. So we MUST have a subscriber ID to log to sentLog.
        // If the number is not in our DB, we can't log to SentLog without creating them.
        // Strategy: If not in DB, skip SentLog (or Create "Anonymous" sub?). 
        // Let's skip SentLog for non-subscribers for this feature to prevent "polluting" the clean list with test numbers.
        if (sub) {
            await prisma.sentLog.create({
                data: {
                    subscriberId: sub.id,
                    messageId: msg.id,
                    brand: msg.brand
                }
            });
        }

        return { success: true, messageId: msg.id };
    }
}
