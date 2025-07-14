const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bcrypt = require('bcrypt');
const fetchCryptoData = require('./Data/fetchCryptoData');


const app = express();
const port = 3001;  

app.use(cors());  
app.use(express.json());  

// Create a MySQL connection
const db = mysql.createConnection({
    host: 'localhost',       
    user: 'root',            
    password: 'Luy@nda2427!',
    database: 'financial_analysis',  
});

// Test database connection
db.connect(err => {
    if (err) {
        console.error('Error connecting to the database:', err);
        return;
    }
    console.log('Connected to the MySQL database');
    initializeTables();
});
// Generic function to fetch data from Alpha Vantage
async function fetchAlphaVantageData(functionType, symbol, interval = 'daily', outputsize = 'compact') {
    const apiKey = 'YOUR_ALPHA_VANTAGE_API_KEY';
    const baseUrl = `https://www.alphavantage.co/query?function=${functionType}&symbol=${symbol}&apikey=${apiKey}&outputsize=${outputsize}`;

    try {
        const response = await axios.get(baseUrl);
        return response.data;
    } catch (error) {
        console.error(`Error fetching data from Alpha Vantage:`, error);
        return null;
    }
}

function initializeTables() {
    const tableQueries = [
        `CREATE TABLE IF NOT EXISTS crypto_data (
            id INT AUTO_INCREMENT PRIMARY KEY,
            currency_name VARCHAR(50),
            currency_symbol VARCHAR(10),
            market_price DECIMAL(18, 8),
            timestamp DATETIME,
            UNIQUE(currency_symbol, timestamp)
        )`,
        `CREATE TABLE IF NOT EXISTS stock_data (
            id INT AUTO_INCREMENT PRIMARY KEY,
            symbol VARCHAR(10),
            open DECIMAL(18, 8),
            high DECIMAL(18, 8),
            low DECIMAL(18, 8),
            close DECIMAL(18, 8),
            volume BIGINT,
            timestamp DATETIME,
            UNIQUE(symbol, timestamp)
        )`,
        `CREATE TABLE IF NOT EXISTS forex_data (
            id INT AUTO_INCREMENT PRIMARY KEY,
            from_currency VARCHAR(10),
            to_currency VARCHAR(10),
            open DECIMAL(18, 8),
            high DECIMAL(18, 8),
            low DECIMAL(18, 8),
            close DECIMAL(18, 8),
            timestamp DATETIME,
            UNIQUE(from_currency, to_currency, timestamp)
        )`,
        `CREATE TABLE IF NOT EXISTS fundamental_data (
            id INT AUTO_INCREMENT PRIMARY KEY,
            symbol VARCHAR(10) UNIQUE,
            name VARCHAR(100),
            market_cap BIGINT,
            eps DECIMAL(18, 8),
            pe_ratio DECIMAL(10, 2),
            description TEXT
        )`
    ];

    tableQueries.forEach(query => {
        db.query(query, (err, result) => {
            if (err) console.error('Error creating table:', err);
        });
    });
}

app.get('/api/crypto', async (req, res) => {
    const symbols = ['BTC', 'ETH', 'LTC'];
    const cryptoData = await Promise.all(symbols.map(symbol => fetchAlphaVantageData('DIGITAL_CURRENCY_DAILY', symbol, 'USD')));

    const insertPromises = cryptoData.flatMap(data => {
        if (data) {
            return Object.entries(data['Time Series (Digital Currency Daily)']).map(([timestamp, values]) => {
                const sql = `
                    INSERT INTO crypto_data (currency_name, currency_symbol, market_price, timestamp)
                    VALUES (?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE market_price = VALUES(market_price)
                `;
                return new Promise((resolve, reject) => {
                    db.query(sql, ['Crypto Name', symbol, values['1a. open (USD)'], timestamp], (err, result) => {
                        if (err) reject(err);
                        else resolve(result);
                    });
                });
            });
        }
        return [];
    });

    try {
        await Promise.all(insertPromises);
        res.json({ message: 'Crypto data stored successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to insert crypto data' });
    }
});


app.get('/api/stock/:symbol/:interval', async (req, res) => {
    const { symbol, interval } = req.params;
    const functionType = `TIME_SERIES_${interval.toUpperCase()}`;  // daily, weekly, monthly

    const stockData = await fetchAlphaVantageData(functionType, symbol);

    if (stockData) {
        const insertPromises = Object.entries(stockData[`Time Series (${interval.toUpperCase()})`]).map(([timestamp, values]) => {
            const sql = `
                INSERT INTO stock_data (symbol, open, high, low, close, volume, timestamp)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE open = VALUES(open), high = VALUES(high), low = VALUES(low), close = VALUES(close), volume = VALUES(volume)
            `;
            return new Promise((resolve, reject) => {
                db.query(sql, [symbol, values['1. open'], values['2. high'], values['3. low'], values['4. close'], values['5. volume'], timestamp], (err, result) => {
                    if (err) reject(err);
                    else resolve(result);
                });
            });
        });

        try {
            await Promise.all(insertPromises);
            res.json({ message: 'Stock data stored successfully' });
        } catch (error) {
            res.status(500).json({ message: 'Failed to insert stock data' });
        }
    } else {
        res.status(500).json({ message: 'Failed to fetch stock data' });
    }
});


app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

