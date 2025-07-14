const axios = require('axios');

// Function Declaration
async function fetchCryptoData(symbols) {
    const apiKey = ' CCMZ32I4AIAR1CSW';
    const cryptoData = [];

    for (const symbol of symbols) {
        const url = `https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=${symbol}&to_currency=USD&apikey=${apiKey}`;

        try {
            const response = await axios.get(url);
            const data = response.data['Realtime Currency Exchange Rate'];

            cryptoData.push({
                currency_name: data['2. From_Currency Name'],
                currency_symbol: data['1. From_Currency Code'],
                market_price: parseFloat(data['5. Exchange Rate']),
                timestamp: new Date().toISOString(),  // or the time from the API response if available
            });
        } catch (error) {
            console.error('Error fetching data from Alpha Vantage:', error);
        }
    }

    return cryptoData;
}

// Exporting the function
module.exports = fetchCryptoData;
