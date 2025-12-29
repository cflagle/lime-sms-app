require('dotenv').config();
const { LimeClient } = require('./lib/lime-client');
// We need to mock the environment if it's not loading from .env automatically in this script context
// But typically dotenv flow works.

async function checkLime() {
    try {
        console.log("Checking Lime API for test number...");
        const TEST_NUMBER = '14438049313'; // Format?

        // 1. Check Opt-In Status directly
        console.log(`\n--- Check OptInfo for ${TEST_NUMBER} ---`);
        const isActive = await LimeClient.checkOptInStatus(TEST_NUMBER);
        console.log(`Is number Active? ${isActive}`);

        // 2. Check the List Dump
        console.log(`\n--- Check List 135859 ---`);
        const leads = await LimeClient.getOptedInNumbers('135859');
        console.log(`Total Leads in List: ${leads.length}`);

        const found = leads.find(l => l.MobileNumber === TEST_NUMBER || l.MobileNumber === '1' + TEST_NUMBER);
        if (found) {
            console.log("SUCCESS: Found number in the list download!", found);
        } else {
            console.log("FAILURE: Number NOT found in the list download.");
            // Print a few to see format
            if (leads.length > 0) {
                console.log("Sample lead formats:", leads.slice(0, 3).map(l => l.MobileNumber));
            }
        }

    } catch (e) {
        console.error(e);
    }
}

// Mocking the TS imports if running via node directly might be tricky with imports.
// I'll assume usage of 'ts-node' or modify to commonjs if needed.
// actually, the project has tsx installed.
checkLime();
