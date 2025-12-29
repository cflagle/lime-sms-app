const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
dayjs.extend(utc);
dayjs.extend(timezone);

async function testSchedule() {
    console.log("Setting up test...");

    // 1. Set Config: Limit 2, Schedule = "NOW"
    const now = dayjs();
    const timeStr = now.format('HH:mm');
    console.log(`Current Time: ${timeStr}`);

    // Set schedule to NOW and NOW+20mins (both should be valid if we test one by one)
    const phone = '14438049313';
    const sub = await prisma.subscriber.findUnique({ where: { phone } });
    if (!sub) { console.log("No sub found."); return; }

    console.log("Updating Config...");
    const config = await prisma.appConfig.findFirst();
    await prisma.appConfig.update({
        where: { id: config.id },
        data: {
            sendingEnabled: true,
            testMode: true,
            dailyLimitPerUser: 2,
            sendTimes: timeStr
        }
    });

    // 2. Clear logs
    console.log("Clearing logs...");
    await prisma.sentLog.deleteMany({ where: { subscriberId: sub.id } });

    // 3. Run SmsService Check (We need to import or mock. easier to run the full script)
    // We will just run the worker script
}

testSchedule().then(() => {
    console.log("Setup Complete. Run 'node debug-worker.js' (or equivalent) to test.");
});
