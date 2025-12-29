const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    try {
        console.log("Checking DB for Subscribers...");
        const count = await prisma.subscriber.count();
        console.log(`Subscribers Count: ${count}`);

        const subs = await prisma.subscriber.findMany({ take: 5 });
        console.log("Sample Subscribers:", subs);
    } catch (e) {
        console.error("DB Check Failed:", e);
    } finally {
        await prisma.$disconnect();
    }
}

check();
