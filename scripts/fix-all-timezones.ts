
require('dotenv').config();
import { PrismaClient } from '@prisma/client';
import { AREA_CODE_TIMEZONES } from '../lib/area-codes';

const prisma = new PrismaClient();

async function main() {
    console.log("Starting Timezone Fix Migration...");

    // Fetch all subscribers (for larger scale, use cursor pagination, but for now fetch all ID/Phone/TZ)
    const subscribers = await prisma.subscriber.findMany({
        select: { id: true, phone: true, timezone: true }
    });

    console.log(`Found ${subscribers.length} subscribers. Processing...`);

    let updatedCount = 0;
    let nullCount = 0;
    let skippedCount = 0;

    for (const sub of subscribers) {
        let newTz: string | null = null;

        try {
            const phoneStr = String(sub.phone).replace(/\D/g, '');
            let areaCode = '';
            if (phoneStr.length === 11 && phoneStr.startsWith('1')) {
                areaCode = phoneStr.substring(1, 4);
            } else if (phoneStr.length === 10) {
                areaCode = phoneStr.substring(0, 3);
            }

            if (areaCode && AREA_CODE_TIMEZONES[areaCode]) {
                newTz = AREA_CODE_TIMEZONES[areaCode];
            }
        } catch (e) { }

        // Decide if we update
        // If current TZ is already correct, skip
        // If current TZ is 'America/New_York' (likely default) and newTz is different (or NULL), update.
        // If current TZ is valid string but newTz is null? Keep existing? No, user said "determine real timezone for every single number".
        // If we CANT determine it, we want it NULL so we don't send.
        // So we should enforce strict overwriting if the area-code logic says so.
        // HOWEVER, maybe some were manually set? Unlikely.
        // Let's assume strict Area Code rule.

        if (sub.timezone !== newTz) {
            // Update
            await prisma.subscriber.update({
                where: { id: sub.id },
                data: { timezone: newTz }
            });
            // console.log(`Updated ${sub.phone}: ${sub.timezone} -> ${newTz}`);
            updatedCount++;
        } else {
            skippedCount++;
        }

        if (!newTz) nullCount++;
    }

    console.log("Migration Complete.");
    console.log(`Total Scanned: ${subscribers.length}`);
    console.log(`Updated: ${updatedCount}`);
    console.log(`Skipped (Already Correct): ${skippedCount}`);
    console.log(`Total Unknown/Null Timezones: ${nullCount}`);
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
