// Quick diagnostic to check subscriber timezones
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkTimezones() {
    const testPhones = ['14438049313', '14104320520', '14109046084', '12132965329'];

    console.log('=== Subscriber Timezone Check ===\n');

    for (const phone of testPhones) {
        const sub = await prisma.subscriber.findFirst({
            where: { phone: phone }
        });

        if (sub) {
            // Determine expected timezone from area code
            const areaCode = phone.startsWith('1') ? phone.substring(1, 4) : phone.substring(0, 3);

            console.log(`Phone: ${phone}`);
            console.log(`  Area Code: ${areaCode}`);
            console.log(`  Stored Timezone: ${sub.timezone || 'NULL'}`);
            console.log(`  Status: ${sub.status}`);
            console.log('');
        } else {
            console.log(`Phone: ${phone} - NOT FOUND\n`);
        }
    }

    await prisma.$disconnect();
}

checkTimezones();
