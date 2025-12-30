
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const count = await prisma.subscriber.count();
        console.log(`Total Subscribers in DB: ${count}`);

        const activeCount = await prisma.subscriber.count({
            where: { status: 'ACTIVE' }
        });
        console.log(`Active Subscribers: ${activeCount}`);

    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
