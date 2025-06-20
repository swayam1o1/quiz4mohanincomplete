const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

// Middleware
app.use(cors());
app.use(express.json());

const authRoutes = require('./routes/authRoutes');
const quizRoutes = require('./routes/quizRoutes');

// Routes
app.get('/', (req, res) => {
  res.send('Quiz Platform API Running');
});

app.use('/api/auth', authRoutes);
app.use('/api/quiz', quizRoutes);

// Socket Handling
require('./sockets/socketHandler')(io);

const PORT = process.env.PORT || 5050;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
