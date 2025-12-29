const { PrismaClient } = require('@prisma/client');

async function main() {
    const prisma = new PrismaClient();

    console.log('\n=== Message Names ===');
    const messages = await prisma.message.findMany({
        select: { id: true, name: true }
    });
    console.log(JSON.stringify(messages, null, 2));

    console.log('\n=== Recent Tracking Events ===');
    const events = await prisma.trackingEvent.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
            id: true,
            eventType: true,
            keyword: true,
            messageId: true,
            subscriberId: true
        }
    });
    console.log(JSON.stringify(events, null, 2));

    await prisma.$disconnect();
}

main();
