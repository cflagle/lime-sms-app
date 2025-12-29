
const { PrismaClient } = require('@prisma/client');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');

dayjs.extend(utc);
dayjs.extend(timezone);

const prisma = new PrismaClient();

async function diagnoseToday() {
    console.log('--- Diagnosing Today 11:40 - 11:50 EST ---');

    // 11:40 AM to 11:50 AM EST Today (2025-12-29)
    const startWindow = dayjs('2025-12-29T11:40:00-05:00').toDate();
    const endWindow = dayjs('2025-12-29T11:50:00-05:00').toDate();

    const logs = await prisma.sentLog.findMany({
        where: {
            sentAt: {
                gte: startWindow,
                lte: endWindow
            }
        },
        include: {
            subscriber: true,
            message: true
        }
    });

    console.log(`Found ${logs.length} messages sent.`);

    for (const log of logs) {
        if (!log.subscriber) continue;
        const sub = log.subscriber;
        const sentAt = dayjs(log.sentAt).tz('America/New_York');

        console.log(`\n[SENT] To: ${sub.phone}`);
        console.log(`  Time: ${sentAt.format('HH:mm:ss')} EST`);
        console.log(`  Sub TZ: ${sub.timezone} (Stored)`);
        console.log(`  Brand: ${log.brand}`);
        console.log(`  Msg: ${log.message?.name} (ID: ${log.messageId})`);
    }

    console.log('\n--- Checking Test Numbers Status ---');
    // List known test numbers to check their current status in DB
    const testPhones = ['14438049313', '14104320520', '14109046084', '12132965329'];
    for (const p of testPhones) {
        const s = await prisma.subscriber.findUnique({ where: { phone: p } });
        console.log(`${p}: ${s ? s.timezone : 'NOT FOUND'} (Active: ${s?.status})`);
    }

    await prisma.$disconnect();
}

diagnoseToday();
