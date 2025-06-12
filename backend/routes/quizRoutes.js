const express = require('express');
const router = express.Router();
const quizController = require('../controllers/quizController');

const verifyToken = require('../middleware/verifyToken');

router.post('/create', verifyToken, quizController.createQuiz);
router.post('/:quizId/questions', verifyToken, quizController.addQuestion);
router.put('/questions/:questionId', verifyToken, quizController.updateQuestion);
router.delete('/questions/:questionId', verifyToken, quizController.deleteQuestion);
router.get('/:quizId/questions', verifyToken, quizController.getQuestionsByQuiz);
module.exports = router;
