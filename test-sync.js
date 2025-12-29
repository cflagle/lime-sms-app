const axios = require('axios');

const config = {
    user: 'charles@rif.marketing',
    apiId: 'S4UWmQBaZ7yeF4z1',
    baseUrl: 'https://mcpn.us/limeApi'
};

async function testVariant(name, paramsObj) {
    console.log(`\n--- Testing Variant: ${name} ---`);
    try {
        const params = new URLSearchParams();
        params.append('user', config.user);
        params.append('api_id', config.apiId);
        for (const [k, v] of Object.entries(paramsObj)) {
            params.append(k, v);
        }

        console.log("Params:", params.toString());
        const response = await axios.get(config.baseUrl, { params });
        console.log("Status:", response.status);
        const str = JSON.stringify(response.data, null, 2);
        console.log("Response Preview:", str.substring(0, 500));
    } catch (e) {
        console.error("Failed:", e.message);
        if (e.response && e.response.data) {
            console.error("Error Data:", JSON.stringify(e.response.data));
        }
    }
}

async function run() {
    // 1. camelCase listId
    await testVariant('leadLists (listId)', { ev: 'leadLists', listId: '135859' });

    // 2. all=true
    await testVariant('leadLists (all=true)', { ev: 'leadLists', all: 'true' });

    // 3. all empty
    await testVariant('leadLists (all=)', { ev: 'leadLists', all: '' });

    // 4. leads event with camelCase
    await testVariant('leads (listId)', { ev: 'leads', listId: '135859' });
}

run();
