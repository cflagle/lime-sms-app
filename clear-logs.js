const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function clearLogs() {
    const phone = '14438049313';
    console.log(`Clearing logs for ${phone}...`);
    const sub = await prisma.subscriber.findUnique({ where: { phone } });
    if (sub) {
        await prisma.sentLog.deleteMany({
            where: { subscriberId: sub.id }
        });
        console.log("Logs cleared.");
    } else {
        console.log("Subscriber not found.");
    }
}

clearLogs();
