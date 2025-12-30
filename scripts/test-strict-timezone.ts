
require('dotenv').config();
import { SmsService } from '../lib/sms-service';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testStrictTimezone() {
    console.log("=== Testing Strict Timezone Logic ===");

    // Mock subscriber objects
    const validLA = { phone: '12135551234', timezone: null }; // Should derive LA
    const validNY = { phone: '12125551234', timezone: null }; // Should derive NY
    const unknown = { phone: '10000000000', timezone: null }; // Invalid area code -> Should be False
    const existing = { phone: '12135551234', timezone: 'America/Chicago' }; // Should use stored TZ if present? Logic says: if !tz ... so it uses stored.

    // Note: isEligibleToReceive checks DB stuff (sentLogs). 
    // We need to pass a mock subscriber that matches what DB returns.
    // But isEligibleToReceive calls `sub.timezone`.

    // Test 1: JIT Derivation for LA
    console.log("Test 1: Valid LA Number (No stored TZ)");
    // We need to inject 'sentLogs: []' to pass other checks
    const resLA = SmsService.isEligibleToReceive({ ...validLA, sentLogs: [], createdAt: new Date() }, { sendingEnabled: true });
    console.log(`  Result: ${resLA} (Expected: true/false depending on time of day, but should NOT be suppressed by TZ)`);
    // Note: It might return FALSE due to 8am-8pm check if running at night.
    // We mainly want to see if it logs "suppressed for ... NO TIMEZONE AVAILABLE".

    // Test 2: Unknown Area Code
    console.log("Test 2: Unknown Area Code (No stored TZ)");
    const resUnknown = SmsService.isEligibleToReceive({ ...unknown, sentLogs: [], createdAt: new Date() }, { sendingEnabled: true });
    console.log(`  Result: ${resUnknown} (Expected: false)`);

    // Test 3: Stored Timezone
    console.log("Test 3: Stored Timezone is set");
    const resStored = SmsService.isEligibleToReceive({ ...existing, sentLogs: [], createdAt: new Date() }, { sendingEnabled: true });
    console.log(`  Result: ${resStored} (Expected: true/false depending on time - checks Chicago)`);

    console.log("=== Done ===");
}

testStrictTimezone();
