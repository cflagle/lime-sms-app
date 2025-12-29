
import { PrismaClient } from '@prisma/client';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import { SmsService } from '../lib/sms-service';

dayjs.extend(utc);
dayjs.extend(timezone);

const prisma = new PrismaClient();

async function main() {
    console.log("Starting Verification of Daily Limits & Cooldowns...");

    // 1. Setup Data
    const phone = '9991234567';
    await prisma.sentLog.deleteMany({ where: { subscriber: { phone } } });
    await prisma.subscriber.deleteMany({ where: { phone } });

    // Ensure we have active messages for both brands
    const msgWSWD = await prisma.message.upsert({
        where: { name: 'TEST_WSWD_LIMIT' },
        update: { active: true, brand: 'WSWD', cooldownDays: 14 },
        create: { name: 'TEST_WSWD_LIMIT', content: 'Test WSWD', brand: 'WSWD', cooldownDays: 14 }
    });

    const msgTA = await prisma.message.upsert({
        where: { name: 'TEST_TA_LIMIT' },
        update: { active: true, brand: 'TA', cooldownDays: 14 },
        create: { name: 'TEST_TA_LIMIT', content: 'Test TA', brand: 'TA', cooldownDays: 14 }
    });

    const sub = await prisma.subscriber.create({
        data: {
            phone,
            status: 'ACTIVE',
            subscribe_wswd: true,
            subscribe_ta: true,
            timezone: 'America/New_York'
        }
    });

    // 2. Simulate User hitting Limit for WSWD but NOT TA
    // Assume Limit is 2 per day.
    // Create 2 sent logs for WSWD today.
    await prisma.sentLog.createMany({
        data: [
            { subscriberId: sub.id, messageId: msgWSWD.id, brand: 'WSWD', sentAt: new Date() },
            { subscriberId: sub.id, messageId: msgWSWD.id, brand: 'WSWD', sentAt: new Date() }
        ]
    });

    console.log("Seeded 2 WSWD logs. Limit is 2.");

    // 3. Test Selection
    // We expect WSWD to be blocked, but TA to be allowed.
    // NOTE: This requires access to private/protected methods if we want to unit test isolation, 
    // but we can test via public `processQueue` if we mock config, OR we can temporarily make methods public.
    // For this script to work with the current private class structure, we can verify via `diagnose-eligibility.js` style inspection
    // or we can modify the class to be friendlier. 
    // better strategy: We will use a modified copy of the selection logic HERE to verify expectations vs actual if we can't access it.
    // actually, let's just run the code that we are about to modify. Since we can't easily call private methods, 
    // I'll rely on reading the queue processing logs or making a temporary public wrapper?
    // Let's modify SmsService to export its logic or use `sentLogs` inspection after a run.

    // Actually, `processQueue` runs the logic. Let's run `isEligibleToReceive` (public static).
    // WAIT, `selectMessageFor` is private. 

    // I will modify `SmsService` to make `selectMessageFor` public for testing, or add a debug method.
    // For now, I'll rely on the implementation plan to simply open up the method or use `// @ts-ignore` if it's just TS private.
    // Runtime private (#) is hard, but TS private is accessible in JS.

    // Mock Config
    const config = {
        dailyLimitPerUser: 2,
        sendingEnabled: true,
        testMode: false
    };

    // Reload sub with logs
    const subWithLogs = await prisma.subscriber.findUnique({
        where: { id: sub.id },
        include: { sentLogs: { where: { sentAt: { gte: dayjs().startOf('day').toDate() } } } }
    });

    // We can't easily test `selectMessageFor` from outside without reflection or changing visibility.
    // Let's change visibility in the main file as part of the refactor (to public or internal).

    // For this script, I will try to invoke it assuming I'll change it to public.
    // @ts-ignore
    const selectedMsg = await SmsService.selectMessageFor(subWithLogs, config); // Pass config if we change signature

    if (selectedMsg) {
        console.log(`Selected Message Brand: ${selectedMsg.brand}`);
        if (selectedMsg.brand === 'WSWD') {
            console.error("FAIL: Selected WSWD despite limit reached!");
        } else if (selectedMsg.brand === 'TA') {
            console.log("PASS: Selected TA (WSWD limited).");
        }
    } else {
        console.log("Result: NULL (Only fail if TA should have been picked)");
        // If TA is valid, this is a fail unless TA was also filtered out (e.g. cooldown).
        // TA Cooldown? we didn't send TA yet.
        console.error("FAIL: Should have selected TA.");
    }

    // Cleanup
    await prisma.sentLog.deleteMany({ where: { subscriber: { phone } } });
    await prisma.subscriber.deleteMany({ where: { phone } });
    await prisma.message.delete({ where: { name: 'TEST_WSWD_LIMIT' } });
    await prisma.message.delete({ where: { name: 'TEST_TA_LIMIT' } });
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
