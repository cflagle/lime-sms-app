const axios = require('axios');

async function testDirectSend() {
    const phone = '14438049313'; // User's number for validation
    console.log(`Testing Direct Send to ${phone}...`);

    try {
        const res = await axios.post('http://localhost:3000/api/send-direct', {
            phone: phone
            // messageId: 1 // Optional
        });
        console.log("Success:", res.data);
    } catch (error) {
        if (error.response) {
            console.error("Error Response:", error.response.status, error.response.data);
        } else {
            console.error("Error:", error.message);
        }
    }
}

testDirectSend();
