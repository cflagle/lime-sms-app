
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
    let output = "Verifying DB State...\n";

    // Check distribution
    const counts = await prisma.subscriber.groupBy({
        by: ['timezone'],
        _count: { timezone: true }
    });
    output += "Timezone Distribution: " + JSON.stringify(counts, null, 2) + "\n";

    // Check for NULLs
    const nulls = await prisma.subscriber.count({
        where: { timezone: null }
    });
    output += "Subscribers with NULL timezone: " + nulls + "\n";

    // Check specific known area codes
    const samples = await prisma.subscriber.findMany({
        take: 5,
        where: { NOT: { timezone: null } }
    });
    output += "Sample Valid Subs: " + JSON.stringify(samples.map(s => ({ p: s.phone, tz: s.timezone })), null, 2) + "\n";

    fs.writeFileSync('verify_output.txt', output);
}

main()
    .catch(e => fs.writeFileSync('verify_output.txt', "ERROR: " + e.toString()))
    .finally(() => prisma.$disconnect());
