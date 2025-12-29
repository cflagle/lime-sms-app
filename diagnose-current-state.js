const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const dayjs = require('dayjs');

async function diagnose() {
    const numbers = ['14438049313', '14104320520', '14109046084', '2132965329'];
    console.log(`Diagnosing numbers: ${numbers.join(', ')}`);

    // 1. Check Config
    const config = await prisma.appConfig.findFirst();
    console.log(`\nConfig: TestMode=${config.testMode}, SendingEnabled=${config.sendingEnabled}, DailyLimit=${config.dailyLimitPerUser}`);
    console.log(`SendTimes=${config.sendTimes}`);

    const now = new Date();
    console.log(`Current Server Time: ${now.toISOString()} (Local: ${now.toLocaleString()})`);

    // 2. Check Subscribers
    const found = await prisma.subscriber.findMany({
        where: { phone: { in: numbers } },
        include: {
            sentLogs: {
                where: {
                    sentAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } // Today
                }
            }
        }
    });

    console.log(`\nFound ${found.length} subscribers:`);
    found.forEach(s => {
        console.log(`[${s.phone}] Status: ${s.status}`);
        console.log(`   - Sent Today: ${s.sentLogs.length}`);
        console.log(`   - Timezone: ${s.timezone}`);
    });
}

diagnose()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
