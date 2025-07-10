// host.js - Modular Host Quiz Controller
const socket = io('http://127.0.0.1:5050');
const urlParams = new URLSearchParams(window.location.search);
const quizId = urlParams.get('quizId');

const startQuizBtn = document.getElementById('startQuizBtn');
const nextQuestionBtn = document.getElementById('nextQuestionBtn');
const currentQuestionDiv = document.getElementById('currentQuestion');
// Remove all references to statsSection since it no longer exists in the HTML
const copyUserLinkBtn = document.getElementById('copyUserLinkBtn');
const finishQuizBtn = document.getElementById('finishQuizBtn');
const showStatsBtn = document.getElementById('showStatsBtn');

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

function showFinishButton() {
  startQuizBtn.style.display = 'none';
  nextQuestionBtn.style.display = 'none';
  finishQuizBtn.style.display = 'inline-block';
}

function showNextButton() {
  startQuizBtn.style.display = 'none';
  nextQuestionBtn.style.display = 'inline-block';
  finishQuizBtn.style.display = 'inline-block';
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

function renderLeaderboard(leaderboard) {
  let html = '<h3>Quiz Ended! Leaderboard</h3><ol>';
  leaderboard.forEach(entry => {
    html += `<li>${entry.name}: ${entry.score}</li>`;
  });
  html += '</ol>';
  currentQuestionDiv.innerHTML = html;
  // Remove all references to statsSection since it no longer exists in the HTML
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
  window.currentQuestion = question;
  currentQuestion = question;
  renderQuestion(question);
  showNextButton();
});

socket.on('quiz-ended', (leaderboard) => {
  // Optionally display leaderboard or message
  currentQuestionDiv.innerHTML = '<h3>Quiz Finished!</h3>';
  // Remove all references to statsSection since it no longer exists in the HTML
  hideButtons();
  finishQuizBtn.style.display = 'none';
});

finishQuizBtn.addEventListener('click', () => {
  if (!quizId) return;
  socket.emit('finishQuiz', { quizId });
  finishQuizBtn.disabled = true;
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

showStatsBtn.addEventListener('click', () => {
  if (!quizId || !currentQuestion || !currentQuestion.id) return;
  socket.emit('showQuestionStats', { quizId, questionId: currentQuestion.id });
});
socket.on('question-stats', (stats) => {
  console.log('DEBUG: stats object', stats);
  console.log('DEBUG: window.currentQuestion', window.currentQuestion);
  if (window.currentQuestion) {
    console.log('DEBUG: options array', window.currentQuestion.options);
  }
  let statsHtml = '<h4>Question Statistics</h4>';
  if ((stats.type === 'mcq' || stats.type === 'mcq_single' || stats.type === 'mcq_multiple') && window.currentQuestion && window.currentQuestion.options) {
    statsHtml += '<ul>';
    Object.entries(stats.answers).forEach(([idx, count]) => {
      const opt = window.currentQuestion.options[idx];
      const optText = opt?.option_text || opt?.text || `Option ${parseInt(idx) + 1}`;
      statsHtml += `<li>${optText}: ${count} responses</li>`;
    });
    statsHtml += '</ul>';
  } else if (stats.type === 'mcq' || stats.type === 'mcq_single' || stats.type === 'mcq_multiple') {
    statsHtml += '<ul>';
    Object.entries(stats.answers).forEach(([idx, count]) => {
      statsHtml += `<li>Option ${parseInt(idx) + 1}: ${count} responses</li>`;
    });
    statsHtml += '</ul>';
  } else if (stats.type === 'short') {
    statsHtml += `<p>Correct: ${stats.correctCount}</p><p>Incorrect: ${stats.incorrectCount}</p>`;
  }
  let modal = document.getElementById('statsModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'statsModal';
    modal.style.position = 'fixed';
    modal.style.top = '50%';
    modal.style.left = '50%';
    modal.style.transform = 'translate(-50%, -50%)';
    modal.style.background = '#fff';
    modal.style.padding = '30px';
    modal.style.border = '2px solid #333';
    modal.style.zIndex = 1000;
    modal.style.boxShadow = '0 0 10px #333';
    document.body.appendChild(modal);
  }
  modal.innerHTML = statsHtml + '<br><button onclick="document.getElementById(\'statsModal\').style.display=\'none\'">Close</button>';
  modal.style.display = 'block';
});
