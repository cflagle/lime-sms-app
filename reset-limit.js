const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function reset() {
    console.log(`Resetting limit to 2...`);
    const config = await prisma.appConfig.findFirst();
    await prisma.appConfig.update({
        where: { id: config.id },
        data: { dailyLimitPerUser: 2 }
    });
    console.log("Done.");
}

reset();
