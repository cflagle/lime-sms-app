
import { PrismaClient } from '@prisma/client';
// @ts-ignore
import { parsePhoneNumber } from 'libphonenumber-js';
import { AREA_CODE_TIMEZONES } from '../lib/area-codes';

const prisma = new PrismaClient();

async function fixTimezones() {
    console.log('Starting Timezone Fix...');

    const subscribers = await prisma.subscriber.findMany();
    console.log(`Found ${subscribers.length} subscribers.`);

    let updatedCount = 0;

    for (const sub of subscribers) {
        if (!sub.phone) continue;

        let newTz = 'America/New_York'; // Default
        try {
            const phoneNumber = parsePhoneNumber(sub.phone, 'US');
            if (phoneNumber && (phoneNumber.country === 'US' || phoneNumber.country === 'CA')) {
                const national = phoneNumber.nationalNumber as string;
                const areaCode = national.substring(0, 3);
                if (AREA_CODE_TIMEZONES[areaCode]) {
                    newTz = AREA_CODE_TIMEZONES[areaCode];
                }
            } else {
                console.warn(`Could not parse/validate ${sub.phone} even with US default.`);
            }
        } catch (e) {
            console.warn(`Error parsing ${sub.phone}: ${(e as any).message}`);
        }

        if (sub.timezone !== newTz) {
            console.log(`Updating ${sub.phone}: ${sub.timezone} -> ${newTz}`);
            await prisma.subscriber.update({
                where: { id: sub.id },
                data: { timezone: newTz }
            });
            updatedCount++;
        }
    }

    console.log(`Finished. Updated ${updatedCount} subscribers.`);
    await prisma.$disconnect();
}

fixTimezones();
