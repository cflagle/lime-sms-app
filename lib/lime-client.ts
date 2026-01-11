import axios from 'axios';
import xml2js from 'xml2js';
import sax from 'sax';

const LIME_BASE_URL = 'https://mcpn.us/limeApi';

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

// Rate limiter: 50 requests/second to Lime API (adjust if needed)
const limiter = new RateLimiter(50);

function getLimeConfig() {
    return {
        user: process.env.LIME_USER || '',
        apiId: process.env.LIME_API_ID || '',
    };
}

export class LimeClient {
    /**
     * Sends a one-way SMS to a mobile number.
     * Note: The API does not seemingly allow "from" number selection explicitly in the parameters found,
     * but it relies on the account settings or the 'user'/'api_id' context.
     */
    static async sendSMS(mobile: string, message: string) {
        try {
            // Rate limit to prevent API throttling
            await limiter.acquire();

            // Updated to use correct One-way SMS API endpoint
            // Docs: https://mcpn.us/sendsmsapi?user=...&api_id=...&mobile=...&message=...

            const config = getLimeConfig();
            const params = new URLSearchParams();
            // params.append('ev', 'Send'); // Remove 'ev' for this endpoint
            params.append('user', config.user);
            params.append('api_id', config.apiId);
            params.append('mobile', mobile);
            params.append('message', message);
            // params.append('json', 'true'); // Does sendsmsapi support json response? 
            // Docs say "returns an XML or JSON file". Let's try keeping json=true or accept header.
            // Usually params like &json=1 or &output=json work. Let's try to keep it simple first.
            // Search result said: "The API can be used with either URL parameters, or by supplying an XML or JSON file". 
            // It didn't explicitly say it RETURNS JSON if referenced. 
            const response = await axios.get('https://mcpn.us/sendsmsapi', { params });

            if (response.data && response.data.error) {
                throw new Error(`Lime API Error: ${response.data.error_text || 'Unknown error'}`);
            }
            return response.data;
        } catch (error: any) {
            console.error('Failed to send SMS:', error.message);
            if (error.response) {
                console.error('Lime Response Data:', error.response.data);
            }
            throw error;
        }
    }

    /**
     * Creates a tracking link.
     */
    static async createTrackingLink(url: string, name: string, listId?: number) {
        try {
            // Updated to use the correct endpoint from docs: https://mcpn.us/apiTrackingLink
            // Method: POST (JSON)
            // Fields: user, apiId, name, domain, url, isTrackUsers, etc.

            const config = getLimeConfig();
            const domain = process.env.LIME_DOMAIN || 'sms1.px1.co'; // Updated to sms1.px1.co based on CNAME lookup

            const body = {
                user: config.user,
                apiId: config.apiId, // camelCase 'apiId'
                name: name,
                domain: domain,
                url: url,
                isTrackUsers: true,
                ...(listId && { listId })
            };

            const response = await axios.post('https://mcpn.us/apiTrackingLink', body);

            if (response.data && (response.data.errorCode || response.data.error)) {
                // Docs say error response has errorCode and message
                throw new Error(`Lime Link Error: ${response.data.message || 'Unknown Error'}`);
            }

            return response.data;
        } catch (error: any) {
            console.error('Failed to create tracking link:', error.message);
            if (error.response?.data) {
                const msg = error.response.data.message || error.response.data.error_text;
                if (msg) throw new Error(`Lime Link Error: ${msg}`);
            }
            throw error;
        }
    }

    /**
     * Fetches subscribers from a list using the OptedInNumbers API (XML).
     * USES STREAMING PARSING to avoid memory leaks with large lists.
     */
    static async getOptedInNumbers(listId: string): Promise<any[]> {
        return new Promise(async (resolve, reject) => {
            try {
                const config = getLimeConfig();
                const params = new URLSearchParams();
                params.append('ev', 'optedInNumbers');
                params.append('user', config.user);
                params.append('api_id', config.apiId);
                params.append('optInListId', listId);

                console.log(`[Lime] Starting streaming fetch for list ${listId}...`);

                const response = await axios.get(LIME_BASE_URL, {
                    params,
                    responseType: 'stream', // <--- CRITITCAL: Stream the response
                    timeout: 600000,
                    maxBodyLength: Infinity
                });

                const mobiles: any[] = [];
                const saxStream = sax.createStream(true, {
                    trim: true,
                    normalize: true,
                    lowercase: false
                });

                let currentTag = '';
                let currentMobile: any = {};

                saxStream.on('opentag', (node: any) => {
                    currentTag = node.name;
                    if (currentTag === 'Mobile') {
                        currentMobile = {};
                    }
                });

                saxStream.on('text', (text: string) => {
                    if (currentMobile && currentTag) {
                        // Map fields immediately
                        // Structure: <Mobile><MobileNumber>...</MobileNumber><FirstName>...
                        if (currentTag === 'MobileNumber') currentMobile.MobileNumber = text;
                        else if (currentTag === 'FirstName') currentMobile.FirstName = text;
                        else if (currentTag === 'LastName') currentMobile.LastName = text;
                        else if (currentTag === 'Email') currentMobile.Email = text;
                        else if (currentTag === 'Keyword') currentMobile.Keyword = text;
                    }
                });

                saxStream.on('closetag', (tagName: string) => {
                    if (tagName === 'Mobile') {
                        // Push finished object
                        if (currentMobile && currentMobile.MobileNumber) {
                            mobiles.push(currentMobile);
                        }
                        currentMobile = null;

                        // Periodic GC hint / log? 
                        if (mobiles.length % 5000 === 0) {
                            // console.log(`[Lime] Streamed ${mobiles.length} records...`);
                        }
                    }
                });

                saxStream.on('error', (e: any) => {
                    console.error("[Lime] XML Stream Error:", e);
                    // Don't reject immediately, maybe partial data is okay? 
                    // But for now let's reject to be safe.
                    reject(e);
                });

                saxStream.on('end', () => {
                    console.log(`[Lime] Streaming complete. Fetched ${mobiles.length} records.`);
                    resolve(mobiles);
                });

                // Pipe axios stream to sax
                response.data.pipe(saxStream);

            } catch (error: any) {
                console.error('Failed to fetch opted in numbers:', error.message);
                reject(error);
            }
        });
    }

    /**
     * Checks if a specific mobile number is opted-in (status 'Active').
     * Returns true if Active, false otherwise.
     */
    static async checkOptInStatus(mobile: string): Promise<boolean> {
        try {
            // Rate limit to prevent API throttling
            await limiter.acquire();

            // Updated based on docs: https://mcpn.us/limeApi?ev=optinStatus&...&type=optin
            const config = getLimeConfig();
            const params = new URLSearchParams();
            params.append('ev', 'optinStatus');
            params.append('user', config.user);
            params.append('api_id', config.apiId);
            params.append('mobile', mobile);
            params.append('type', 'optin'); // Required parameter

            const response = await axios.get(LIME_BASE_URL, { params, responseType: 'text' });

            const parser = new xml2js.Parser({ explicitArray: false });
            const result = await parser.parseStringPromise(response.data);

            // Response format: <lists type="optin"><list>...</list></lists>
            if (result && result.lists) {
                // If there are lists, it means they are opted in to at least one.
                // xml2js: if empty, result.lists.list might be undefined.
                // if one, result.lists.list is object. if many, array.
                const lists = result.lists.list;
                if (lists) {
                    // Check if it's an array or single object, either way it exists
                    return true;
                }
                // If lists tag exists but is empty (e.g. <lists type="optin" />), then false
                return false;
            }

            // Fallback/Safety
            console.warn(`Lime Check: Unexpected XML structure for ${mobile}`, result);
            return false;
        } catch (error: any) {
            console.error(`Lime Check Failed for ${mobile}:`, error.message);
            return false;
        }
    }

    /**
     * Opts out a phone number from Lime Cellular.
     * Uses the ev=optout API endpoint with list_id.
     * @param mobile - Phone number to opt out
     * @param listId - Opt-in List ID (from config.limeListId)
     */
    static async optOut(mobile: string, listId: string): Promise<boolean> {
        try {
            await limiter.acquire();

            const config = getLimeConfig();
            const params = new URLSearchParams();
            params.append('ev', 'optout');
            params.append('user', config.user);
            params.append('api_id', config.apiId);
            params.append('mobile', mobile);
            params.append('list_id', listId);

            await axios.get(LIME_BASE_URL, { params });
            console.log(`[Lime OptOut] Successfully opted out ${mobile} from list ${listId}`);
            return true;
        } catch (error: any) {
            console.error(`Lime OptOut Failed for ${mobile}:`, error.message);
            return false;
        }
    }
}
