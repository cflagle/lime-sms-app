import { SmsService } from './lib/sms-service';
import { prisma } from './lib/prisma';
import dayjs from 'dayjs';

async function verify() {
    console.log("Verifying Minimum Interval Logic...");

    const phone = '14438049313'; // Use one of the test numbers
    const config = await prisma.appConfig.findFirst();
    if (!config) throw new Error("No config found");

    console.log(`Current Config: MinInterval=${config.minIntervalMinutes}m, TestMode=${config.testMode}`);

    // 1. Ensure subscriber exists and reset logs for clean test
    let sub = await prisma.subscriber.findUnique({
        where: { phone },
        include: { sentLogs: true }
    });

    if (!sub) {
        console.error("Subscriber not found!");
        return;
    }

    // 2. Mock a recent sent log (SENT NOW)
    // We can't easily insert a log without constraints, but we can update the LAST log or insert one.
    // Let's assume we just sent one.

    // Check eligibility NOW (Should be TRUE if no recent logs, or FALSE if sent recently)
    // But testing "real" eligibility is hard without waiting.
    // Let's unit test the logic by MOCKING the subscriber object passed to the function?
    // SmsService.isEligibleToReceive takes (sub, config).

    const mockSubEligible = {
        ...sub,
        sentLogs: [], // No logs
        timezone: 'America/New_York'
    };

    const mockConfig = {
        ...config,
        minIntervalMinutes: 90,
        sendTimes: "", // Disable schedule for this test to isolate Interval logic
        sendingEnabled: true,
        testMode: true,
        testNumbers: '14438049313',
        dailyLimitPerUser: 10
    };

    console.log("\nTest 1: No logs. Should be Eligible.");
    const res1 = SmsService.isEligibleToReceive(mockSubEligible, mockConfig);
    console.log(`Result: ${res1} (Expected: true)`);

    console.log("\nTest 2: Log sent 10 mins ago. MinInterval=90. Should be Ineligible.");
    const mockSubIneligible = {
        ...sub,
        sentLogs: [{ sentAt: dayjs().subtract(10, 'minute').toDate() }],
        timezone: 'America/New_York'
    };
    const res2 = SmsService.isEligibleToReceive(mockSubIneligible, mockConfig);
    console.log(`Result: ${res2} (Expected: false)`);

    console.log("\nTest 3: Log sent 100 mins ago. MinInterval=90. Should be Eligible.");
    const mockSubEligible2 = {
        ...sub,
        sentLogs: [{ sentAt: dayjs().subtract(100, 'minute').toDate() }],
        timezone: 'America/New_York'
    };
    const res3 = SmsService.isEligibleToReceive(mockSubEligible2, mockConfig);
    console.log(`Result: ${res3} (Expected: true)`);

}

verify()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
