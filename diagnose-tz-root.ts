
require('dotenv').config();
import { PrismaClient } from '@prisma/client';
import { AREA_CODE_TIMEZONES } from './lib/area-codes';
// @ts-ignore
import { parsePhoneNumber } from 'libphonenumber-js';

const prisma = new PrismaClient();

async function main() {
    console.log("Diagnosing Timezones (from Root)...");

    try {
        // 1. Get counts
        const counts = await prisma.subscriber.groupBy({
            by: ['timezone'],
            _count: { timezone: true }
        });
        console.log("Timezone Distribution:", counts);

        // 2. Test Phone Parsing Logic
        const testNums = ['2135551234', '14155551234', '+12025550123'];
        for (const testNum of testNums) {
            try {
                const pn = parsePhoneNumber(testNum, 'US');
                console.log(`Test Parse '${testNum}': Country=${pn?.country}, Nat=${pn?.nationalNumber}`);
                const ac = (pn?.nationalNumber as string)?.substring(0, 3);
                console.log(`  Area Code extracted: ${ac}, Map value: ${AREA_CODE_TIMEZONES[ac]}`);
            } catch (e) {
                console.log(`Test Parse Error for ${testNum}:`, e);
            }
        }

        // 3. Check DB samples
        const subs = await prisma.subscriber.findMany({
            take: 10,
            where: { status: 'ACTIVE' }
        });

        console.log("\nSample Subscribers:");
        for (const sub of subs) {
            console.log(`Sub ${sub.phone} | TZ: ${sub.timezone}`);
        }
    } catch (e) {
        console.error("Main Error:", e);
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
