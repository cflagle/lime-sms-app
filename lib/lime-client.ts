import axios from 'axios';
import xml2js from 'xml2js';

const LIME_BASE_URL = 'https://mcpn.us/limeApi';

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
     */
    static async getOptedInNumbers(listId: string) {
        try {
            const config = getLimeConfig();
            const params = new URLSearchParams();
            params.append('ev', 'optedInNumbers');
            params.append('user', config.user);
            params.append('api_id', config.apiId);
            params.append('optInListId', listId);

            const response = await axios.get(LIME_BASE_URL, { params, responseType: 'text' });

            // Parse XML response
            const parser = new xml2js.Parser({ explicitArray: false });
            const result = await parser.parseStringPromise(response.data);

            // Normalize result to array
            // Structure: <Mobiles><Mobile>...</Mobile></Mobiles>
            // If one item, xml2js might return object. If multiple, array.
            // If empty, Mobiles might be empty string or null.

            if (!result || !result.Mobiles) return [];

            const mobiles = result.Mobiles.Mobile;

            if (Array.isArray(mobiles)) {
                return mobiles;
            } else if (mobiles) {
                return [mobiles];
            }

            return [];
        } catch (error: any) {
            console.error('Failed to fetch opted in numbers:', error.message);
            throw error;
        }
    }

    /**
     * Checks if a specific mobile number is opted-in (status 'Active').
     * Returns true if Active, false otherwise.
     */
    static async checkOptInStatus(mobile: string): Promise<boolean> {
        try {
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
}
