import { SmsService } from './lib/sms-service';
import { getAppConfig, updateAppConfig } from './lib/config-service';

async function verify() {
    try {
        console.log("--- Starting Safety Verification ---");

        // 1. Ensure Defaults (Sending OFF)
        let config = await getAppConfig();
        console.log(`Initial State: Sending=${config.sendingEnabled}, TestMode=${config.testMode}`);

        if (config.sendingEnabled) {
            console.log("Resetting to SAFE mode...");
            await updateAppConfig({ sendingEnabled: false });
        }

        // 2. Run Process Queue (Should exit early)
        console.log("\nTest 1: Run Queue with Sending DISABLED");
        await SmsService.processQueue();

        // 3. Enable Sending + Test Mode + Whitelist
        console.log("\nTest 2: Run Queue with Sending ON + Test Mode + Dummy Whitelist");
        await updateAppConfig({
            sendingEnabled: true,
            testMode: true,
            testNumbers: '9999999999' // Dummy number that won't match anyone (probably) 
        });

        // 3b. Run Queue
        await SmsService.processQueue();

        // 4. Revert to safe
        console.log("\nReverting to SAFE mode...");
        await updateAppConfig({ sendingEnabled: false });

    } catch (e) {
        console.error("Safety Verify Failed:", e);
    }
}

verify();
