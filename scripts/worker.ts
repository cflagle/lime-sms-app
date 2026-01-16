require('dotenv').config();
const cron = require('node-cron');
// Note: We use require for simplicity in the worker entry point if not using modules, 
// but since we are in a TS project, let's try proper imports.
// However, ts-node execution with ES modules can be tricky. 
// Let's use standard import provided we run with ts-node.

import { SmsService } from '../lib/sms-service';

console.log('Starting SMS Worker...');
console.log('DEBUG: Env Check - User:', process.env.LIME_USER, 'API_ID:', process.env.LIME_API_ID ? '***' : 'MISSING');


// Sync once daily at 1:00 AM (reduces load and log volume significantly)
cron.schedule('0 1 * * *', async () => {
    try {
        console.log('[Cron] Starting Daily Subscriber Sync (1 AM)...');
        await SmsService.syncSubscribers();
        console.log('[Cron] Sync Complete.');
    } catch (e) {
        console.error('[Cron] Sync Failed:', e);
    }
});

// Process Queue every minute
cron.schedule('* * * * *', async () => {
    try {
        // console.log('[Cron] Processing Queue...'); // Quieted for Log Quota
        await SmsService.processQueue();
        // console.log('[Cron] Queue Processing Complete.');
    } catch (e) {
        console.error('[Cron] Queue Processing Failed:', e);
    }
});


// Run immediately on start for instant feedback
(async () => {
    console.log('[Worker] Initial check starting...');
    await SmsService.processQueue();
    console.log('[Worker] Initial check complete.');
})();

console.log('Worker is running. Jobs scheduled.');

// Cloud Run requires the container to listen on $PORT
const http = require('http');
const port = process.env.PORT || 8080;
const server = http.createServer((req: any, res: any) => {
    res.writeHead(200);
    res.end('Worker is running');
});
server.listen(port, () => {
    console.log(`Worker listening on port ${port}`);
});
