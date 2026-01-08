import { prisma } from './prisma';

export async function getAppConfig() {
    let config = await prisma.appConfig.findFirst();
    if (!config) {
        config = await prisma.appConfig.create({
            data: {
                sendingEnabled: false,
                testMode: true,
                testNumbers: '',
                batchSize: 50,
                dailyLimitPerUser: undefined, // Assuming default is undefined or a specific number
                minIntervalMinutes: undefined, // Assuming default is undefined or a specific number
                engagementWindowEnabled: false,
                engagementWindowDays: undefined, // Assuming default is undefined or a specific number
                sendTimes: undefined, // Assuming default is undefined or a specific string
                dailyLimitWSWD: undefined, // Assuming default is undefined or a specific number
                dailyLimitTA: undefined, // Assuming default is undefined or a specific number
                sendTimesWSWD: undefined, // Assuming default is undefined or a specific string
                sendTimesTA: undefined, // Assuming default is undefined or a specific string
                limeListId: undefined, // Assuming default is undefined or a specific string
                globalDailyCap: undefined, // Assuming default is undefined or a specific number
                dryRunMode: false, // Assuming default is false
            }
        });
    }
    return config;
}

export async function updateAppConfig(updates: {
    sendingEnabled?: boolean;
    testMode?: boolean;
    testNumbers?: string;
    batchSize?: number;
    dailyLimitPerUser?: number;
    minIntervalMinutes?: number;
    engagementWindowEnabled?: boolean;
    engagementWindowDays?: number;
    sendTimes?: string;
    // New Fields
    dailyLimitWSWD?: number;
    dailyLimitTA?: number;
    sendTimesWSWD?: string;
    sendTimesTA?: string;
    limeListId?: string;
    // Provider Controls
    limeEnabled?: boolean;
    tracklyEnabled?: boolean;
    tracklyPhoneNumberId?: string;
    globalDailyCap?: number;
    dryRunMode?: boolean;
}) {
    // Only update fields that are present in the payload
    const data: any = {};
    if (updates.sendingEnabled !== undefined) data.sendingEnabled = updates.sendingEnabled;
    if (updates.testMode !== undefined) data.testMode = updates.testMode;
    if (updates.testNumbers !== undefined) data.testNumbers = updates.testNumbers;
    if (updates.batchSize !== undefined) data.batchSize = updates.batchSize;
    if (updates.dailyLimitPerUser !== undefined) data.dailyLimitPerUser = updates.dailyLimitPerUser;
    if (updates.engagementWindowEnabled !== undefined) data.engagementWindowEnabled = updates.engagementWindowEnabled;
    if (updates.engagementWindowDays !== undefined) data.engagementWindowDays = updates.engagementWindowDays;
    if (updates.sendTimes !== undefined) data.sendTimes = updates.sendTimes;
    if (updates.minIntervalMinutes !== undefined) data.minIntervalMinutes = updates.minIntervalMinutes;
    if (updates.dailyLimitWSWD !== undefined) data.dailyLimitWSWD = updates.dailyLimitWSWD;
    if (updates.dailyLimitTA !== undefined) data.dailyLimitTA = updates.dailyLimitTA;
    if (updates.sendTimesWSWD !== undefined) data.sendTimesWSWD = updates.sendTimesWSWD;
    if (updates.sendTimesTA !== undefined) data.sendTimesTA = updates.sendTimesTA;

    if (updates.limeListId != null) data.limeListId = updates.limeListId;
    // Provider Controls
    if (updates.limeEnabled !== undefined) data.limeEnabled = updates.limeEnabled;
    if (updates.tracklyEnabled !== undefined) data.tracklyEnabled = updates.tracklyEnabled;
    if (updates.tracklyPhoneNumberId != null) data.tracklyPhoneNumberId = updates.tracklyPhoneNumberId;
    if (updates.globalDailyCap != null) data.globalDailyCap = updates.globalDailyCap;
    if (updates.dryRunMode !== undefined) data.dryRunMode = updates.dryRunMode;

    return prisma.appConfig.update({
        where: { id: 1 }, // Assuming a single app config with ID 1
        data
    });
}
