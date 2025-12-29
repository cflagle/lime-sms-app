const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    const numbers = ['14438049313', '14104320520', '14109046084', '2132965329'];
    console.log(`Checking for: ${numbers.join(', ')}`);

    const found = await prisma.subscriber.findMany({
        where: {
            phone: { in: numbers }
        }
    });

    console.log(`\nFound ${found.length} matches.`);
    found.forEach(s => {
        console.log(` - ${s.phone}: Status=${s.status}, Name=${s.name}`);
    });

    const foundNumbers = found.map(s => s.phone);
    const missing = numbers.filter(n => !foundNumbers.includes(n));

    if (missing.length > 0) {
        console.log(`\nMissing numbers: ${missing.join(', ')}`);
    } else {
        console.log("\nAll numbers found.");
    }
}

check()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
