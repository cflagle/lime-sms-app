
import { PrismaClient } from '@prisma/client';
import { AREA_CODE_TIMEZONES } from '../lib/area-codes';

const prisma = new PrismaClient();

async function main() {
    console.log("Diagnosing Timezones...");

    // 1. Get counts of timezones
    const counts = await prisma.subscriber.groupBy({
        by: ['timezone'],
        _count: { timezone: true }
    });
    console.log("Timezone Distribution:", counts);

    // 2. Check specific numbers (some valid CA/West Coast numbers)
    // 213 is LA, 310 is LA, 206 is Seattle, 415 is SF
    const checkAreaCodes = ['213', '310', '206', '415', '503'];

    // Fetch a few subs from these area codes
    const subs = await prisma.subscriber.findMany({
        where: {
            OR: checkAreaCodes.map(ac => ({ phone: { contains: ac } }))
        },
        take: 20
    });

    console.log(`\nChecking ${subs.length} subscribers from West Coast area codes...`);

    for (const sub of subs) {
        // Simple area code extraction for display
        const phone = sub.phone.replace('+1', '').replace(/\D/g, '');
        const ac = phone.substring(0, 3);
        const expected = AREA_CODE_TIMEZONES[ac];

        console.log(`Phone: ${sub.phone} | DB TZ: ${sub.timezone} | Expected: ${expected || 'UNKNOWN'} | Match: ${sub.timezone === expected}`);
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
