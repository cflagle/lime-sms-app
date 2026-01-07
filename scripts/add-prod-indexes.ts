import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Starting index creation on production database...');

    const queries = [
        // SentLog indexes (critical for daily cap and cooldown checks)
        `CREATE INDEX CONCURRENTLY IF NOT EXISTS "SentLog_subscriberId_sentAt_idx" ON "SentLog"("subscriberId", "sentAt");`,
        `CREATE INDEX CONCURRENTLY IF NOT EXISTS "SentLog_subscriberId_messageId_sentAt_idx" ON "SentLog"("subscriberId", "messageId", "sentAt");`,
        `CREATE INDEX CONCURRENTLY IF NOT EXISTS "SentLog_messageId_sentAt_idx" ON "SentLog"("messageId", "sentAt");`,

        // Subscriber indexes (critical for webhook matching and pagination)
        `CREATE INDEX CONCURRENTLY IF NOT EXISTS "Subscriber_email_idx" ON "Subscriber"("email");`,
        `CREATE INDEX CONCURRENTLY IF NOT EXISTS "Subscriber_status_idx" ON "Subscriber"("status");`,
        `CREATE INDEX CONCURRENTLY IF NOT EXISTS "Subscriber_status_id_idx" ON "Subscriber"("status", "id");`,

        // TrackingEvent indexes (critical for analytics lookups)
        `CREATE INDEX CONCURRENTLY IF NOT EXISTS "TrackingEvent_keyword_idx" ON "TrackingEvent"("keyword");`,
        `CREATE INDEX CONCURRENTLY IF NOT EXISTS "TrackingEvent_subscriberId_idx" ON "TrackingEvent"("subscriberId");`,
        `CREATE INDEX CONCURRENTLY IF NOT EXISTS "TrackingEvent_createdAt_idx" ON "TrackingEvent"("createdAt");`
    ];

    for (const query of queries) {
        console.log(`Executing: ${query}`);
        try {
            await prisma.$executeRawUnsafe(query);
            console.log('Success.');
        } catch (e: any) {
            console.error(`Error executing query: ${e.message}`);
        }
    }

    console.log('Verifying indexes...');
    try {
        const result = await prisma.$queryRawUnsafe(`SELECT indexname, tablename FROM pg_indexes WHERE schemaname = 'public' ORDER BY tablename;`);
        console.log('Current Indexes:', JSON.stringify(result, null, 2));
    } catch (e: any) {
        console.error('Error verifying indexes:', e.message);
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
