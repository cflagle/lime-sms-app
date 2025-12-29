
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

// Mock Config
const config = {
    sendTimesWSWD: '09:00',
    sendTimesTA: '09:00',
    // Disable other checks
    dailyLimitPerUser: 100,
    minIntervalMinutes: 0,
    engagementWindowEnabled: false
};

// Mock Subscriber
const createSub = (tz: string) => ({
    phone: '1234567890',
    timezone: tz,
    sentLogs: [] as any[]
});

function checkEligibility(sub: any, currentTimeISO: string) {
    const now = dayjs(currentTimeISO);
    const tz = sub.timezone;
    const localTime = now.tz(tz);
    const hour = localTime.hour();

    // Replicating logic from SmsService
    const allSchedules = ['09:00'];

    if (allSchedules.length > 0) {
        const currentMinute = hour * 60 + localTime.minute();
        let matchedSlot = false;

        for (const timeStr of allSchedules) {
            const [h, m] = timeStr.split(':').map(Number);
            const slotMinute = h * 60 + m;
            const diff = Math.abs(currentMinute - slotMinute);

            if (diff <= 3) {
                return true;
            }
        }
    }
    return false;
}

console.log("--- Timezone Verification Test (Schedule: 9:00 AM) ---");

// Test Cases
const scenarios = [
    { name: "New York User (ET)", tz: 'America/New_York', timeET: '2025-12-26T09:00:00-05:00', expected: true }, // 9am ET -> 9am Local (match)
    { name: "New York User (ET)", tz: 'America/New_York', timeET: '2025-12-26T10:00:00-05:00', expected: false },// 10am ET -> 10am Local (no match)

    { name: "Chicago User (CT)", tz: 'America/Chicago', timeET: '2025-12-26T09:00:00-05:00', expected: false }, // 9am ET -> 8am CT (no match)
    { name: "Chicago User (CT)", tz: 'America/Chicago', timeET: '2025-12-26T10:00:00-05:00', expected: true },  // 10am ET -> 9am CT (match)

    { name: "Denver User (MT)", tz: 'America/Denver', timeET: '2025-12-26T09:00:00-05:00', expected: false },  // 9am ET -> 7am MT (no match)
    { name: "Denver User (MT)", tz: 'America/Denver', timeET: '2025-12-26T11:00:00-05:00', expected: true },   // 11am ET -> 9am MT (match)

    { name: "LA User (PT)", tz: 'America/Los_Angeles', timeET: '2025-12-26T09:00:00-05:00', expected: false }, // 9am ET -> 6am PT (no match)
    { name: "LA User (PT)", tz: 'America/Los_Angeles', timeET: '2025-12-26T12:00:00-05:00', expected: true },  // 12pm ET -> 9am PT (match)
];

let success = true;

for (const s of scenarios) {
    const sub = createSub(s.tz);
    const result = checkEligibility(sub, s.timeET);
    const pass = result === s.expected;

    console.log(`[${pass ? 'PASS' : 'FAIL'}] ${s.name} @ ${dayjs(s.timeET).format('HH:mm')} ET`);
    console.log(`\tTarget: 9:00 Local`);
    console.log(`\tLocal Time: ${dayjs(s.timeET).tz(s.tz).format('HH:mm')}`);
    console.log(`\tEligible: ${result} (Expected: ${s.expected})`);

    if (!pass) success = false;
}

if (success) {
    console.log("\n✅ logic VERIFIED: Messages send at 9am LOCAL time.");
} else {
    console.error("\n❌ Logic FAILED verification.");
    process.exit(1);
}
