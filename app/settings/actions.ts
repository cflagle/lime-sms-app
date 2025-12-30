'use server';

import { updateAppConfig } from '@/lib/config-service';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const MessageImportSchema = z.array(z.object({
    name: z.string(),
    content: z.string(),
    brand: z.string(),
    active: z.boolean().optional(),
    cooldownDays: z.number().optional()
}));

export async function importMessages(jsonString: string) {
    try {
        const data = JSON.parse(jsonString);
        const messages = MessageImportSchema.parse(data);

        let importedCount = 0;

        for (const msg of messages) {
            await prisma.message.upsert({
                where: { name: msg.name },
                update: {
                    content: msg.content,
                    brand: msg.brand,
                    active: msg.active,
                    cooldownDays: msg.cooldownDays
                },
                create: {
                    name: msg.name,
                    content: msg.content,
                    brand: msg.brand,
                    active: msg.active || true,
                    cooldownDays: msg.cooldownDays || 14
                }
            });
            importedCount++;
        }

        revalidatePath('/settings');
        return { success: true, count: importedCount };
    } catch (e: any) {
        console.error("Import Error:", e);
        return { success: false, error: e.message || "Invalid JSON format" };
    }
}

export async function saveSettings(formData: FormData) {
    const rawTestNumbers = formData.get('testNumbers') as string;
    // Normalize: split by newline or comma, trim, filter empty, join with comma
    const testNumbers = rawTestNumbers
        ? rawTestNumbers.split(/[\n,]+/).map(s => s.trim()).filter(Boolean).join(',')
        : '';

    const sendingEnabled = formData.get('sendingEnabled') === 'on';
    const testMode = formData.get('testMode') === 'on';
    const minIntervalMinutes = Number(formData.get('minIntervalMinutes') || 0);
    const engagementWindowEnabled = formData.get('engagementWindowEnabled') === 'on';
    const engagementWindowDays = Number(formData.get('engagementWindowDays') || 90);

    // Brand Specific Limits
    const dailyLimitWSWD = parseInt(formData.get('dailyLimitWSWD') as string);
    const dailyLimitTA = parseInt(formData.get('dailyLimitTA') as string);

    // Scale/Safety Settings
    const limeListId = (formData.get('limeListId') as string) || '135859';
    const globalDailyCap = parseInt((formData.get('globalDailyCap') as string) || '0') || 0;
    const dryRunMode = formData.get('dryRunMode') === 'on';

    // Manual Sync/Queue Overrides
    const queueMinId = parseInt((formData.get('queueMinId') as string) || '0') || 0;
    const syncSkip = parseInt((formData.get('syncSkip') as string) || '0') || 0;

    // Parse Time Schedules
    // Logic: Inputs are named prefix + "-time-" + index
    const extractTimes = (prefix: string) => {
        const times = [];
        let i = 0;
        while (true) {
            const val = formData.get(`${prefix}-time-${i}`);
            if (val === null) break;
            if (val) times.push(val);
            i++;
        }
        return times.join(','); // Store as CSV
    };

    const sendTimesWSWD = extractTimes('wswd');
    const sendTimesTA = extractTimes('ta');

    // Legacy fallback for dailyLimitPerUser and sendTimes
    const dailyLimitPerUser = Math.max(dailyLimitWSWD, dailyLimitTA);
    const sendTimes = [sendTimesWSWD, sendTimesTA].filter(Boolean).join(',');

    // Assuming batchSize is also extracted from formData, if not, it needs to be added or defaulted.
    // For now, let's assume it's not present in the form and will be handled elsewhere or defaulted by updateAppConfig.
    // If it needs to be extracted from formData, add: const batchSize = Number(formData.get('batchSize') || 0);
    const batchSize = Number(formData.get('batchSize') || 0); // Added based on the snippet's updateAppConfig call

    await updateAppConfig({
        sendingEnabled,
        testMode,
        testNumbers,
        batchSize,
        dailyLimitPerUser,
        engagementWindowEnabled,
        engagementWindowDays,
        minIntervalMinutes,
        dailyLimitWSWD,
        dailyLimitTA,
        sendTimesWSWD,
        sendTimesTA,
        sendTimes, // Legacy fallback
        limeListId,
        globalDailyCap,
        dryRunMode,
    });

    revalidatePath('/settings');
}

import { SmsService } from '@/lib/sms-service';

export async function triggerSync(_formData: FormData) {
    try {
        console.log("Manual Sync Triggered from Settings");
        await SmsService.syncSubscribers();
        await SmsService.processQueue();

        revalidatePath('/settings');
    } catch (e: any) {
        console.error("Manual Sync Error:", e);
    }
}
