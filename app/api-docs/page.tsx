'use client';

import { useState } from 'react';
import { Code, Copy, Check, ChevronDown, ChevronRight } from 'lucide-react';

interface ApiEndpoint {
    name: string;
    method: string;
    path: string;
    description: string;
    authentication: string;
    requestBody: {
        field: string;
        type: string;
        required: boolean;
        description: string;
    }[];
    responseFields: {
        field: string;
        type: string;
        description: string;
    }[];
    exampleRequest: string;
    exampleResponse: string;
    notes?: string[];
}

const apiEndpoints: ApiEndpoint[] = [
    {
        name: 'Subscribe',
        method: 'POST',
        path: '/api/webhooks/subscribe',
        description: 'Creates or updates a subscriber in the system. Use this endpoint when a new user opts in to receive SMS messages. The endpoint automatically detects timezone based on the phone number area code and handles phone number normalization.',
        authentication: 'None (public endpoint)',
        requestBody: [
            { field: 'phone', type: 'string', required: true, description: 'Phone number of the subscriber. Can be 10 or 11 digits. 10-digit numbers are assumed US/Canada (+1).' },
            { field: 'name', type: 'string', required: false, description: 'Name of the subscriber. Defaults to "Subscriber" if not provided.' },
            { field: 'email', type: 'string', required: false, description: 'Email address of the subscriber.' },
            { field: 'keywords', type: 'string', required: false, description: 'Comma-separated keywords to determine subscription lists. Use "STOCK" for WSWD list, "TRADE" for TA list. If not provided, defaults to WSWD.' },
        ],
        responseFields: [
            { field: 'success', type: 'boolean', description: 'Whether the operation succeeded.' },
            { field: 'id', type: 'number', description: 'The subscriber ID (on success).' },
            { field: 'error', type: 'string', description: 'Error message (on failure).' },
        ],
        exampleRequest: `{
  "phone": "5551234567",
  "name": "John Doe",
  "email": "john@example.com",
  "keywords": "STOCK,TRADE"
}`,
        exampleResponse: `{
  "success": true,
  "id": 12345
}`,
        notes: [
            'Phone numbers are automatically normalized (non-digits removed, +1 prepended for 10-digit numbers).',
            'Timezone is automatically detected based on the phone number area code.',
            'If the subscriber already exists, their status is set to ACTIVE and subscriptions are updated.',
            'New subscribers have their last_engagement set to the signup time.',
        ],
    },
    {
        name: 'Enrich',
        method: 'POST',
        path: '/api/webhooks/enrich',
        description: 'Enriches an existing subscriber record with additional data such as email, name, form title, and custom traits. Use this to add data collected from landing pages or forms to an existing subscriber.',
        authentication: 'API Key required in request body',
        requestBody: [
            { field: 'api_key', type: 'string', required: true, description: 'Your API key for authentication. Must match APP_PASSWORD environment variable.' },
            { field: 'phone', type: 'string', required: true, description: 'Phone number to identify the subscriber. Used to look up the existing record.' },
            { field: 'email', type: 'string', required: true, description: 'Email address to add to the subscriber record.' },
            { field: 'name', type: 'string', required: false, description: 'Name to update on the subscriber record.' },
            { field: 'form_title', type: 'string', required: false, description: 'Title of the form/landing page where data was collected. Stored as context for the enrichment.' },
            { field: 'traits', type: 'object | string', required: false, description: 'Additional custom traits/attributes. Objects are JSON-stringified before storage.' },
        ],
        responseFields: [
            { field: 'success', type: 'boolean', description: 'Whether the operation succeeded.' },
            { field: 'id', type: 'number', description: 'The subscriber ID (on success).' },
            { field: 'message', type: 'string', description: 'Success message.' },
            { field: 'error', type: 'string', description: 'Error message (on failure).' },
        ],
        exampleRequest: `{
  "api_key": "your-api-key",
  "phone": "5551234567",
  "email": "john@example.com",
  "name": "John Doe",
  "form_title": "Stock Alerts Signup",
  "traits": {
    "interest": "day-trading",
    "experience": "beginner"
  }
}`,
        exampleResponse: `{
  "success": true,
  "id": 12345,
  "message": "Subscriber enriched successfully"
}`,
        notes: [
            'The subscriber must already exist in the system (created via subscribe endpoint or Lime sync).',
            'Returns 404 if no subscriber is found with the given phone number.',
            'Creates a tracking event of type "ENRICH" for analytics purposes.',
            'Phone number lookup tries both normalized and original format.',
        ],
    },
    {
        name: 'Send Direct',
        method: 'POST',
        path: '/api/send-direct',
        description: 'Sends an SMS message directly to a phone number, bypassing the normal queue and eligibility checks. Use this for immediate, targeted sends such as triggered messages or manual outreach.',
        authentication: 'API Key required in request body',
        requestBody: [
            { field: 'api_key', type: 'string', required: true, description: 'Your API key for authentication. Must match APP_PASSWORD environment variable.' },
            { field: 'phone', type: 'string', required: true, description: 'Phone number to send the message to.' },
            { field: 'messageId', type: 'number | string', required: false, description: 'ID of the message template to send. If not provided, the system will select an appropriate message.' },
        ],
        responseFields: [
            { field: 'success', type: 'boolean', description: 'Whether the message was sent successfully.' },
            { field: 'error', type: 'string', description: 'Error message (on failure).' },
        ],
        exampleRequest: `{
  "api_key": "your-api-key",
  "phone": "5551234567",
  "messageId": 42
}`,
        exampleResponse: `{
  "success": true
}`,
        notes: [
            'This endpoint bypasses normal queue processing and sends immediately.',
            'The subscriber must be opted-in to receive messages (opt-in status is verified with Lime).',
            'If messageId is not provided, the SmsService will select an appropriate message based on subscriber attributes.',
            'Use sparingly - this is designed for triggered/transactional sends, not bulk messaging.',
        ],
    },
    {
        name: 'Analytics',
        method: 'POST',
        path: '/api/webhooks/analytics',
        description: 'Receives and processes tracking events such as clicks and purchases. Integrates with your tracking system to attribute conversions back to subscribers and messages. Automatically updates subscriber engagement metrics.',
        authentication: 'API Key required in request body',
        requestBody: [
            { field: 'api_key', type: 'string', required: true, description: 'Your API key for authentication. Must match APP_PASSWORD environment variable.' },
            { field: 'event', type: 'string', required: true, description: 'Event type. Common values: "CLICK", "PURCHASE". Stored uppercase.' },
            { field: 'email', type: 'string', required: false, description: 'Email to match against subscribers. Used as primary lookup method.' },
            { field: 'phone', type: 'string', required: false, description: 'Phone number to match against subscribers. Used if email lookup fails.' },
            { field: 't202kw', type: 'string', required: false, description: 'Tracking keyword (message name). Used to attribute the event to a specific message.' },
            { field: 'revenue', type: 'number', required: false, description: 'Revenue amount for PURCHASE events. Added to subscriber\'s totalRevenue.' },
            { field: 'publisher', type: 'string', required: false, description: 'Publisher identifier.' },
            { field: 'offer', type: 'string', required: false, description: 'Offer identifier.' },
            { field: 'traffic_source', type: 'string', required: false, description: 'Traffic source name.' },
            { field: 'landing_page', type: 'string', required: false, description: 'Landing page URL or identifier.' },
            { field: 'traffic_source_account', type: 'string', required: false, description: 'Traffic source account identifier.' },
            { field: 'utm_source', type: 'string', required: false, description: 'UTM source parameter.' },
            { field: 'utm_medium', type: 'string', required: false, description: 'UTM medium parameter.' },
            { field: 'utm_term', type: 'string', required: false, description: 'UTM term parameter.' },
            { field: 'utm_content', type: 'string', required: false, description: 'UTM content parameter.' },
            { field: 'utm_campaign', type: 'string', required: false, description: 'UTM campaign parameter.' },
            { field: 'gclid', type: 'string', required: false, description: 'Google Click ID.' },
            { field: 'timestamp', type: 'string', required: false, description: 'Event timestamp (if different from receipt time).' },
        ],
        responseFields: [
            { field: 'success', type: 'boolean', description: 'Whether the event was processed successfully.' },
            { field: 'matched', type: 'boolean', description: 'Whether the event was matched to a subscriber.' },
            { field: 'eventId', type: 'number', description: 'ID of the created tracking event.' },
            { field: 'messageId', type: 'number | null', description: 'ID of the matched message (if t202kw resolved).' },
            { field: 'subscriberId', type: 'number | null', description: 'ID of the matched subscriber.' },
            { field: 'error', type: 'string', description: 'Error message (on failure).' },
        ],
        exampleRequest: `{
  "api_key": "your-api-key",
  "event": "PURCHASE",
  "email": "john@example.com",
  "phone": "5551234567",
  "t202kw": "wswd_promo_jan",
  "revenue": 49.99,
  "utm_source": "sms",
  "utm_campaign": "january_promo"
}`,
        exampleResponse: `{
  "success": true,
  "matched": true,
  "eventId": 789,
  "messageId": 42,
  "subscriberId": 12345
}`,
        notes: [
            'CLICK events update: hasClicked=true, totalClicks+1, firstClickAt (if first click), last_engagement.',
            'PURCHASE events update: hasPurchased=true, totalPurchases+1, totalRevenue+amount, firstPurchaseAt (if first purchase), last_engagement.',
            't202kw should match the "name" field of a message in your message pool for proper attribution.',
            'Subscriber matching tries email first, then phone number if email match fails.',
            'All tracking data is stored in TrackingEvent table for reporting.',
        ],
    },
];

function CodeBlock({ code, language = 'json' }: { code: string; language?: string }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="relative group">
            <pre className="bg-slate-950 border border-slate-700 rounded-lg p-4 overflow-x-auto text-sm">
                <code className="text-slate-300">{code}</code>
            </pre>
            <button
                onClick={handleCopy}
                className="absolute top-2 right-2 p-2 rounded-md bg-slate-800 hover:bg-slate-700 opacity-0 group-hover:opacity-100 transition-opacity"
            >
                {copied ? (
                    <Check className="w-4 h-4 text-lime-400" />
                ) : (
                    <Copy className="w-4 h-4 text-slate-400" />
                )}
            </button>
        </div>
    );
}

function ApiEndpointCard({ endpoint }: { endpoint: ApiEndpoint }) {
    const [isExpanded, setIsExpanded] = useState(true);

    const methodColors: Record<string, string> = {
        GET: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
        POST: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
        PUT: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
        DELETE: 'bg-red-500/20 text-red-400 border-red-500/30',
    };

    return (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full p-6 flex items-center justify-between hover:bg-slate-800/70 transition-colors"
            >
                <div className="flex items-center gap-4">
                    <span className={`px-3 py-1 rounded-md text-sm font-mono font-bold border ${methodColors[endpoint.method]}`}>
                        {endpoint.method}
                    </span>
                    <span className="text-xl font-semibold text-white">{endpoint.name}</span>
                    <code className="text-slate-400 font-mono text-sm">{endpoint.path}</code>
                </div>
                {isExpanded ? (
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                ) : (
                    <ChevronRight className="w-5 h-5 text-slate-400" />
                )}
            </button>

            {isExpanded && (
                <div className="px-6 pb-6 space-y-6">
                    <p className="text-slate-300">{endpoint.description}</p>

                    <div>
                        <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">Authentication</h4>
                        <p className="text-slate-300">{endpoint.authentication}</p>
                    </div>

                    <div>
                        <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Request Body</h4>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-700">
                                        <th className="text-left py-2 px-3 text-slate-400 font-medium">Field</th>
                                        <th className="text-left py-2 px-3 text-slate-400 font-medium">Type</th>
                                        <th className="text-left py-2 px-3 text-slate-400 font-medium">Required</th>
                                        <th className="text-left py-2 px-3 text-slate-400 font-medium">Description</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {endpoint.requestBody.map((field) => (
                                        <tr key={field.field} className="border-b border-slate-700/50">
                                            <td className="py-2 px-3 font-mono text-lime-400">{field.field}</td>
                                            <td className="py-2 px-3 font-mono text-slate-400">{field.type}</td>
                                            <td className="py-2 px-3">
                                                {field.required ? (
                                                    <span className="text-amber-400">Yes</span>
                                                ) : (
                                                    <span className="text-slate-500">No</span>
                                                )}
                                            </td>
                                            <td className="py-2 px-3 text-slate-300">{field.description}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                        <div>
                            <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Example Request</h4>
                            <CodeBlock code={endpoint.exampleRequest} />
                        </div>
                        <div>
                            <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Example Response</h4>
                            <CodeBlock code={endpoint.exampleResponse} />
                        </div>
                    </div>

                    <div>
                        <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Response Fields</h4>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-700">
                                        <th className="text-left py-2 px-3 text-slate-400 font-medium">Field</th>
                                        <th className="text-left py-2 px-3 text-slate-400 font-medium">Type</th>
                                        <th className="text-left py-2 px-3 text-slate-400 font-medium">Description</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {endpoint.responseFields.map((field) => (
                                        <tr key={field.field} className="border-b border-slate-700/50">
                                            <td className="py-2 px-3 font-mono text-lime-400">{field.field}</td>
                                            <td className="py-2 px-3 font-mono text-slate-400">{field.type}</td>
                                            <td className="py-2 px-3 text-slate-300">{field.description}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {endpoint.notes && endpoint.notes.length > 0 && (
                        <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4">
                            <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Notes</h4>
                            <ul className="space-y-2">
                                {endpoint.notes.map((note, index) => (
                                    <li key={index} className="flex items-start gap-2 text-slate-300 text-sm">
                                        <span className="text-lime-400 mt-0.5">*</span>
                                        <span>{note}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default function ApiDocsPage() {
    return (
        <div className="p-8 max-w-6xl mx-auto">
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 bg-gradient-to-br from-lime-500/20 to-emerald-500/20 rounded-xl border border-lime-500/20">
                        <Code className="w-8 h-8 text-lime-400" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-white">API Documentation</h1>
                        <p className="text-slate-400">Integrate with Lime SMS using these webhook endpoints</p>
                    </div>
                </div>
            </div>

            <div className="bg-slate-800/30 border border-slate-700 rounded-xl p-6 mb-8">
                <h2 className="text-lg font-semibold text-white mb-4">Base URL</h2>
                <CodeBlock code={`https://your-domain.com`} />
                <p className="text-slate-400 text-sm mt-3">
                    Replace with your actual deployment URL. All endpoints accept JSON payloads with <code className="text-lime-400">Content-Type: application/json</code>.
                </p>
            </div>

            <div className="bg-slate-800/30 border border-slate-700 rounded-xl p-6 mb-8">
                <h2 className="text-lg font-semibold text-white mb-4">Authentication</h2>
                <p className="text-slate-300 mb-4">
                    Most endpoints require an API key passed in the request body as <code className="text-lime-400">api_key</code>.
                    This key must match the <code className="text-lime-400">APP_PASSWORD</code> environment variable configured on the server.
                </p>
                <p className="text-slate-400 text-sm">
                    The <strong className="text-white">Subscribe</strong> endpoint is public and does not require authentication,
                    as it is designed to receive opt-ins from landing pages.
                </p>
            </div>

            <div className="space-y-6">
                <h2 className="text-xl font-semibold text-white">Endpoints</h2>
                {apiEndpoints.map((endpoint) => (
                    <ApiEndpointCard key={endpoint.path} endpoint={endpoint} />
                ))}
            </div>

            <div className="mt-8 bg-slate-800/30 border border-slate-700 rounded-xl p-6">
                <h2 className="text-lg font-semibold text-white mb-4">Error Handling</h2>
                <p className="text-slate-300 mb-4">
                    All endpoints return consistent error responses with the following structure:
                </p>
                <CodeBlock code={`{
  "success": false,
  "error": "Description of what went wrong"
}`} />
                <div className="mt-4">
                    <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">HTTP Status Codes</h3>
                    <ul className="space-y-2 text-sm">
                        <li className="flex items-center gap-3">
                            <span className="font-mono text-emerald-400">200</span>
                            <span className="text-slate-300">Success</span>
                        </li>
                        <li className="flex items-center gap-3">
                            <span className="font-mono text-amber-400">400</span>
                            <span className="text-slate-300">Bad Request - Missing or invalid parameters</span>
                        </li>
                        <li className="flex items-center gap-3">
                            <span className="font-mono text-red-400">401</span>
                            <span className="text-slate-300">Unauthorized - Invalid or missing API key</span>
                        </li>
                        <li className="flex items-center gap-3">
                            <span className="font-mono text-orange-400">404</span>
                            <span className="text-slate-300">Not Found - Resource does not exist</span>
                        </li>
                        <li className="flex items-center gap-3">
                            <span className="font-mono text-red-400">500</span>
                            <span className="text-slate-300">Internal Server Error - Something went wrong on the server</span>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
