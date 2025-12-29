require('dotenv').config();
const { LimeClient } = require('./lib/lime-client');

async function main() {
    console.log("Testing Fixed LimeClient.checkOptInStatus...");
    const phone = '14438049313';

    try {
        const isActive = await LimeClient.checkOptInStatus(phone);
        console.log(`\nPhone: ${phone}`);
        console.log(`Active? ${isActive}`);

        if (isActive) {
            console.log("SUCCESS: API now returns true!");
        } else {
            console.log("FAILURE: API returned false (or still failing).");
        }
    } catch (e) {
        console.error("Script Error:", e);
    }
}

main();
export { };
