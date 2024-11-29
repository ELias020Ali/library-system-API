const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const config = require('./dbconfig');

const app = express();
const port = 4000;

const jwt = require('jsonwebtoken');
const SECRET_KEY = 'WTF'; // Replace with a strong secret key


// Parse JSON request body
app.use(express.json());

const cors = require('cors');
app.use(cors());

// Define a simple route
app.get('/', (req, res) => {
    res.send('Find Books: /api/books');
});

// Create connection to SQLite database
let db = new sqlite3.Database(config.DB, sqlite3.OPEN_READWRITE, (err) => {
    if (err) {
        console.error(err.message);
    }
    console.log('Connected to the SQLite database.');
});

// Define a route to query books data
app.get('/api/books', (req, res) => {
    db.all(`SELECT * FROM books`, [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ books: rows });
    });
});


app.post('/api/register', (req, res) => {
    const { full_name, email, password } = req.body;

    // Validate required fields
    if (!full_name || !email || !password) {
        return res.status(400).json({ error: "Full name, email, and password are required." });
    }

    const query = `INSERT INTO User (full_name, email, password) VALUES (?, ?, ?)`;
    const params = [full_name, email, password];

    db.run(query, params, function (err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.status(201).json({ message: "User registered successfully!", userId: this.lastID });
    });
});

app.get('/api/register', (req, res) => {
    db.all(`SELECT * FROM User`, [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ users: rows });
    });
});



app.post('/api/login', (req, res) => {
    const { email, password } = req.body; // Just extract email and password from the request body

    // If either email or password is not provided, return a 400 error
    if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required." });
    }

    // Update the query to use email and password only
    const query = `SELECT * FROM User WHERE email = ? AND password = ?`;
    const params = [email, password];

    db.get(query, params, (err, row) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (!row) {
            return res.status(401).json({ error: "Invalid email or password." });
        }

        // Generate a JWT token and include the userId and email in the token
        const token = jwt.sign({ userId: row.userid, email: row.email }, SECRET_KEY, {
            expiresIn: '1h', // Token expires in 1 hour
        });

        // Respond with the token and user details
        res.json({ 
            message: "Login successful!", 
            token, 
            user: { id: row.userid, email: row.email, fullName: row.full_name } 
        });
    });
});




const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Extract token from "Bearer <token>"

    if (!token) return res.status(401).json({ error: "Access denied. No token provided." });

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.status(403).json({ error: "Invalid token." });

        req.user = user; // Attach user info to the request
        next();
    });
};


app.post('/api/borrow', authenticateToken, (req, res) => {
    const { userId } = req.user; // Extracted from token
    const { bookId } = req.body;
    console.log("User ID:", userId); // Log userId
    console.log("Book ID:", bookId); // Log bookId

    const query = `UPDATE books SET userid = ? WHERE bookid = ? AND userid IS NULL`;
    const params = [userId, bookId];

    db.run(query, params, function (err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (this.changes === 0) {
            return res.status(400).json({ error: "Book is already borrowed or doesn't exist." });
        }
        res.status(200).json({ message: "Book borrowed successfully!" });
    });
});





// Start the Express server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

// Close the database connection when the process is terminated
process.on('SIGINT', () => {
    db.close((err) => {
        if (err) {
            console.error(err.message);
        }
        console.log('Closed the database connection.');
        process.exit(0);
    });
});