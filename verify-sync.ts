import { SmsService } from './lib/sms-service';

async function verify() {
    try {
        console.log("Starting Sync Verification...");
        await SmsService.syncSubscribers();
        console.log("Sync Verification Logic Finished.");
    } catch (e) {
        console.error("Sync Failed:", e);
    }
}

verify();
