
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("Checking DB Stats...");
    const subCount = await prisma.subscriber.count({ where: { status: 'ACTIVE' } });
    console.log(`Active Subscribers: ${subCount}`);

    const logCount = await prisma.sentLog.count();
    console.log(`Total Sent Logs: ${logCount}`);

    // Check average logs per sub
    const logsLast30d = await prisma.sentLog.count({
        where: { sentAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }
    });
    console.log(`Logs in last 30 days: ${logsLast30d}`);
}

main()
    .catch(console.error)
    .finally(async () => await prisma.$disconnect());
