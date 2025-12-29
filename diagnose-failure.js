
const { PrismaClient } = require('@prisma/client');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');

dayjs.extend(utc);
dayjs.extend(timezone);

const prisma = new PrismaClient();

async function diagnose() {
    console.log('--- Diagnosing Anomalous Sends ---');

    // Look for logs from yesterday evening (approx 5pm - 7pm EST)
    // 2025-12-28
    const startWindow = dayjs('2025-12-28T17:00:00-05:00').toDate();
    const endWindow = dayjs('2025-12-28T19:00:00-05:00').toDate();

    const logs = await prisma.sentLog.findMany({
        where: {
            sentAt: {
                gte: startWindow,
                lte: endWindow
            }
        },
        include: {
            subscriber: true
        }
    });

    console.log(`Found ${logs.length} messages sent between 5pm and 7pm EST yesterday.`);

    let anomalies = 0;
    for (const log of logs) {
        if (!log.subscriber) continue;
        const sub = log.subscriber;
        const sentAt = dayjs(log.sentAt).tz('America/New_York'); // Log time in EST

        // We want to see if the user is West Coast
        const subTz = sub.timezone || 'NULL';

        // If user is Los_Angeles, this time (17:00-19:00 EST) is 14:00-16:00 PST.
        // If the schedule was meant for 17:00 (5pm), it shouldn't have sent at 14:00.

        if (subTz === 'America/Los_Angeles' || subTz === 'America/Vancouver' || subTz === 'America/Tijuana') {
            console.log(`[ANOMALY?] Sent to ${sub.phone} (${subTz}) at ${sentAt.format('HH:mm')} EST`);
            anomalies++;
        }
    }

    if (anomalies === 0) {
        console.log("No obvious West Coast anomalies found in this window. Maybe check timezone data?");
    }

    // Also randomly check a few west coast numbers to see if their TZ is actually set
    const westCoastSample = await prisma.subscriber.findFirst({
        where: { timezone: 'America/Los_Angeles' }
    });
    console.log(`\nSample West Coast User: ${westCoastSample ? westCoastSample.phone : 'NONE FOUND'}`);

    await prisma.$disconnect();
}

diagnose();
