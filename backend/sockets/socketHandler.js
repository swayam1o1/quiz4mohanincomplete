const { activeQuizzes, QuizState } = require('./quizState');

module.exports = function (io) {
  io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    socket.on('joinQuiz', ({ quizId, name, questions }) => {
      if (!activeQuizzes.has(quizId)) {
        activeQuizzes.set(quizId, new QuizState(quizId, questions));
      }

      const quiz = activeQuizzes.get(quizId);
      quiz.addParticipant(socket.id, name);

      socket.join(quizId);
      io.to(quizId).emit('participantsUpdate', quiz.getLeaderboard());
    });

    socket.on('startQuiz', ({ quizId }) => {
      const quiz = activeQuizzes.get(quizId);
      if (quiz) {
        const question = quiz.startQuiz();
        io.to(quizId).emit('show-question', question);

      }
    });

    socket.on('submitAnswer', ({ quizId, questionId, answer }) => {
      const quiz = activeQuizzes.get(quizId);
      if (quiz) {
        quiz.submitAnswer(socket.id, questionId, answer);
      }
    });

    socket.on('nextQuestion', ({ quizId }) => {
      const quiz = activeQuizzes.get(quizId);
      if (quiz) {
        const nextQ = quiz.nextQuestion();
        if (nextQ) {
          io.to(quizId).emit('question', nextQ);
        } else {
          io.to(quizId).emit('quiz-ended', leaderboard);

        }
      }
    });

    socket.on('disconnect', () => {
      activeQuizzes.forEach((quiz, quizId) => {
        quiz.removeParticipant(socket.id);
        io.to(quizId).emit('participantsUpdate', quiz.getLeaderboard());
      });
      console.log('Client disconnected:', socket.id);
    });
  });
};
