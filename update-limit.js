const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function setLimit(limit) {
    console.log(`Setting daily limit to ${limit}...`);
    const config = await prisma.appConfig.findFirst();
    await prisma.appConfig.update({
        where: { id: config.id },
        data: { dailyLimitPerUser: limit }
    });
    console.log("Done.");
}

setLimit(50);
