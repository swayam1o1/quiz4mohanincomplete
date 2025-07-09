const { activeQuizzes, QuizState } = require('./quizState');

module.exports = function (io) {
  io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    // When a user joins a quiz
    socket.on('joinQuiz', ({ quizId, name, questions }) => {
      console.log(`[Server] Received joinQuiz from ${socket.id} with quizId: ${quizId}`);

      let quiz = activeQuizzes.get(quizId);
    
      if (!quiz) {
        // Only host should send questions — use length check
        if (questions && questions.length > 0) {
          quiz = new QuizState(quizId, questions);
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

      io.to(quizId).emit('participantsUpdate', quiz.getLeaderboard());
    });

    // When quiz is started
    socket.on('startQuiz', ({ quizId }) => {
      const quiz = activeQuizzes.get(quizId);
      if (quiz) {
        console.log(`[Server] Starting quiz ${quizId} with ${quiz.questions.length} questions`);

        socket.join(quizId); // ✅ Ensure host is in the room

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
      const quiz = activeQuizzes.get(quizId);
      if (quiz) {
        quiz.submitAnswer(socket.id, questionId, answer);
      }
    });

    // When moving to the next question (admin triggers this)
    socket.on('nextQuestion', ({ quizId }) => {
      const quiz = activeQuizzes.get(quizId);
      if (quiz) {
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

    // Handle disconnect
    socket.on('disconnect', () => {
      activeQuizzes.forEach((quiz, quizId) => {
        quiz.removeParticipant(socket.id);
        io.to(quizId).emit('participantsUpdate', quiz.getLeaderboard());
      });
      console.log('Client disconnected:', socket.id);
    });
  });
};
