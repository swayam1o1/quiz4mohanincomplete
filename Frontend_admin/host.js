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
const accessCodeDisplay = document.getElementById('accessCodeDisplay');
const hostTimer = document.getElementById('hostTimer');
let hostQuestionTimer = null;
let hostTimeLeft = 0;
let quizFinished = false;

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

function startHostTimer(seconds) {
  clearInterval(hostQuestionTimer);
  hostTimeLeft = seconds;
  updateHostTimerDisplay();
  hostQuestionTimer = setInterval(() => {
    hostTimeLeft--;
    updateHostTimerDisplay();
    if (hostTimeLeft <= 0) {
      clearInterval(hostQuestionTimer);
      hostTimer.textContent = "Time's up!";
    }
  }, 1000);
}
function updateHostTimerDisplay() {
  hostTimer.textContent = `Time Left: ${hostTimeLeft}s`;
  hostTimer.style.color = '#fff';
}
function stopHostTimer() {
  clearInterval(hostQuestionTimer);
  hostTimer.textContent = '';
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
      // Fetch access code for this quiz
      let accessCode = '';
      if (data.quiz && data.quiz.access_code) {
        accessCode = data.quiz.access_code;
      } else {
        // fallback: fetch quiz info
        const quizRes = await fetch(`http://localhost:5050/api/quiz/list`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (quizRes.ok) {
          const quizList = await quizRes.json();
          const found = quizList.quizzes?.find(q => String(q.id) === String(quizId));
          if (found) accessCode = found.access_code;
        }
      }
      accessCodeDisplay.textContent = accessCode ? `Access Code: ${accessCode}` : '';
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
  if (!quizId) {
    adminMessage.textContent = 'Quiz ID not set!';
    return;
  }
  socket.emit('startQuiz', { quizId });
  showNextButton();
  // Timer will start on show-question event
});

nextQuestionBtn.addEventListener('click', () => {
  if (!quizId) return;
  socket.emit('nextQuestion', { quizId });
  // Timer will start on show-question event
});

socket.on('show-question', (question) => {
  window.currentQuestion = question;
  currentQuestion = question;
  renderQuestion(question);
  showNextButton();
  // Start timer for this question
  if (question && question.time_limit) {
    startHostTimer(question.time_limit);
  } else {
    stopHostTimer();
  }
});

socket.on('quiz-ended', (leaderboard) => {
  // Optionally display leaderboard or message
  currentQuestionDiv.innerHTML = '<h3>Quiz Finished!</h3>';
  // Remove all references to statsSection since it no longer exists in the HTML
  hideButtons();
  finishQuizBtn.style.display = 'none';
  // Hide the timer when quiz is finished
  hostTimer.style.display = 'none';
  quizFinished = true;
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
  if (quizFinished) {
    if (quizId) {
      window.location.href = `/admin/QuizAnalytics.html?quizId=${quizId}`;
    }
    return;
  }
  if (!quizId || !currentQuestion || !currentQuestion.id) return;
  socket.emit('showQuestionStats', { quizId, questionId: currentQuestion.id });
});
socket.on('question-stats', (stats) => {
  console.log('DEBUG: stats object', stats);
  console.log('DEBUG: window.currentQuestion', window.currentQuestion);
  if (window.currentQuestion) {
    console.log('DEBUG: options array', window.currentQuestion.options);
  }
  let statsHtml = '<h4 style="color:#18122B;">Question Statistics</h4>';
  if ((stats.type === 'mcq' || stats.type === 'mcq_single' || stats.type === 'mcq_multiple') && window.currentQuestion && window.currentQuestion.options) {
    statsHtml += '<ul>';
    window.currentQuestion.options.forEach((opt, idx) => {
      const optText = opt?.option_text || opt?.text || `Option ${idx + 1}`;
      const count = stats.answers && stats.answers[idx] ? stats.answers[idx] : 0;
      let correct = 0, incorrect = 0;
      if (opt.is_correct) {
        correct = count;
        // Incorrect is the number of times this correct option was NOT selected (i.e., total responses - count)
        // But for MCQ, incorrect means how many times this correct option was missed (i.e., not selected when it should have been)
        // We'll use stats.totalResponses if available, else sum all counts
        const totalResponses = stats.totalResponses ?? Object.values(stats.answers || {}).reduce((a, b) => a + b, 0);
        incorrect = totalResponses - count;
      } else {
        incorrect = count;
      }
      statsHtml += `<li style="color:#18122B;">${optText}${opt.is_correct ? ' <b>(Correct)</b>' : ''}: ${count} responses`;
      if (opt.is_correct) {
        statsHtml += ` <span style="font-size:0.97em;">correct: ${correct}, incorrect: ${incorrect}</span>`;
      }
      statsHtml += '</li>';
    });
    statsHtml += '</ul>';
  } else if (stats.type === 'mcq' || stats.type === 'mcq_single' || stats.type === 'mcq_multiple') {
    statsHtml += '<ul>';
    Object.entries(stats.answers).forEach(([idx, count]) => {
      statsHtml += `<li style="color:#18122B;">Option ${parseInt(idx) + 1}: ${count} responses</li>`;
    });
    statsHtml += '</ul>';
  } else if (stats.type === 'short') {
    statsHtml += `<p style="color:#18122B;">Correct: ${stats.correctCount}</p><p style="color:#18122B;">Incorrect: ${stats.incorrectCount}</p>`;
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
    modal.style.padding = '30px 36px';
    modal.style.border = '2px solid #333';
    modal.style.zIndex = 1000;
    modal.style.boxShadow = '0 0 18px #3332';
    modal.style.borderRadius = '18px';
    modal.style.minWidth = '320px';
    modal.style.maxWidth = '90vw';
    modal.style.color = '#18122B';
    modal.style.fontFamily = "'Satoshi', 'Inter', 'Roboto', Arial, sans-serif";
    document.body.appendChild(modal);
  }
  modal.innerHTML = statsHtml + '<br><button style="margin-top:12px;padding:0.5em 1.2em;border-radius:8px;background:#6C38FF;color:#fff;border:none;font-weight:600;cursor:pointer;" onclick="document.getElementById(\'statsModal\').style.display=\'none\'">Close</button>';
  modal.style.display = 'block';
});

// Center the .container contents in host.html
window.addEventListener('DOMContentLoaded', () => {
  const container = document.querySelector('.container');
  if (container) {
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.justifyContent = 'center';
    container.style.alignItems = 'center';
    container.style.minHeight = '90vh';
    container.style.textAlign = 'center';
  }
});
