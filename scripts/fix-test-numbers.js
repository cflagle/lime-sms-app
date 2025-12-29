
const { PrismaClient } = require('@prisma/client');
const { parsePhoneNumber } = require('libphonenumber-js');

const prisma = new PrismaClient();

const AREA_CODE_TIMEZONES = {
    '213': 'America/Los_Angeles', // CA
    '410': 'America/New_York', // MD
    '443': 'America/New_York', // MD
    // Add others if needed, but these are the test ones
};

async function fixTestNumbers() {
    const testPhones = ['14438049313', '14104320520', '14109046084', '12132965329'];

    console.log('=== Fixing Test Numbers ===\n');

    for (const phone of testPhones) {

        let newTz = 'America/New_York'; // Default
        try {
            const phoneNumber = parsePhoneNumber(phone, 'US');
            if (phoneNumber && (phoneNumber.country === 'US' || phoneNumber.country === 'CA')) {
                const national = phoneNumber.nationalNumber;
                const areaCode = national.substring(0, 3);
                if (AREA_CODE_TIMEZONES[areaCode]) {
                    newTz = AREA_CODE_TIMEZONES[areaCode];
                }
            }
        } catch (e) { console.error(e); }

        console.log(`Checking ${phone}...`);

        const sub = await prisma.subscriber.findFirst({ where: { phone } });
        if (!sub) {
            console.log('  Not found.');
            continue;
        }

        if (sub.timezone !== newTz) {
            console.log(`  Updating from ${sub.timezone} to ${newTz}`);
            await prisma.subscriber.update({
                where: { id: sub.id },
                data: { timezone: newTz }
            });
        } else {
            console.log(`  Already correct: ${newTz}`);
        }
    }

    await prisma.$disconnect();
}

fixTestNumbers();
