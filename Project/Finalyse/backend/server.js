const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcrypt');
const authenticate = require('./authMiddleware');
const jwt = require('jsonwebtoken');
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
const nodemailer = require("nodemailer");
const dotenv = require("dotenv");


const app = express();
const port = 5001; 

dotenv.config();


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

  const clientSchema = new mongoose.Schema({
    name: String,
    surname: String,
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    resetToken: String,  // Add this field
    resetTokenExpiration: Date, // Add expiration date for token
  });
  
const Client = mongoose.model('Client', clientSchema);

app.post('/clients', async (req, res) => {
    const { name, surname, email, password } = req.body;

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        const client = new Client({
            name,
            surname,
            email,
            password: hashedPassword,
        });

        await client.save();

        res.status(201).json({ message: 'Client registered successfully!' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error registering client.' });
    }
});
const secretKey = process.env.JWT_SECRET || 'xcnxcbsdubdsusesdhj';



const adminSchema = new mongoose.Schema({
    name: String,
    surname: String,
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, default: 'admin' },
});

const Admin = mongoose.model('Admin', adminSchema);


app.post('/admins', async (req, res) => {
    const { name, surname, email, password, role } = req.body;

    try {
        const existingAdmin = await Admin.findOne({ email });
        if (existingAdmin) {
            return res.status(400).json({ error: 'Email already exists' });
        }
        const hashedPassword = await bcrypt.hash(password, 10);

        const admin = new Admin({
            name,
            surname,
            email,
            password: hashedPassword,
            role,
        });

        await admin.save();

        res.status(201).json({ message: 'Admin registered successfully!' });
    } catch (error) {
        console.error('Error registering admin:', error);
        res.status(500).json({ error: 'Error registering administrator.' });
    }
});
app.post('/Adminlogin', async (req, res) => {
  const { email, password } = req.body;

  try {
      const admin = await Admin.findOne({ email });

      if (!admin) {
          return res.status(401).json({ message: 'Invalid credentials' });
      }

      const passwordMatch = await bcrypt.compare(password, admin.password);

      if (!passwordMatch) {
          return res.status(401).json({ message: 'Invalid credentials' });
      }

      const token = jwt.sign({ id: admin._id, email: admin.email }, secretKey, { expiresIn: '1h' });

      res.status(200).json({
          message: 'Login successful',
          token: token,
          adminId: admin._id, 
      });
  } catch (err) {
      console.error(err);
      return res.status(500).json({ message: 'An error occurred during login' });
  }
});


app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const client = await Client.findOne({ email });

        if (!client) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const passwordMatch = await bcrypt.compare(password, client.password);

        if (!passwordMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        const token = jwt.sign({ id: client._id, email: client.email }, secretKey, { expiresIn: '1h' });

        res.status(200).json({ message: 'Login successful', token });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'An error occurred during login' });
    }
});

//forgottenPassword
const crypto = require('crypto');

app.post("/api/forgot-password", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }

  try {
    const user = await Client.findOne({ email });

    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }
    const resetToken = crypto.randomBytes(20).toString('hex');
    const resetTokenExpiration = Date.now() + 3600000;

    // Save the reset token and expiration to the user document
    user.resetToken = resetToken;
    user.resetTokenExpiration = resetTokenExpiration;
    await user.save();

    // Send reset email with the token
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL,
        pass: process.env.EMAIL_PASSWORD,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL,
      to: user.email,
      subject: "Password Reset Link",
      text: `To reset your password, please click the following link: http://localhost:3006/reset-password/${resetToken}`,
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        return res.status(500).json({ message: "Error sending email", error });
      }
      res.status(200).json({ message: "Password reset link sent!" });
    });
  } catch (error) {
    res.status(500).json({ message: "Internal server error", error });
  }
});


app.post('/api/reset-password/:resetToken', async (req, res) => {
  const { resetToken } = req.params;
  const { newPassword } = req.body;

  if (!newPassword) {
    return res.status(400).json({ message: 'New password is required' });
  }

  try {
    const user = await Client.findOne({
      resetToken,
      resetTokenExpiration: { $gt: Date.now() },  
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired token' });
    }

    const hashedPassword = bcrypt.hashSync(newPassword, 10);

    user.password = hashedPassword;
    user.resetToken = undefined;  
    user.resetTokenExpiration = undefined;  
    await user.save();

    res.status(200).json({ message: 'Password successfully reset' });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error', error });
  }
});



//user profile
app.get('/profile', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1]; 

    if (!token) {
        return res.status(401).json({ message: 'No token provided' });
    }

    try {
        const decoded = jwt.verify(token, secretKey);
        const client = await Client.findById(decoded.id); 

        if (!client) {
            return res.status(404).json({ message: 'Client not found' });
        }

        res.status(200).json({ client }); 
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to authenticate token' });
    }
});

app.put('/update-profile', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1]; 
  
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }
  
    try {
      const decoded = jwt.verify(token, secretKey); 
      const { name, surname, email } = req.body; 
  
      const client = await Client.findById(decoded.id); 
  
      if (!client) {
        return res.status(404).json({ message: 'Client not found' });
      }
  
      client.name = name || client.name;
      client.surname = surname || client.surname;
      client.email = email || client.email;
  
      await client.save(); 
  
      res.status(200).json({ message: 'Profile updated successfully', client });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Failed to authenticate token or update profile' });
    }
  });
  app.post('/verify-password', (req, res) => {
  const { password } = req.body;
  const userId = req.user.id; 


  User.findById(userId, (err, user) => {
    if (err || !user) {
      return res.status(400).json({ message: 'User not found' });
    }

    bcrypt.compare(password, user.password, (err, isMatch) => {
      if (isMatch) {
        return res.status(200).json({ success: true });
      } else {
        return res.status(400).json({ success: false, message: 'Incorrect password' });
      }
    });
  });
});

//Admin Profile
app.get('/Adminprofile', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1]; 

  if (!token) {
      return res.status(401).json({ message: 'No token provided' });
  }

  try {
      const decoded = jwt.verify(token, secretKey);
      const admin = await Admin.findById(decoded.id); 

      if (!admin) {
          return res.status(404).json({ message: 'Admin not found' });
      }

      res.status(200).json({ admin }); 
  } catch (err) {
      console.error(err);
      res.status(401).json({ message: 'Invalid or expired token' });
  }
});

app.put('/update-adminprofile', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1]; 

  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, secretKey); 
    const { name, surname, email } = req.body; 

    const admin = await Admin.findById(decoded.id); 

    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    admin.name = name || admin.name;
    admin.surname = surname || admin.surname;
    admin.email = email || admin.email;

    await admin.save(); 

    res.status(200).json({ message: 'Profile updated successfully', admin });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to authenticate token or update profile' });
  }
});


app.delete("/delete-adminprofile", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, secretKey);
    const admin = await Admin.findById(decoded.id);

    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    await Admin.findByIdAndDelete(decoded.id);

    res.status(200).json({ message: "Admin account deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to delete account" });
  }
});


app.delete("/delete-profile", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, secretKey);
    const client = await Client.findById(decoded.id);

    if (!client) {
      return res.status(404).json({ message: "Client not found" });
    }

    await Client.findByIdAndDelete(decoded.id);

    res.status(200).json({ message: "Admin account deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to delete account" });
  }
});

//GTTING CLIENT INFORMATION IN THE DATABASE
app.get("/clients-count", (req, res) => {
  Client.countDocuments()  // Use countDocuments() instead of count()
    .then(clientCount => {
      res.json({ clientCount });
    })
    .catch(error => {
      console.error("Error getting client count:", error);
      res.status(500).json({ message: "Error fetching client count" });
    });
});


app.get("/clientsList", (req, res) => {
  Client.find() 
    .then(clients => {
      res.json(clients);  
    })
    .catch(error => {
      console.error("Error fetching clients:", error);
      res.status(500).json({ message: "Error fetching clients" });
    });
});


app.delete("/clientsList/:clientId", (req, res) => {
  const clientId = req.params.clientId;  

  Client.findByIdAndDelete(clientId)  
    .then((deletedClient) => {
      if (deletedClient) {
        res.json({ message: "Client deleted successfully" });
      } else {
        res.status(404).json({ message: "Client not found" });
      }
    })
    .catch((error) => {
      console.error("Error deleting client:", error);
      res.status(500).json({ message: "Error deleting client" });
    });
});

//getting admin count and data
app.get("/admins-count", (req, res) => {
  Admin.countDocuments()  
    .then(adminCount => {
      res.json({ adminCount });
    })
    .catch(error => {
      console.error("Error getting admin count:", error);
      res.status(500).json({ message: "Error fetching admin count" });
    });
});

app.get("/adminsList", (req, res) => {
  Admin.find() 
    .then(admins => {
      res.json(admins);  
    })
    .catch(error => {
      console.error("Error fetching admins:", error);
      res.status(500).json({ message: "Error fetching admins" });
    });
});

app.delete("/adminsList/:adminId", (req, res) => {
  const adminId = req.params.adminId;  

  Admin.findByIdAndDelete(adminId)  
    .then((deletedAdmin) => {
      if (deletedAdmin) {
        res.json({ message: "Admin deleted successfully" });
      } else {
        res.status(404).json({ message: "Admin not found" });
      }
    })
    .catch((error) => {
      console.error("Error deleting admin:", error);
      res.status(500).json({ message: "Error deleting admin" });
    });
});


app.post('/verify-password', (req, res) => {
const { password } = req.body;
const userId = req.user.id; 


User.findById(userId, (err, user) => {
  if (err || !user) {
    return res.status(400).json({ message: 'User not found' });
  }

  bcrypt.compare(password, user.password, (err, isMatch) => {
    if (isMatch) {
      return res.status(200).json({ success: true });
    } else {
      return res.status(400).json({ success: false, message: 'Incorrect password' });
    }
  });
});
});


app.post('/verify-password', (req, res) => {
    const { password } = req.body;
    const userId = req.user.id; 

    User.findById(userId, (err, user) => {
      if (err || !user) {
        return res.status(400).json({ message: 'User not found' });
      }
  
      bcrypt.compare(password, user.password, (err, isMatch) => {
        if (isMatch) {
          return res.status(200).json({ success: true });
        } else {
          return res.status(400).json({ success: false, message: 'Incorrect password' });
        }
      });
    });
  });

  app.delete('/delete-account', (req, res) => {
    const userId = req.user.id; 
  
    User.findByIdAndDelete(userId, (err) => {
      if (err) {
        return res.status(500).json({ message: 'Error deleting account' });
      }
  
      res.status(200).json({ success: true });
    });
  });
  


app.get('/dashboard', authenticate, (req, res) => {
   
    res.status(200).json({ message: 'Welcome to the dashboard' });
});

//charts
const stockDataSchema = new mongoose.Schema({
    stock_symbol: String,
    timestamp: Date,
    close_price: Number,
});

const StockData = mongoose.model('StockData', stockDataSchema);

// Endpoint to generate a chart for the stock symbol
app.get('/chart/:stockSymbol', async (req, res) => {
    const { stockSymbol } = req.params;
    
    try {
        const data = await StockData.find({ stock_symbol: stockSymbol }).sort({ timestamp: 1 });

        if (!data || data.length === 0) {
            return res.status(404).json({ message: 'No data found for this stock symbol' });
        }

        // Preparing the labels (dates) and prices
        const labels = data.map(item => item.timestamp.toISOString().split('T')[0]); // Extract date as string (YYYY-MM-DD)
        const prices = data.map(item => item.close_price);

        // ChartJS configuration
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
                    borderColor: 'rgba(75, 192, 192, 1)', // Line color
                    borderWidth: 1,
                    fill: false, // No filling under the line
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
                        type: 'category', // Treat x-axis as categorical (dates)
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

        // Rendering the chart to a PNG image buffer
        const imageBuffer = await canvasRenderService.renderToBuffer(configuration);

        // Sending the image buffer as a response
        res.set('Content-Type', 'image/png');
        res.send(imageBuffer);
    } catch (err) {
        console.error('Error generating chart:', err);
        res.status(500).json({ message: 'Error generating chart' });
    }
});

app.get('/api/cryptos', async (req, res) => {
    try {
        const cryptoData = await mongoose.connection.db.collection('crypto_data').find({}).toArray();
        console.log('Fetched data:', cryptoData);  // Log the fetched data
        res.json(cryptoData);
    } catch (error) {
        console.error('Error fetching crypto data:', error);
        res.status(500).json({ error: 'Failed to fetch data' });
    }
});

// Fetch crypto data from CoinGecko API and store it in MongoDB
app.get('/api/fetch-crypto', async (req, res) => {
    try {
        const response = await axios.get('https://api.coingecko.com/api/v3/coins/markets', {
            params: {
                vs_currency: 'usd',
                order: 'market_cap_desc',
                per_page: 250,
                page: 1,
            },
        });

        const cryptoData = response.data.map((coin) => ({
            coin_name: coin.name,
            market_price: coin.current_price,
            price_change_24h: coin.price_change_percentage_24h_in_currency,
            volume_24h: coin.total_volume,
            circulating_supply: coin.circulating_supply,
            market_cap: coin.market_cap,
        }));

        await mongoose.connection.db.collection('crypto_data').insertMany(cryptoData);
        res.status(200).json({ message: 'Data fetched and stored in MongoDB' });
    } catch (error) {
        console.error('Error fetching crypto data from CoinGecko:', error);
        res.status(500).json({ error: 'Failed to fetch data from CoinGecko' });
    }
});

//getting core stocks
app.get('/api/corestocks', async (req, res) => {
    try {
        const stockData = await mongoose.connection.db.collection('stock_data').find({}).toArray();
        console.log('Fetched data:', stockData);  
        res.json(stockData);
    } catch (error) {
        console.error('Error fetching stock data:', error);
        res.status(500).json({ error: 'Failed to fetch data' });
    }
});


//charts
app.get("/api/stock-history/:stock_name", async (req, res) => {
    const stockName = req.params.stock_name;
    try {
      const collection = db.collection("stock_data"); // Ensure correct collection name
      const stockHistory = await collection
        .find({ stock_name: stockName })
        .sort({ timestamp: 1 }) // Sort by timestamp ascending
        .toArray();
  
      // Handle case where no data is found
      if (stockHistory.length === 0) {
        return res.status(404).send("No data found for the given stock");
      }
  
      const responseData = {
        labels: stockHistory.map((data) =>
          new Date(data.timestamp).toISOString().split('T')[0] // Consistent date format (YYYY-MM-DD)
        ),
        datasets: [
          {
            label: `Close Price of ${stockName}`,
            data: stockHistory.map((data) => data.close_price),
            borderColor: "rgba(75, 192, 192, 1)",
            backgroundColor: "rgba(75, 192, 192, 0.2)",
            tension: 0.4,
          },
        ],
      };
  
      res.json(responseData);
    } catch (error) {
      console.error("Error fetching stock history:", error);
      res.status(500).send("Error fetching stock history");
    }
});
  
app.get('/api/companies', (req, res) => {
    if (!db) {
      return res.status(500).send('Database not connected');
    }
    
    db.collection('stock_data')
      .find({})
      .toArray()
      .then(companies => {
        res.json(companies);
      })
      .catch(err => {
        console.error('Error fetching companies:', err);
        res.status(500).send('Error fetching companies');
      });
 });
  
  
  

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
