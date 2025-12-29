
import { PrismaClient } from '@prisma/client';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import { SmsService } from '../lib/sms-service';

dayjs.extend(utc);
dayjs.extend(timezone);

const prisma = new PrismaClient();

async function main() {
    console.log("Starting Verification of BRAND-SPECIFIC Limits...");

    // 1. Setup Data
    const phone = '9998887777';
    await prisma.sentLog.deleteMany({ where: { subscriber: { phone } } });
    await prisma.subscriber.deleteMany({ where: { phone } });

    // Ensure we have active messages for both brands
    await prisma.message.upsert({
        where: { name: 'TEST_WSWD' },
        update: { active: true, brand: 'WSWD', cooldownDays: 0 },
        create: { name: 'TEST_WSWD', content: 'Test WSWD', brand: 'WSWD', cooldownDays: 0 }
    });

    await prisma.message.upsert({
        where: { name: 'TEST_TA' },
        update: { active: true, brand: 'TA', cooldownDays: 0 },
        create: { name: 'TEST_TA', content: 'Test TA', brand: 'TA', cooldownDays: 0 }
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

    // Mock Config: WSWD Limit = 1, TA Limit = 3
    const config = {
        dailyLimitWSWD: 1,
        dailyLimitTA: 3,
        minIntervalMinutes: 0,
        sendingEnabled: true,
        testMode: false
    };

    console.log(`Config: WSWD Limit=${config.dailyLimitWSWD}, TA Limit=${config.dailyLimitTA}`);

    // 2. Simulate User hitting Limit for WSWD (1 sent)
    const msgWSWD = await prisma.message.findUniqueOrThrow({ where: { name: 'TEST_WSWD' } });

    await prisma.sentLog.create({
        data: { subscriberId: sub.id, messageId: msgWSWD.id, brand: 'WSWD', sentAt: new Date() }
    });
    console.log("Seeded 1 WSWD log.");

    // Reload sub with logs
    const subWithLogs = await prisma.subscriber.findUnique({
        where: { id: sub.id },
        include: { sentLogs: { where: { sentAt: { gte: dayjs().startOf('day').toDate() } } } }
    });

    // 3. Test Selection: Should ONLY pick TA
    // @ts-ignore
    const selectedMsg = await SmsService.selectMessageFor(subWithLogs, config);

    if (selectedMsg) {
        console.log(`Selected Message Brand: ${selectedMsg.brand}`);
        if (selectedMsg.brand === 'WSWD') {
            console.error("FAIL: Selected WSWD despite limit reached!");
        } else if (selectedMsg.brand === 'TA') {
            console.log("PASS: Selected TA (WSWD limited).");
        } else {
            console.error(`FAIL: Selected unknown brand ${selectedMsg.brand}`);
        }
    } else {
        console.error("FAIL: Should have selected TA, but got NULL.");
    }

    // Cleanup
    await prisma.sentLog.deleteMany({ where: { subscriber: { phone } } });
    await prisma.subscriber.deleteMany({ where: { phone } });
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
