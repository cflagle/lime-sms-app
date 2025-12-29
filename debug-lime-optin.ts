require('dotenv').config();
const axios = require('axios');
const xml2js = require('xml2js');

const LIME_BASE_URL = 'https://mcpn.us/limeApi';
const config = {
    user: process.env.LIME_USER,
    apiId: process.env.LIME_API_ID
};

async function testOptIn(mobile, label) {
    console.log(`\n--- Testing ${label}: ${mobile} ---`);
    try {
        const params = new URLSearchParams();
        params.append('ev', 'optinStatus');
        params.append('user', config.user);
        params.append('api_id', config.apiId);
        params.append('mobile', mobile);

        console.log(`URL: ${LIME_BASE_URL}?${params.toString()}`);

        const response = await axios.get(LIME_BASE_URL, { params, responseType: 'text' });
        console.log("Response Status:", response.status);
        console.log("Response Data:", response.data);
    } catch (error) {
        console.error("Error Status:", error.response?.status);
        console.error("Error Data:", error.response?.data);
        console.error("Error Message:", error.message);
    }
}

async function main() {
    if (!config.user) {
        console.error("Missing LIME_USER or LIME_API_ID in .env");
        return;
    }

    // 1. Try with 11 digits (current failure)
    await testOptIn('14438049313', '11 Digits');

    // 2. Try with 10 digits
    await testOptIn('4438049313', '10 Digits');
}

main();
