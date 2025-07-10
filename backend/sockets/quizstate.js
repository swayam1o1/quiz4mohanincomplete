// Store active quizzes and their states
const activeQuizzes = new Map();

class QuizState {
  constructor(quizId, questions, accessCode) {
    this.quizId = quizId;
    this.questions = questions || [];
    this.accessCode = accessCode;
    this.currentQuestionIndex = -1;
    this.isActive = false;
    this.participants = new Map(); // Map of socketId -> { name, score }
    this.answers = new Map(); // Map of questionId -> Map of socketId -> answer
  }

  startQuiz() {
    this.isActive = true;
    this.currentQuestionIndex = 0;
    return this.getCurrentQuestion();
  }

  nextQuestion() {
    if (this.currentQuestionIndex < this.questions.length - 1) {
      this.currentQuestionIndex++;
      return this.getCurrentQuestion();
    }
    return null;
  }

  getCurrentQuestion() {
    if (this.currentQuestionIndex >= 0 && this.currentQuestionIndex < this.questions.length) {
      return {
        ...this.questions[this.currentQuestionIndex],
        questionNumber: this.currentQuestionIndex + 1,
        totalQuestions: this.questions.length
      };
    }
    return null;
  }

  addParticipant(socketId, name) {
    this.participants.set(socketId, { name, score: 0 });
  }

  removeParticipant(socketId) {
    this.participants.delete(socketId);
  }

  submitAnswer(socketId, questionId, answer) {
    if (!this.answers.has(questionId)) {
      this.answers.set(questionId, new Map());
    }
    this.answers.get(questionId).set(socketId, answer);
  }


  getLeaderboard() {
    const leaderboard = Array.from(this.participants.entries()).map(([socketId, data]) => ({
      socketId,
      name: data.name,
      score: data.score
    }));

    return leaderboard.sort((a, b) => b.score - a.score);
  }

  updateScore(socketId, points) {
    const participant = this.participants.get(socketId);
    if (participant) {
      participant.score += points;
    }
  }

  getQuestionStats(questionId) {
    const questionAnswers = this.answers.get(questionId);
    if (!questionAnswers) return null;
    const question = this.questions.find(q => (q.id || q._id) === questionId);
    if (!question) return null;
    const stats = { type: question.type, answers: {}, correctCount: 0, incorrectCount: 0 };
    if (question.type === 'mcq' || question.type === 'mcq_single' || question.type === 'mcq_multiple') {
      question.options.forEach((opt, idx) => { stats.answers[idx] = 0; });
      questionAnswers.forEach((answer) => {
        if (typeof answer === 'number') stats.answers[answer] = (stats.answers[answer] || 0) + 1;
      });
    } else if (question.type === 'short') {
      let correctAnswers = [];
      const shortAns = question.shortAnswers || question.short_answers || question.correct_answers || '';
      if (typeof shortAns === 'string') {
        correctAnswers = shortAns.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
      } else if (Array.isArray(shortAns)) {
        correctAnswers = shortAns.map(s => s.trim().toLowerCase());
      }
      stats.correctAnswers = correctAnswers; // Always include correct answers in stats
      questionAnswers.forEach((answer) => {
        if (typeof answer === 'string' && correctAnswers.includes(answer.trim().toLowerCase())) {
          stats.correctCount++;
        } else {
          stats.incorrectCount++;
        }
      });
    }
    return stats;
  }
}

module.exports = {
  activeQuizzes,
  QuizState
}; 