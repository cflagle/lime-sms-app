const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function diagnose() {
    try {
        console.log("--- DIAGNOSING APP CONFIG ---");
        const config = await prisma.appConfig.findFirst();
        console.log("AppConfig:", JSON.stringify(config, null, 2));

        if (!config) {
            console.log("CRITICAL: No AppConfig found!");
            return;
        }

        console.log("\n--- DIAGNOSING SUBSCRIBERS ---");
        const activeSubs = await prisma.subscriber.count({ where: { status: 'ACTIVE' } });
        console.log(`Total ACTIVE subscribers: ${activeSubs}`);

        if (config.testMode) {
            console.log("\n--- TEST MODE ANALYSIS ---");
            const allowedNumbers = config.testNumbers ? config.testNumbers.split(',').map(n => n.trim()) : [];
            console.log(`Whitelist: ${JSON.stringify(allowedNumbers)}`);

            const matchingSubs = await prisma.subscriber.findMany({
                where: {
                    status: 'ACTIVE',
                    phone: { in: allowedNumbers }
                }
            });
            console.log(`Found ${matchingSubs.length} ACTIVE subscribers matching the whitelist.`);
            matchingSubs.forEach(s => console.log(` - Found: ${s.phone} (${s.name})`));

            if (matchingSubs.length === 0) {
                console.log("WARN: Zero active subscribers match the test numbers whitelist.");
                // Let's print a few active phone numbers to see if there is a format mismatch
                const sample = await prisma.subscriber.findMany({ where: { status: 'ACTIVE' }, take: 5, select: { phone: true } });
                console.log("Sample Active Phone Numbers in DB:", sample.map(s => s.phone));
            }
        } else {
            console.log("Test Mode is OFF. All ACTIVE subscribers should be eligible (subject to other rules).");
        }

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

diagnose();
