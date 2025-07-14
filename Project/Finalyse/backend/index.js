const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken'); 
require('dotenv').config();

const app = express();
const port = 3001;  

app.use(cors());  
app.use(express.json());  

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
});




// API endpoint to get clients from the database
app.get('/clients', (req, res) => {
    const sqlQuery = 'SELECT * FROM Clients';
    db.query(sqlQuery, (err, result) => {
        if (err) {
            console.error(err);
            res.status(500).send('An error occurred');
        } else {
            res.json(result);
        }
    });
});

// API endpoint to add a new client to the database
app.post('/clients', (req, res) => {
    const { name, surname, email, password } = req.body;
    const sqlQuery = 'INSERT INTO Clients (name, surname, email, password) VALUES (?, ?, ?, ?)';
    db.query(sqlQuery, [name, surname, email, password], (err, result) => {
        if (err) {
            console.error(err);
            res.status(500).send('An error occurred');
        } else {
            res.send('Client added successfully');
        }
    });
});

//FOR LOGIN AUTHENTIFICATION

app.post('/login', (req, res) => {
    const { name, password } = req.body;

    const sqlQuery = 'SELECT * FROM Clients WHERE name = ?';
    db.query(sqlQuery, [name], async (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: 'An error occurred' });
        }

        if (result.length > 0) {
            const user = result[0];

            const passwordMatch = await bcrypt.compare(password, user.password);

            if (passwordMatch) {

                return res.status(200).json({ message: 'Login successful' });
            } else {
                return res.status(401).json({ message: 'Invalid credentials' });
            }
        } else {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
    });
});

//for clients registration

app.post('/api/clients/register', (req, res) => {
    const { name, surname, email, password } = req.body;


    const checkEmailQuery = 'SELECT * FROM Clients WHERE email = ?';
    db.query(checkEmailQuery, [email], async (err, results) => {
        if (err) {
            console.error('Error checking email:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        if (results.length > 0) {
            return res.status(400).json({ error: 'Email already exists' });
        }

        try {
            const hashedPassword = await bcrypt.hash(password, 10); 
            const sql = 'INSERT INTO Clients (name, surname, email, password) VALUES (?, ?, ?, ?)';
            db.query(sql, [name, surname, email, hashedPassword], (err, result) => {
                if (err) {
                    console.error('Error inserting data:', err);
                    return res.status(500).json({ error: 'Database error' });
                }
                res.json({ message: 'Client registered successfully', clientId: result.insertId });
            });
        } catch (error) {
            console.error('Error hashing password:', error);
            return res.status(500).json({ error: 'Password hashing error' });
        }
    });
});





//////Admin section/////

app.post('/admin/register',(req, res) => {
    const { email, password, name, surname, role = 'admin' } = req.body;

    const checkEmailQuery = 'SELECT * FROM Administrators WHERE email = ?';
    db.query(checkEmailQuery, [email], async (err, results) => {
        if (err) {
            console.error('Error checking email:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        if (results.length > 0) {
            return res.status(400).json({ error: 'Email already exists' });
        }
        try {
            const hashedPassword = await bcrypt.hash(password, 10);
            const sql = 'INSERT INTO Administrators (email, password, name, surname, role) VALUES (?, ?, ?, ?, ?)';
            db.query(sql, [email, hashedPassword, name, surname, role], (err, result) => {
                if (err) {
                    console.error('Error inserting data:', err);
                    return res.status(500).json({ error: 'Database error' });
                }
                res.json({ message: 'Admin registered successfully', adminId: result.insertId });
            });
        } catch (error) {
            console.error('Error hashing password:', error);
            return res.status(500).json({ error: 'Password hashing error' });
        }
    });
});



// Admin login route
app.post('/admin/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
    }
    const sqlQuery = 'SELECT * FROM administrators WHERE email = ?';
    db.query(sqlQuery, [email], async (err, result) => {
        if (err) {
            console.error('Database query error:', err);
            return res.status(500).json({ message: 'An error occurred while processing your request' });
        }

        if (result.length === 0) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const admin = result[0];
        try {
            const passwordMatch = await bcrypt.compare(password, admin.password);
            if (!passwordMatch) {
                return res.status(401).json({ message: 'Invalid credentials' });
            }
            const token = jwt.sign(
                { id: admin.id, email: admin.email, name: admin.name, role: admin.role },
                process.env.JWT_SECRET,
                { expiresIn: '1h' }
            );

            return res.status(200).json({ message: 'Login successful', token });
        } catch (error) {
            console.error('Password comparison error:', error);
            return res.status(500).json({ message: 'An error occurred during login' });
        }
    });
});

// Middleware to authenticate admin
const authenticateAdmin = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Authorization token required' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            const message = err.name === 'TokenExpiredError' 
                ? 'Token expired, please log in again' 
                : 'Invalid token, please log in again';
            return res.status(401).json({ message });
        }

        req.admin = decoded; 
        next();
    });
};

app.get('/admin/dashboard', authenticateAdmin, (req, res) => {
    res.json({ message: `Welcome to the admin dashboard, ${req.admin.name}!` });
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
