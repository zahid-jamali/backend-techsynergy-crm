const axios = require('axios');

async function convertCurrency(amount, from, to) {
	try {
		const response = await axios.get(
			`https://open.er-api.com/v6/latest/${from}`
		);

		const rate = response.data.rates[to];
		const convertedAmount = amount * rate;

		return convertedAmount;
	} catch (error) {
		console.error('Error:', error.message);
	}
}

module.exports = convertCurrency;
