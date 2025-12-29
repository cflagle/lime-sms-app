const { SmsService } = require('./lib/sms-service');
const { PrismaClient } = require('@prisma/client');

async function runWorker() {
    console.log("Starting Worker Mock...");
    try {
        await SmsService.processQueue();
        console.log("Worker Mock Finished.");
    } catch (e) {
        console.error("Worker Error:", e);
    }
}

runWorker();
