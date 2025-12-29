
import { Subscriber } from '@prisma/client';
import dayjs from 'dayjs';

interface SegmentRules {
    createdInLastDays?: number;
    hasPurchased?: boolean;
    isEngaged?: boolean;
    acqSource?: string;
    acqCampaign?: string;
    // Add more as needed
}

export class SegmentationService {

    /**
     * Checks if a subscriber meets the criteria for a set of rules.
     */
    static checkEligibility(sub: Subscriber, rulesJson: string | object): boolean {
        if (!rulesJson) return true; // No rules = everyone matches? Or no one? Assuming Open if empty.

        let rules: SegmentRules;
        try {
            rules = typeof rulesJson === 'string' ? JSON.parse(rulesJson) : rulesJson;
        } catch (e) {
            console.error("Invalid Segment Rules JSON:", e);
            return false; // Fail safe
        }

        const now = dayjs();

        // 1. Created Within X Days
        if (rules.createdInLastDays !== undefined) {
            const diffDays = now.diff(dayjs(sub.createdAt), 'day');
            if (diffDays > rules.createdInLastDays) return false;
        }

        // 2. Has Purchased
        if (rules.hasPurchased !== undefined) {
            // Check both flag and existence of date (robustness)
            const purchased = sub.hasPurchased || sub.totalPurchases > 0;
            if (purchased !== rules.hasPurchased) return false;
        }

        // 3. Is Engaged (Simple Check)
        if (rules.isEngaged !== undefined) {
            // Check if they have ANY last engagement date
            const engaged = !!sub.last_engagement;
            if (engaged !== rules.isEngaged) return false;
        }

        // 4. Acquisition Source
        if (rules.acqSource) {
            if (sub.acq_source !== rules.acqSource) return false;
        }

        // 5. Acquisition Campaign
        if (rules.acqCampaign) {
            if (sub.acq_campaign !== rules.acqCampaign) return false;
        }

        return true;
    }
}
