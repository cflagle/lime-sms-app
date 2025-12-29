const axios = require('axios');

const config = {
    user: 'charles@rif.marketing',
    apiId: 'S4UWmQBaZ7yeF4z1',
    baseUrl: 'https://mcpn.us/limeApi'
};

const testUrl = "https://t.trklv.com/tracking202/redirect/dl.php?t202id=744358&c2=%EMAIL%&c3=%GENDER%&utm_source=Lime&utm_medium=SMS&utm_campaign=%DATE%_&t202kw=bnf-ailauchbe-cto1";

async function testLinkShortener() {
    console.log("Testing createTrackingLink variations...");

    const attempts = [
        { name: "ev=createTrackingLink (URL)", url: `${config.baseUrl}?ev=createTrackingLink` },
        { name: "ev=CreateTrackingLink (URL)", url: `${config.baseUrl}?ev=CreateTrackingLink` },
        { name: "ev=trackingLink (URL)", url: `${config.baseUrl}?ev=trackingLink` },
        { name: "ev=tracking_link (URL)", url: `${config.baseUrl}?ev=tracking_link` },
        { name: "ev=create_tracking_link (URL)", url: `${config.baseUrl}?ev=create_tracking_link` },
        { name: "ev=shortenLink (URL)", url: `${config.baseUrl}?ev=shortenLink` },
        { name: "ev=shorten (URL)", url: `${config.baseUrl}?ev=shorten` },
        { name: "ev=createShortLink (URL)", url: `${config.baseUrl}?ev=createShortLink` },
        { name: "ev=links (URL)", url: `${config.baseUrl}?ev=links` },
        { name: "ev=campaignLink (URL)", url: `${config.baseUrl}?ev=campaignLink` },
    ];

    for (const attempt of attempts) {
        try {
            console.log(`\nTesting ${attempt.name}...`);
            const params = new URLSearchParams();
            params.append('user', config.user);
            params.append('api_id', config.apiId);
            params.append('name', 'Debug Link');
            params.append('url', testUrl);
            params.append('isTrackUsers', 'true');

            // Timeout to prevent hanging
            const res = await axios.post(attempt.url, params, { timeout: 5000 });
            console.log(`SUCCESS [${attempt.name}]:`, res.data);
            return; // Found it!
        } catch (e) {
            const errData = e.response ? JSON.stringify(e.response.data) : e.message;
            console.log(`FAILED [${attempt.name}]:`, errData.substring(0, 100));
        }
    }
    console.log("\nAll attempts failed.");
}

testLinkShortener();
