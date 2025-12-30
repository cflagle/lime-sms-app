
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
    console.log("Verifying DB State...");

    // Check distribution
    const counts = await prisma.subscriber.groupBy({
        by: ['timezone'],
        _count: { timezone: true }
    });
    console.log("Timezone Distribution:", JSON.stringify(counts, null, 2));

    // Check for NULLs
    const nulls = await prisma.subscriber.count({
        where: { timezone: null }
    });
    console.log("Subscribers with NULL timezone:", nulls);

    // Check specific known area codes to see if they are fixed
    const samples = await prisma.subscriber.findMany({
        take: 5,
        where: { NOT: { timezone: null } }
    });
    console.log("Sample Valid Subs:", JSON.stringify(samples.map(s => ({ p: s.phone, tz: s.timezone })), null, 2));
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
