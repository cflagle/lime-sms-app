
import { SmsService } from './lib/sms-service';

async function runWorker() {
    console.log("Starting Worker Mock (TSX)...");
    try {
        await SmsService.processQueue();
        console.log("Worker Mock Finished.");
    } catch (e) {
        console.error("Worker Error:", e);
    }
}

runWorker();
