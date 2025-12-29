// Fix the timezone for the west coast subscriber
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixTimezone() {
    const result = await prisma.subscriber.updateMany({
        where: { phone: '12132965329' },
        data: { timezone: 'America/Los_Angeles' }
    });

    console.log(`Updated ${result.count} subscriber(s) to America/Los_Angeles`);

    // Verify
    const sub = await prisma.subscriber.findFirst({
        where: { phone: '12132965329' }
    });

    console.log(`\nVerification:`);
    console.log(`  Phone: ${sub?.phone}`);
    console.log(`  Timezone: ${sub?.timezone}`);

    await prisma.$disconnect();
}

fixTimezone();
