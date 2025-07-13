const { activeQuizzes, QuizState } = require('./quizstate');
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
        // Fetch full quiz state from backend (including pairs for match questions)
        try {
          const stateRes = await fetch(`http://127.0.0.1:5050/api/quiz/${quizId}/state`);
          if (!stateRes.ok) throw new Error('Failed to fetch quiz state');
          const quizState = await stateRes.json();
          let questions = quizState.questions.map(q => ({
            ...q,
            id: q.id || q._id,
            shortAnswers: q.shortAnswers || q.short_answers
          }));
          // Ensure pairs are present for match questions
          quiz = new QuizState(quizId, questions, quizState.quiz.access_code);
          activeQuizzes.set(quizId, quiz);
          console.log(`[Server] Created quiz ${quizId} with ${questions.length} questions (from DB)`);
        } catch (err) {
          console.error('Error fetching quiz state for joinQuiz:', err);
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

        // Find the question
        const question = quiz.questions.find(q => (q.id || q._id) == questionId);
        if (question) {
          let isCorrect = false;
          if (question.type === 'mcq' || question.type === 'mcq_single' || question.type === 'mcq_multiple') {
            // For MCQ, check if the answer index matches a correct option
            const correctOptions = question.options
              .map((opt, idx) => opt.is_correct ? idx : null)
              .filter(idx => idx !== null);
            if (Array.isArray(answer)) {
              // For multiple select
              isCorrect = answer.every(a => correctOptions.includes(a)) && answer.length === correctOptions.length;
            } else {
              isCorrect = correctOptions.includes(answer);
            }
          } else if (question.type === 'short') {
            // For short answer, compare normalized answer to correct answers
            const shortAns = question.shortAnswers || question.short_answers || question.correct_answers || '';
            let correctAnswers = [];
            if (typeof shortAns === 'string') {
              correctAnswers = shortAns.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
            } else if (Array.isArray(shortAns)) {
              correctAnswers = shortAns.map(s => s.trim().toLowerCase());
            }
            if (typeof answer === 'string' && correctAnswers.includes(answer.trim().toLowerCase())) {
              isCorrect = true;
            }
          } else if (question.type === 'match') {
            // For match, answer is array of {left, right}, must match all pairs
            if (Array.isArray(answer) && Array.isArray(question.pairs)) {
              // Build a map of correct left->right
              const correctMap = {};
              question.pairs.forEach(pair => {
                correctMap[pair.left_item] = pair.right_item;
              });
              isCorrect = answer.every(userPair =>
                correctMap[userPair.left] && correctMap[userPair.left] === userPair.right
              ) && answer.length === question.pairs.length;
            }
          }
          if (isCorrect) {
            console.log(`[Score Update] socketId: ${socket.id}, questionId: ${questionId}, points: ${question.points || 1}`);
            quiz.updateScore(socket.id, question.points || 1);
          }
        }
        console.log('[Leaderboard after answer]', quiz.getLeaderboard());
      }
    });

    // When moving to the next question (admin triggers this)
    socket.on('nextQuestion', ({ quizId }) => {
      quizId = Number(quizId); // Ensure quizId is a number
      const quiz = activeQuizzes.get(quizId);
      if (quiz) {
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
        for (const participant of leaderboard) {
          try {
            await fetch('http://localhost:5050/api/quiz/submit', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ quizId: quiz.accessCode, name: participant.name, score: participant.score })
            });
          } catch (err) {
            console.error('Error submitting participant score:', err);
          }
        }
        io.to(quizId).emit('quiz-ended', leaderboard);
        activeQuizzes.delete(quizId); // Optionally clear quiz from memory
      }
    });

    // Show stats for the current question when requested
    socket.on('showQuestionStats', async ({ quizId, questionId }) => {
      quizId = Number(quizId);
      const quiz = activeQuizzes.get(quizId);
      if (quiz) {
        console.log('Show stats for quiz', quizId, 'question', questionId, 'answers map keys:', Array.from(quiz.answers.keys()));
        const stats = quiz.getQuestionStats(questionId);
        if (stats) {
          io.to(quizId).emit('question-stats', stats);
          // Persist stats in DB
          try {
            await pool.query(
              'INSERT INTO question_stats (quiz_id, question_id, session_date, stats_json, correct_answer) VALUES ($1, $2, NOW(), $3, $4)',
              [quizId, questionId, JSON.stringify(stats), stats.correctAnswers ? JSON.stringify(stats.correctAnswers) : null]
            );
            console.log('Stats persisted for quiz', quizId, 'question', questionId);
          } catch (err) {
            console.error('Error persisting question stats:', err);
          }
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
}