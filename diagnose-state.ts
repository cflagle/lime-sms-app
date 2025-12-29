
import { prisma } from './lib/prisma';
import { getAppConfig } from './lib/config-service';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

async function diagnose() {
    const config = await getAppConfig();
    console.log('--- Config ---');
    console.log('Sending Enabled:', config.sendingEnabled);
    console.log('Test Mode:', config.testMode);
    console.log('Test Numbers:', config.testNumbers);
    console.log('Daily Limit:', config.dailyLimitPerUser);
    console.log('Send Times:', config.sendTimes);
    console.log('Engagement Window:', config.engagementWindowEnabled, 'Days:', config.engagementWindowDays);

    // Get the first test number to check
    const testNumber = config.testNumbers.split(',')[0]?.trim();
    if (!testNumber) {
        console.log('No test number found in config to diagnose.');
        return;
    }

    console.log(`\n--- Subscriber: ${testNumber} ---`);
    const sub = await prisma.subscriber.findUnique({
        where: { phone: testNumber },
        include: { sentLogs: { orderBy: { sentAt: 'desc' } } }
    });

    if (!sub) {
        console.log('Subscriber NOT FOUND in DB.');
        return;
    }

    console.log('Status:', sub.status);
    console.log('Brands:', `WSWD=${sub.subscribe_wswd}, TA=${sub.subscribe_ta}`);
    console.log('Timezone:', sub.timezone);
    console.log('Last Engagement:', sub.last_engagement);

    console.log(`\n--- Sent Logs (Today) ---`);
    const startOfDay = dayjs().startOf('day').toDate();
    const sentToday = sub.sentLogs.filter(l => l.sentAt >= startOfDay);
    console.log(`Sent Today Count: ${sentToday.length}`);
    sentToday.forEach(l => {
        console.log(` - ${l.sentAt.toISOString()} (Msg: ${l.messageId})`);
    });

    console.log('\n--- Time Check ---');
    const now = dayjs();
    let tz = sub.timezone || "America/New_York";
    const localTime = now.tz(tz);
    console.log('Server Time (dayjs):', now.format());
    console.log('Subscriber Local Time:', localTime.format('YYYY-MM-DD HH:mm:ss'));
}

diagnose()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
