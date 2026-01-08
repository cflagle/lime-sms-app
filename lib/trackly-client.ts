import axios from 'axios';

const TRACKLY_BASE_URL = 'https://tracklysms.com/api/v1';

/**
 * Token bucket rate limiter to prevent API throttling.
 * Allows bursts up to maxTokens, then throttles to refillRate per second.
 */
class RateLimiter {
    private tokens: number;
    private lastRefill: number;
    private maxTokens: number;
    private refillRate: number;

    constructor(maxPerSecond: number) {
        this.maxTokens = maxPerSecond;
        this.tokens = maxPerSecond;
        this.refillRate = maxPerSecond;
        this.lastRefill = Date.now();
    }

    async acquire(): Promise<void> {
        this.refill();
        if (this.tokens < 1) {
            const waitMs = Math.ceil((1 / this.refillRate) * 1000);
            await new Promise(r => setTimeout(r, waitMs));
            return this.acquire();
        }
        this.tokens--;
    }

    private refill(): void {
        const now = Date.now();
        const elapsed = (now - this.lastRefill) / 1000;
        this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
        this.lastRefill = now;
    }
}

// Rate limiter: 50 requests/second to Trackly API (adjust if needed)
const limiter = new RateLimiter(50);

function getTracklyConfig() {
    return {
        apiKey: process.env.TRACKLY_API_KEY || '',
        phoneNumberId: process.env.TRACKLY_PHONE_NUMBER_ID || '',
    };
}

export class TracklyClient {
    /**
     * Sends a one-way SMS via Trackly.
     * @param mobile - Phone number in E.164 format (e.g., +15551234567)
     * @param message - Message text
     */
    static async sendSMS(mobile: string, message: string) {
        try {
            await limiter.acquire();

            const config = getTracklyConfig();
            const response = await axios.post(
                `${TRACKLY_BASE_URL}/messages`,
                {
                    to_msisdn: mobile,
                    body: message,
                    from_phone_number_id: config.phoneNumberId
                },
                {
                    headers: {
                        'X-Api-Key': config.apiKey,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (response.data && response.data.error) {
                throw new Error(`Trackly API Error: ${response.data.error}`);
            }
            return response.data;
        } catch (error: any) {
            console.error('Failed to send SMS via Trackly:', error.message);
            if (error.response) {
                console.error('Trackly Response Data:', error.response.data);
            }
            throw error;
        }
    }

    /**
     * Checks if a specific mobile number is opted-in (status 'subscribed').
     * Returns true if subscribed and not opted-out, false otherwise.
     * @param mobile - Phone number in E.164 format
     */
    static async checkOptInStatus(mobile: string): Promise<boolean> {
        try {
            await limiter.acquire();

            const config = getTracklyConfig();
            const response = await axios.get(
                `${TRACKLY_BASE_URL}/contacts/${encodeURIComponent(mobile)}`,
                {
                    headers: { 'X-Api-Key': config.apiKey }
                }
            );

            // Response format:
            // { phone_number, status: "subscribed", opted_out: null | timestamp, contact: {...} }
            // Check status field: "subscribed" = opted in
            // opted_out field: null = not opted out, timestamp = opted out
            const isSubscribed = response.data.status === 'subscribed';
            const isNotOptedOut = !response.data.opted_out;

            return isSubscribed && isNotOptedOut;
        } catch (error: any) {
            if (error.response?.status === 404) {
                // Contact not found - treat as not opted in
                console.warn(`Trackly Check: Contact ${mobile} not found (404)`);
                return false;
            }
            console.error(`Trackly Check Failed for ${mobile}:`, error.message);
            return false;
        }
    }

    /**
     * Opts out a phone number from Trackly.
     * @param mobile - Phone number in E.164 format
     * @param reason - Reason for opt-out (default: 'USER_REQUEST')
     */
    static async optOut(mobile: string, reason: string = 'USER_REQUEST'): Promise<boolean> {
        try {
            await limiter.acquire();

            const config = getTracklyConfig();
            await axios.post(
                `${TRACKLY_BASE_URL}/opt-outs`,
                {
                    to_msisdn: mobile,
                    reason: reason
                },
                {
                    headers: {
                        'X-Api-Key': config.apiKey,
                        'Content-Type': 'application/json'
                    }
                }
            );

            console.log(`[Trackly OptOut] Successfully opted out ${mobile} (reason: ${reason})`);
            return true;
        } catch (error: any) {
            console.error(`Trackly OptOut Failed for ${mobile}:`, error.message);
            return false;
        }
    }

    /**
     * Fetches contacts for sync (paginated).
     * @param limit - Max results per page (default: 100)
     * @param offset - Pagination offset (default: 0)
     */
    static async getContacts(limit: number = 100, offset: number = 0): Promise<any[]> {
        try {
            const config = getTracklyConfig();
            const response = await axios.get(
                `${TRACKLY_BASE_URL}/contacts?limit=${limit}&offset=${offset}`,
                {
                    headers: { 'X-Api-Key': config.apiKey }
                }
            );

            return response.data.contacts || [];
        } catch (error: any) {
            console.error('Failed to fetch Trackly contacts:', error.message);
            throw error;
        }
    }
}
