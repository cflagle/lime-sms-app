
import { PrismaClient } from '@prisma/client';
import { AREA_CODE_TIMEZONES } from '../lib/area-codes';

const prisma = new PrismaClient();

async function fixAllTimezones() {
    console.log("Starting Timezone Fix...");
    const total = await prisma.subscriber.count();
    console.log(`Total subscribers to check: ${total}`);

    let processed = 0;
    let updated = 0;
    let batchSize = 1000;
    let cursorId = 0;

    while (true) {
        const subscribers = await prisma.subscriber.findMany({
            take: batchSize,
            skip: cursorId === 0 ? 0 : 1, // Skip cursor if not first
            cursor: cursorId === 0 ? undefined : { id: cursorId },
            orderBy: { id: 'asc' }
        });

        if (subscribers.length === 0) break;

        // Prepare updates
        // To be safe and fast, we can loop and update individually?
        // Or filter for those needing update and Promise.all?

        const updates = [];

        for (const sub of subscribers) {
            const phoneStr = String(sub.phone).replace(/\D/g, '');
            let areaCode = '';
            if (phoneStr.length === 11 && phoneStr.startsWith('1')) {
                areaCode = phoneStr.substring(1, 4);
            } else if (phoneStr.length === 10) {
                areaCode = phoneStr.substring(0, 3);
            }

            const correctTz = AREA_CODE_TIMEZONES[areaCode];

            // Only update if we FOUND a timezone and it is DIFFERENT
            // If we can't determine timezone, we leave it alone (or set to null?)
            // User implied they want strict timezone. If invalid, maybe null is better than wrong default.
            // But let's stick to correcting known mismatches first.

            if (correctTz && sub.timezone !== correctTz) {
                updates.push(prisma.subscriber.update({
                    where: { id: sub.id },
                    data: { timezone: correctTz }
                }));
            }

            cursorId = sub.id;
        }

        if (updates.length > 0) {
            await Promise.all(updates);
            updated += updates.length;
        }

        processed += subscribers.length;
        console.log(`Processed ${processed}/${total}. Updated ${updated} so far.`);
    }

    console.log("Done.");
    console.log(`Total Verified: ${processed}`);
    console.log(`Total Updated: ${updated}`);
}

fixAllTimezones()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
