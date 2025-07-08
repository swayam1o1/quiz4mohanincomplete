const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

// --- Configuration ---
const app = express();
app.use(cors()); // Enable CORS for all routes
const PORT = 3000;

// IMPORTANT: Replace with your actual database connection details
// It's recommended to use environment variables for this in a real application
const pool = new Pool({
  user: 'swayam',
  host: 'localhost',
  database: 'quiz_db',
  password: 'postgresql',
  port: 5432,
});

// --- Middleware ---
// This middleware is necessary to parse JSON bodies in POST requests
app.use(express.json());


// --- Endpoints ---

// Add a root route to show that the server is running
app.get('/', (req, res) => {
  res.status(200).send('<h1>Welcome to the Submission API</h1><p>The server is running. Please send a POST request to /submit with your data.</p>');
});

app.post('/submit', async (req, res) => {
  // 1. Destructure the expected data from the request body
  const { quiz_id, name, score } = req.body;

  // 2. Basic validation to ensure required fields are present
  if (!quiz_id || !name || score === undefined) {
    return res.status(400).json({ message: 'Missing required fields: quiz_id, name, and score are required.' });
  }

  // 3. Define the SQL query to insert data into the participants table
  const insertQuery = `
    INSERT INTO participants (quiz_id, name, score)
    VALUES ($1, $2, $3)
  `;

  try {
    // 4. Execute the query with the provided data
    // Using parameterized queries ($1, $2, $3) prevents SQL injection
    await pool.query(insertQuery, [quiz_id, name, score]);

    // 5. Respond with a success message if the insertion is successful
    res.status(201).json({ message: "Submission successful" });

  } catch (error) {
    // 6. If an error occurs, log it and send a generic server error response
    console.error('Error inserting data into participants table:', error);
    res.status(500).json({ message: 'An error occurred while processing your submission.' });
  }
});

// --- Leaderboard Endpoint ---
app.get('/leaderboard/:quizId', async (req, res) => {
  const { quizId } = req.params;

  try {
    const result = await pool.query(
      `SELECT name, score, submitted_at
       FROM participants
       WHERE quiz_id = $1
       ORDER BY score DESC, submitted_at ASC`,
      [quizId]
    );
    res.json({ leaderboard: result.rows });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ message: 'Error fetching leaderboard' });
  }
});

// --- Server Start ---
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
}); 