const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');

const app = express();
const port = 5001;

app.use(cors());
app.use(express.json());

const uri = 'mongodb://localhost:27017/Financial_analysis';

mongoose.connect(uri)
  .then(() => {
    console.log("Connected to MongoDB!");
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
  });

const stockDataSchema = new mongoose.Schema({
    stock_symbol: String,
    timestamp: Date,
    close_price: Number,
});

const StockData = mongoose.model('StockData', stockDataSchema);

app.get('/chart/:stockSymbol', async (req, res) => {
    const { stockSymbol } = req.params;
    
    try {
        const data = await StockData.find({ stock_symbol: stockSymbol }).sort({ timestamp: 1 });

        if (!data || data.length === 0) {
            return res.status(404).json({ message: 'No data found for this stock symbol' });
        }

        const labels = data.map(item => item.timestamp.toISOString().split('T')[0]); 
        const prices = data.map(item => item.close_price); 

        const width = 800; 
        const height = 400; 
        const canvasRenderService = new ChartJSNodeCanvas({ width, height });

        const configuration = {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: `${stockSymbol} Stock Price`,
                    data: prices,
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1,
                    fill: false,
                }],
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: `${stockSymbol} Stock Price Over Time`,
                    },
                },
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: 'day',
                        },
                        title: {
                            display: true,
                            text: 'Date',
                        },
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Price (USD)',
                        },
                    },
                },
            },
        };

        const imageBuffer = await canvasRenderService.renderToBuffer(configuration);

        res.set('Content-Type', 'image/png');
        res.send(imageBuffer);
    } catch (err) {
        console.error('Error generating chart:', err);
        res.status(500).json({ message: 'Error generating chart' });
    }
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
