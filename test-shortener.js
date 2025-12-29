const axios = require('axios');

async function verify() {
    try {
        console.log("Testing POST http://localhost:3010/api/shorten ...");
        const res = await axios.post('http://localhost:3010/api/shorten', {
            url: 'https://google.com',
            name: 'Verification Link 2'
        });

        console.log("Response Status:", res.status);
        console.log("Response Data:", JSON.stringify(res.data, null, 2));

        if (res.data.success && res.data.shortLink) {
            console.log("VERIFICATION SUCCESS: Short link generated.");
        } else {
            console.log("VERIFICATION FAILED: Missing success/shortLink.");
        }
    } catch (e) {
        console.error("VERIFICATION FAILED:", e.response ? e.response.data : e.message);
    }
}

verify();
