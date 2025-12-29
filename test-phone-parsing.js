
const { parsePhoneNumber } = require('libphonenumber-js');

const phones = ['12132965329', '+12132965329', '2132965329'];

phones.forEach(p => {
    try {
        console.log(`Parsing '${p}' (no country):`);
        const phoneNumber = parsePhoneNumber(p); // No 'US'
        if (phoneNumber) {
            console.log(`  Country: ${phoneNumber.country}`);
            console.log(`  National: ${phoneNumber.nationalNumber}`);
        } else {
            console.log(`  Result: undefined`);
        }
    } catch (e) {
        console.log(`  Error: ${e.message}`);
    }
    console.log('---');
});
