const express = require('express');
const router = express.Router();
const quizController = require('../controllers/quizController');

const verifyToken = require('../middleware/verifyToken');

router.post('/create', verifyToken, quizController.createQuiz);
router.post('/:quizId/questions', verifyToken, quizController.addQuestion);
router.put('/:quizId/questions/:questionId', verifyToken, quizController.updateQuestion);
router.delete('/:quizId/questions/:questionId', verifyToken, quizController.deleteQuestion);
router.get('/:quizId/questions', verifyToken, quizController.getQuestionsByQuiz);
router.post('/:quizId/start', verifyToken, quizController.startQuiz);
router.get('/:quizId/state', quizController.getQuizState);
router.get('/validate/:code', quizController.validateQuizCode);
router.post('/:code/questions/:questionId/answer', quizController.submitAnswer);
router.get('/:code/leaderboard', quizController.getLeaderboard);
router.get('/list', verifyToken, quizController.listQuizzes);

module.exports = router;
