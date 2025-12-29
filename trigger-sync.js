const axios = require('axios');

async function triggerSync() {
    try {
        console.log("Triggering Sync: http://localhost:3011/api/cron");
        const res = await axios.get('http://localhost:3011/api/cron');
        console.log("Sync Response:", res.status, res.data);
    } catch (e) {
        console.error("Sync Trigger Failed:", e.message);
    }
}

triggerSync();
