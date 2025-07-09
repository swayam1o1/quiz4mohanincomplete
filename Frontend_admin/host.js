// host.js - Modular Host Quiz Controller
const socket = io('http://127.0.0.1:5050');
const urlParams = new URLSearchParams(window.location.search);
const quizId = urlParams.get('quizId');

const startQuizBtn = document.getElementById('startQuizBtn');
const nextQuestionBtn = document.getElementById('nextQuestionBtn');
const currentQuestionDiv = document.getElementById('currentQuestion');
const statsSection = document.getElementById('statsSection');
const copyUserLinkBtn = document.getElementById('copyUserLinkBtn');

let currentQuestion = null;
let lastQuestionReached = false;

startQuizBtn.addEventListener('click', () => {
    if (!quizId) return;
  
    // Add this console.log here 👇
    console.log("Start button clicked, emitting startQuiz with quizId:", quizId);
  
    socket.emit('startQuiz', { quizId });
    showNextButton();
  });
  
function showStartButton() {
  startQuizBtn.style.display = 'inline-block';
  nextQuestionBtn.style.display = 'none';
}

function showNextButton() {
  startQuizBtn.style.display = 'none';
  nextQuestionBtn.style.display = 'inline-block';
}

function hideButtons() {
  startQuizBtn.style.display = 'none';
  nextQuestionBtn.style.display = 'none';
}

function renderQuestion(q) {
  if (!q) {
    currentQuestionDiv.innerHTML = '<p>No more questions.</p>';
    hideButtons();
    return;
  }
  let html = `<h4>Q${q.questionNumber}: ${q.question_text || q.text}</h4>`;
  if (q.type === 'mcq' && q.options) {
    html += '<ul>' + q.options.map((opt, i) => `<li>${opt.option_text || opt.text}</li>`).join('') + '</ul>';
  } else if (q.type === 'short') {
    html += '<p><em>Short answer question</em></p>';
  } else if (q.type === 'tf' || q.type === 'truefalse') {
    html += '<p><em>True/False question</em></p>';
  }
  currentQuestionDiv.innerHTML = html;
}

function renderStats(stats) {
  let statsHtml = '<h4>Question Statistics</h4>';
  if (stats.type === 'mcq') {
    statsHtml += '<ul>';
    Object.entries(stats.answers).forEach(([idx, count]) => {
      statsHtml += `<li>Option ${parseInt(idx) + 1}: ${count} responses</li>`;
    });
    statsHtml += '</ul>';
  } else if (stats.type === 'short') {
    statsHtml += `<p>Correct: ${stats.correctCount}</p><p>Incorrect: ${stats.incorrectCount}</p>`;
  } else if (stats.type === 'tf' || stats.type === 'truefalse') {
    statsHtml += `<p>True: ${stats.answers['True'] || 0}</p><p>False: ${stats.answers['False'] || 0}</p>`;
  }
  statsSection.innerHTML = statsHtml;
}

function renderLeaderboard(leaderboard) {
  let html = '<h3>Quiz Ended! Leaderboard</h3><ol>';
  leaderboard.forEach(entry => {
    html += `<li>${entry.name}: ${entry.score}</li>`;
  });
  html += '</ol>';
  currentQuestionDiv.innerHTML = html;
  statsSection.innerHTML = '';
  hideButtons();
}

if (!quizId) {
  currentQuestionDiv.innerHTML = '<p>Error: No quiz selected.</p>';
  hideButtons();
} else {
  showStartButton();
  // Fetch questions and join as host
  (async () => {
    try {
      // You may need to adjust the API endpoint if different
      const token = localStorage.getItem('adminToken') || '';
      const res = await fetch(`http://localhost:5050/api/quiz/${quizId}/questions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch questions for this quiz.');
      const data = await res.json();
      const questions = data.questions || [];
      console.log('Host fetched questions:', questions);
      socket.emit('joinQuiz', {
        quizId,
        name: 'Host',
        questions
      });
      console.log('Host emitted joinQuiz for quizId:', quizId);
    } catch (err) {
      currentQuestionDiv.innerHTML = `<p>Error loading quiz questions: ${err.message}</p>`;
      hideButtons();
    }
  })();
}

startQuizBtn.addEventListener('click', () => {
  if (!quizId) return;
  socket.emit('startQuiz', { quizId });
  showNextButton();
});

nextQuestionBtn.addEventListener('click', () => {
  if (!quizId) return;
  socket.emit('nextQuestion', { quizId });
});

socket.on('show-question', (question) => {
  currentQuestion = question;
  renderQuestion(question);
  statsSection.innerHTML = '';
  showNextButton();
});

socket.on('question-stats', (stats) => {
  renderStats(stats);
});

socket.on('quiz-ended', (leaderboard) => {
  renderLeaderboard(leaderboard);
});

copyUserLinkBtn.addEventListener('click', () => {
  if (!quizId) {
    alert('No quiz ID found.');
    return;
  }
  const userLink = `http://localhost:5050/user/join.html?quizId=${quizId}`;
  navigator.clipboard.writeText(userLink)
    .then(() => {
      alert('User link copied to clipboard!');
    })
    .catch(err => {
      console.error('Failed to copy:', err);
    });
});
