const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
    console.log('Seeding database...');

    // Create active subscriber
    const sub1 = await prisma.subscriber.upsert({
        where: { phone: '15550001234' },
        update: {},
        create: {
            phone: '15550001234',
            name: 'John Doe',
            status: 'ACTIVE',
            subscribe_wswd: true,
            subscribe_ta: true,
            timezone: 'America/New_York'
        },
    });

    // Create another subscriber
    const sub2 = await prisma.subscriber.upsert({
        where: { phone: '15550005678' },
        update: {},
        create: {
            phone: '15550005678',
            name: 'Jane Smith',
            status: 'ACTIVE',
            subscribe_wswd: true,
            subscribe_ta: false,
            timezone: 'America/Los_Angeles'
        },
    });

    // Create a campaign
    const camp = await prisma.campaign.upsert({
        where: { name: 'Welcome Series' },
        update: {},
        create: {
            name: 'Welcome Series',
            maxImpressionsPerWeek: 5
        }
    });

    // Create messages
    await prisma.message.create({
        data: {
            content: 'Welcome to WSWD! Check out our latest stock pick: {{LINK}}',
            brand: 'WSWD',
            campaignId: camp.id,
            cooldownDays: 14,
            active: true
        }
    });

    await prisma.message.create({
        data: {
            content: 'Trader Alert: Buy high sell low! kwim? {{LINK}}',
            brand: 'TA',
            cooldownDays: 7,
            active: true
        }
    });

    console.log('Seeding complete.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
