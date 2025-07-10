const { activeQuizzes, QuizState } = require('./quizState');
const fetch = require('node-fetch');
const pool = require('../config/db');

module.exports = function (io) {
  io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    // When a user joins a quiz
    socket.on('joinQuiz', async ({ quizId, name, questions }) => {
      console.log(`[Server] Received joinQuiz from ${socket.id} with quizId: ${quizId}`);

      quizId = Number(quizId); // Ensure quizId is a number
      let quiz = activeQuizzes.get(quizId);
    
      if (!quiz) {
        // Only host should send questions — use length check
        if (questions && questions.length > 0) {
          // Fetch access code from DB
          let accessCode = null;
          try {
            const result = await pool.query('SELECT access_code FROM quizzes WHERE id = $1', [quizId]);
            if (result.rows.length > 0) {
              accessCode = result.rows[0].access_code;
            }
          } catch (err) {
            console.error('Error fetching access code for quiz:', err);
          }
          quiz = new QuizState(quizId, questions, accessCode);
          activeQuizzes.set(quizId, quiz);
          console.log(`[Server] Created quiz ${quizId} with ${questions.length} questions`);
        } else {
          console.warn(`[Server] User tried to join quiz ${quizId} before it was created by host`);
          return;
        }
      }
    
      quiz.addParticipant(socket.id, name);
      socket.join(quizId);
      console.log(`[Server] ${socket.id} joined quiz ${quizId}. Rooms:`, Array.from(socket.rooms));
console.log(`[Server] Current participants in quiz ${quizId}:`);
console.log(quiz.getLeaderboard());

    
      // ✅ Log which rooms the socket is part of (important!)
      console.log(`[Server] ${socket.id} joined quiz ${quizId}. Rooms:`, Array.from(socket.rooms));
    
      io.to(quizId).emit('participantsUpdate', quiz.getLeaderboard());
    });
    

    // When quiz is started
    socket.on('startQuiz', ({ quizId }) => {
      quizId = Number(quizId); // Ensure quizId is a number
      const quiz = activeQuizzes.get(quizId);
      if (quiz) {
        console.log(`[Server] Starting quiz ${quizId} with ${quiz.questions.length} questions`);
        
        // ✅ Log everyone in the room
        const socketsInRoom = io.sockets.adapter.rooms.get(quizId);
        console.log(`[Server] Sockets in room ${quizId}:`, socketsInRoom ? Array.from(socketsInRoom) : 'None');
    
        const question = quiz.startQuiz();
        if (question) {
          io.to(quizId).emit('show-question', question);
        } else {
          socket.emit('error', 'No questions available to start the quiz.');
        }
      }
    });
    

    // When a participant submits an answer
    socket.on('submitAnswer', ({ quizId, questionId, answer }) => {
      quizId = Number(quizId); // Ensure quizId is a number
      const quiz = activeQuizzes.get(quizId);
      if (quiz) {
        quiz.submitAnswer(socket.id, questionId, answer);
      }
    });

    // When moving to the next question (admin triggers this)
    socket.on('nextQuestion', ({ quizId }) => {
      quizId = Number(quizId); // Ensure quizId is a number
      const quiz = activeQuizzes.get(quizId);
      if (quiz) {
        // Send stats for the previous question before moving on
        const prevQuestion = quiz.questions[quiz.currentQuestionIndex];
        if (prevQuestion) {
          const stats = quiz.getQuestionStats(prevQuestion.id || prevQuestion._id);
          io.to(quizId).emit('question-stats', stats);
        }
        const nextQ = quiz.nextQuestion();
        if (nextQ) {
          io.to(quizId).emit('show-question', nextQ);
        } else {
          io.to(quizId).emit('quiz-ended', quiz.getLeaderboard());
        }
      }
    });

    // When admin finishes the quiz
    socket.on('finishQuiz', async ({ quizId }) => {
      quizId = Number(quizId); // Ensure quizId is a number
      const quiz = activeQuizzes.get(quizId);
      if (quiz) {
        const leaderboard = quiz.getLeaderboard();
        // For each participant, submit their score using accessCode
        /*for (const participant of leaderboard) {
          try {
            await fetch('http://localhost:5050/api/quiz/submit', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ quizId: quiz.accessCode, name: participant.name, score: participant.score })
            });
          } catch (err) {
            console.error('Error submitting participant score:', err);
          }
        }*/
        io.to(quizId).emit('quiz-ended', leaderboard);
        activeQuizzes.delete(quizId); // Optionally clear quiz from memory
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      activeQuizzes.forEach((quiz, quizId) => {
        quiz.removeParticipant(socket.id);
        io.to(quizId).emit('participantsUpdate', quiz.getLeaderboard());
      });
      console.log('Client disconnected:', socket.id);
    });
});
}