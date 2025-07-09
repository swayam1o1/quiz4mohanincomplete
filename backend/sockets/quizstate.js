// Store active quizzes and their states
const activeQuizzes = new Map();

class QuizState {
  constructor(quizId, questions) {
    this.quizId = quizId;
    this.questions = questions || [];
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

  getQuestionStats(questionId) {
    const questionAnswers = this.answers.get(questionId);
    if (!questionAnswers) return null;

    // Find the question object
    const question = this.questions.find(q => (q.id || q._id) === questionId);
    if (!question) return null;

    const stats = {
      type: question.type,
      totalParticipants: this.participants.size,
      answers: {},
      correctCount: 0,
      incorrectCount: 0
    };

    if (question.type === 'mcq') {
      // Count answers for each option index
      question.options.forEach((opt, idx) => {
        stats.answers[idx] = 0;
      });
      questionAnswers.forEach((answer) => {
        if (typeof answer === 'number') {
          stats.answers[answer] = (stats.answers[answer] || 0) + 1;
        }
      });
    } else if (question.type === 'short') {
      // Typed answer: count correct vs. incorrect
      // Accept multiple correct answers, comma separated
      let correctAnswers = [];
      if (typeof question.shortAnswers === 'string') {
        correctAnswers = question.shortAnswers.split(',').map(s => s.trim().toLowerCase());
      } else if (Array.isArray(question.shortAnswers)) {
        correctAnswers = question.shortAnswers.map(s => s.trim().toLowerCase());
      }
      questionAnswers.forEach((answer) => {
        if (typeof answer === 'string' && correctAnswers.includes(answer.trim().toLowerCase())) {
          stats.correctCount++;
        } else {
          stats.incorrectCount++;
        }
      });
    } else if (question.type === 'tf' || question.type === 'truefalse') {
      // True/False: count for True and False
      stats.answers['True'] = 0;
      stats.answers['False'] = 0;
      questionAnswers.forEach((answer) => {
        if (answer === true || answer === 'True' || answer === 'true') {
          stats.answers['True']++;
        } else if (answer === false || answer === 'False' || answer === 'false') {
          stats.answers['False']++;
        }
      });
    }
    return stats;
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
}

module.exports = {
  activeQuizzes,
  QuizState
}; 