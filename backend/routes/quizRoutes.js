const express = require('express');
const router = express.Router();
const quizController = require('../controllers/quizController');
const verifyToken = require('../middleware/verifyToken');

// Admin routes (require token)
router.post('/create', verifyToken, quizController.createQuiz);
router.post('/:quizId/questions', verifyToken, quizController.addQuestion);
router.put('/:quizId/questions/:questionId', verifyToken, quizController.updateQuestion);
router.delete('/:quizId/questions/:questionId', verifyToken, quizController.deleteQuestion);
router.get('/list', verifyToken, quizController.listQuizzes);
router.get('/:quizId/questions', verifyToken, quizController.getQuizQuestions);
router.get('/start/:quizId', verifyToken, quizController.startQuiz);
router.get('/:quizId/analytics', quizController.getQuizAnalytics);

// User-facing routes (no token required)
router.get('/validate/:code', quizController.validateQuizCode);
router.post('/submit', quizController.submitQuiz);
router.get('/:code/leaderboard', quizController.getLeaderboard);
router.get('/:quizId/state', quizController.getQuizState);

module.exports = router;