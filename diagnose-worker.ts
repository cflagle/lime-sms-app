
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function diagnose() {
    const phone = '14438049313';
    const sub = await prisma.subscriber.findUnique({ where: { phone } });
    console.log("Subscriber:", sub);

    const messages = await prisma.message.findMany({ where: { active: true } });
    console.log("Active Messages Count:", messages.length);
    console.log("Sample Message:", messages[0]);

    // Check config
    const config = await prisma.appConfig.findFirst();
    console.log("Config SendTimes:", config.sendTimes);
}

diagnose();
