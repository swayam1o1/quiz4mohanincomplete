const { activeQuizzes, QuizState } = require('./quizState');

module.exports = function (io) {
  io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    // When a user joins a quiz
    socket.on('joinQuiz', ({ quizId, name, questions }) => {
      if (!activeQuizzes.has(quizId)) {
        // Create a new quiz instance with the questions
        activeQuizzes.set(quizId, new QuizState(quizId, questions));
      }

      const quiz = activeQuizzes.get(quizId);
      quiz.addParticipant(socket.id, name);

      socket.join(quizId);
      io.to(quizId).emit('participantsUpdate', quiz.getLeaderboard());
    });

    // When quiz is started
    socket.on('startQuiz', ({ quizId }) => {
      const quiz = activeQuizzes.get(quizId);
      if (quiz) {
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

    // When moving to the next question
    socket.on('nextQuestion', ({ quizId }) => {
      const quiz = activeQuizzes.get(quizId);
      if (quiz) {
        const nextQ = quiz.nextQuestion();
        if (nextQ) {
          io.to(quizId).emit('question', nextQ);
        } else {
          // FIXED: Use correct leaderboard reference
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