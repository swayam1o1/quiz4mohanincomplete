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

    const stats = {
      totalParticipants: this.participants.size,
      answers: {}
    };

    // Count answers for each option
    questionAnswers.forEach((answer) => {
      if (Array.isArray(answer)) {
        // Multiple choice
        answer.forEach((option) => {
          stats.answers[option] = (stats.answers[option] || 0) + 1;
        });
      } else {
        // Single choice or typed answer
        stats.answers[answer] = (stats.answers[answer] || 0) + 1;
      }
    });

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