const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkNumbers() {
    const testNumbers = ['14438049313', '14104320520', '14109046084', '12132965329'];

    console.log('Checking which test numbers exist in database:\n');

    for (const num of testNumbers) {
        // Try exact match first
        let sub = await prisma.subscriber.findFirst({
            where: { phone: num }
        });

        // Also try with/without leading 1
        if (!sub) {
            const alt = num.startsWith('1') ? num.slice(1) : '1' + num;
            sub = await prisma.subscriber.findFirst({
                where: { phone: alt }
            });
            if (sub) {
                console.log(`${num}: FOUND as ${alt} (status=${sub.status})`);
                continue;
            }
        }

        if (sub) {
            console.log(`${num}: FOUND (status=${sub.status})`);
        } else {
            console.log(`${num}: NOT FOUND in database`);
        }
    }

    await prisma.$disconnect();
}

checkNumbers();
