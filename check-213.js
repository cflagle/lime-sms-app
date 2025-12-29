
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check213() {
    console.log('--- Checking all 213 numbers ---');

    // Find numbers starting with 1213 or 213 (stored as 1213 in DB typically)
    const subscribers = await prisma.subscriber.findMany({
        where: {
            OR: [
                { phone: { startsWith: '1213' } },
                { phone: { startsWith: '213' } },
                { phone: { startsWith: '+1213' } }
            ]
        }
    });

    console.log(`Found ${subscribers.length} numbers with area code 213.`);

    let estCount = 0;
    let pstCount = 0;

    for (const sub of subscribers) {
        if (sub.timezone === 'America/New_York') {
            estCount++;
            console.log(`[EST] ${sub.phone} - ${sub.timezone}`);
        } else if (sub.timezone === 'America/Los_Angeles') {
            pstCount++;
        } else {
            console.log(`[OTHER] ${sub.phone} - ${sub.timezone}`);
        }
    }

    console.log(`\nSummary:`);
    console.log(`PST (Correct): ${pstCount}`);
    console.log(`EST (Incorrect?): ${estCount}`);

    await prisma.$disconnect();
}

check213();
