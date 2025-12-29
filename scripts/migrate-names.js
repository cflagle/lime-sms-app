
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migrateNames() {
    console.log('--- Migrating Names to firstName/lastName ---');

    const subscribers = await prisma.subscriber.findMany({
        where: {
            OR: [
                { firstName: null },
                { lastName: null }
            ]
        }
    });

    console.log(`Found ${subscribers.length} subscribers to migrate.`);

    let count = 0;
    for (const sub of subscribers) {
        if (!sub.name) continue;

        const full = sub.name.trim();
        const firstSpace = full.indexOf(' ');

        let first = full;
        let last = '';

        if (firstSpace > 0) {
            first = full.substring(0, firstSpace);
            last = full.substring(firstSpace + 1).trim();
        }

        // Only update if we have something new
        if (sub.firstName !== first || sub.lastName !== last) {
            await prisma.subscriber.update({
                where: { id: sub.id },
                data: {
                    firstName: first,
                    lastName: last
                }
            });
            count++;
            if (count % 100 === 0) console.log(`Processed ${count}...`);
        }
    }

    console.log(`Migration Complete. Updated ${count} records.`);
    await prisma.$disconnect();
}

migrateNames();
