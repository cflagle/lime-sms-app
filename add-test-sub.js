const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Reading AppConfig...");
    const config = await prisma.appConfig.findFirst();
    if (!config || !config.testNumbers) {
        console.log("No test numbers configured.");
        return;
    }

    const numbers = config.testNumbers.split(',').map(n => n.trim()).filter(n => n);
    console.log(`Found ${numbers.length} test numbers in config: ${numbers.join(', ')}`);

    for (const phone of numbers) {
        console.log(`Upserting Subscriber: ${phone}`);
        await prisma.subscriber.upsert({
            where: { phone: phone },
            update: {
                status: 'ACTIVE',
                subscribe_wswd: true,
                subscribe_ta: true
            },
            create: {
                phone: phone,
                name: 'Test User',
                status: 'ACTIVE',
                subscribe_wswd: true,
                subscribe_ta: true,
                timezone: 'America/New_York'
            }
        });
    }
    console.log("Done. All test numbers are now ACTIVE subscribers.");
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
