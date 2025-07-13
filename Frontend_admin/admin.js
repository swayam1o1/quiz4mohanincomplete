// admin.js - Modern Quiz Admin Panel

// --- Auth Check ---
const token = localStorage.getItem('adminToken');
if (!token) {
  window.location.href = 'login.html';
}

let quizId = null; // Moved up for proper initialization

const questionsContainer = document.getElementById('questionsContainer');
const addQuestionBtn = document.getElementById('addQuestionBtn');
const quizForm = document.getElementById('quizForm');
const adminMessage = document.getElementById('adminMessage');
const quizRoomIdDiv = document.getElementById('quizRoomId');
const logoutBtn = document.getElementById('logoutBtn');

let questions = [];

function createOptionBlock(qIndex, oIndex, option = {}) {
  return `
    <div class="option-block" data-q-index="${qIndex}" data-o-index="${oIndex}">
      <input type="text" placeholder="Option text" value="${option.text || ''}" required />
      <label style="margin-left:8px;">
        <input type="checkbox" class="correct-checkbox" ${option.isCorrect ? 'checked' : ''} /> Correct
      </label>
      <button type="button" class="remove-option-btn" title="Remove Option">&times;</button>
    </div>
  `;
}

function createMatchPairBlock(qIndex, pIndex, pair = {}) {
  return `
    <div class="match-pair-block" data-q-index="${qIndex}" data-p-index="${pIndex}">
      <input type="text" placeholder="Left item" value="${pair.left || ''}" required style="width:40%;margin-right:8px;" />
      <span style="font-weight:bold;">&#8594;</span>
      <input type="text" placeholder="Right item" value="${pair.right || ''}" required style="width:40%;margin-left:8px;" />
      <button type="button" class="remove-pair-btn" title="Remove Pair">&times;</button>
    </div>
  `;
}

function createQuestionBlock(q, qIndex) {
  const isMCQ = q.type === 'mcq';
  const isShort = q.type === 'short';
  const isMatch = q.type === 'match';
  return `
    <div class="question-block" data-q-index="${qIndex}">
      <button type="button" class="remove-question-btn" title="Remove Question">&times;</button>
      <div class="form-group">
        <label>Question:</label>
        <input type="text" class="question-text" placeholder="Enter question text" value="${q.text || ''}" required />
      </div>
      <div class="form-group">
        <label>Type:</label>
        <select class="question-type">
          <option value="mcq" ${isMCQ ? 'selected' : ''}>Multiple Choice</option>
          <option value="short" ${isShort ? 'selected' : ''}>Short Answer</option>
          <option value="match" ${isMatch ? 'selected' : ''}>Match the Following</option>
        </select>
      </div>
      <div class="form-group options-list" style="${isMCQ ? '' : 'display:none;'}">
        <label>Options:</label>
        <div>
          ${(q.options || []).map((opt, oIndex) => createOptionBlock(qIndex, oIndex, opt)).join('')}
        </div>
        <button type="button" class="add-option-btn">Add Option</button>
      </div>
      <div class="form-group" style="${isShort ? '' : 'display:none;'}">
        <label>Correct Answer(s):</label>
        <input type="text" class="short-answer-input" placeholder="Enter correct answer(s), comma separated" value="${q.shortAnswers || ''}" />
      </div>
      <div class="form-group match-pairs-list" style="${isMatch ? '' : 'display:none;'}">
        <label>Match Pairs:</label>
        <div>
          ${(q.pairs || []).map((pair, pIndex) => createMatchPairBlock(qIndex, pIndex, pair)).join('')}
        </div>
        <button type="button" class="add-pair-btn">Add Pair</button>
      </div>
      <div class="form-group">
        <label>Time Limit (seconds):</label>
        <input type="number" class="time-input" min="5" value="${q.time || 30}" required />
      </div>
    </div>
  `;
}

function renderQuestions() {
  questionsContainer.innerHTML = questions.map((q, i) => createQuestionBlock(q, i)).join('');
}

function addQuestion() {
  updateQuestionsFromDOM();
  questions.push({
    text: '',
    type: 'mcq',
    options: [
      { text: '', isCorrect: false },
      { text: '', isCorrect: false }
    ],
    shortAnswers: '',
    time: 30
  });
  renderQuestions();
}

function removeQuestion(qIndex) {
  questions.splice(qIndex, 1);
  renderQuestions();
}

function addOption(qIndex) {
  updateQuestionsFromDOM();
  questions[qIndex].options.push({ text: '', isCorrect: false });
  renderQuestions();
}

function removeOption(qIndex, oIndex) {
  questions[qIndex].options.splice(oIndex, 1);
  renderQuestions();
}

function addPair(qIndex) {
  updateQuestionsFromDOM();
  if (!questions[qIndex].pairs) questions[qIndex].pairs = [];
  questions[qIndex].pairs.push({ left: '', right: '' });
  renderQuestions();
}

function removePair(qIndex, pIndex) {
  questions[qIndex].pairs.splice(pIndex, 1);
  renderQuestions();
}

function updateQuestionsFromDOM() {
  document.querySelectorAll('.question-block').forEach((block, qIndex) => {
    const text = block.querySelector('.question-text').value;
    const type = block.querySelector('.question-type').value;
    const time = parseInt(block.querySelector('.time-input').value) || 30;
    let options = [];
    let shortAnswers = '';
    let pairs = [];
    if (type === 'mcq') {
      options = Array.from(block.querySelectorAll('.option-block')).map(optDiv => ({
        text: optDiv.querySelector('input[type="text"]').value,
        isCorrect: optDiv.querySelector('.correct-checkbox').checked
      }));
    } else if (type === 'short') {
      shortAnswers = block.querySelector('.short-answer-input').value;
    } else if (type === 'match') {
      pairs = Array.from(block.querySelectorAll('.match-pair-block')).map(pairDiv => ({
        left: pairDiv.querySelector('input[placeholder="Left item"]').value,
        right: pairDiv.querySelector('input[placeholder="Right item"]').value
      }));
    }
    questions[qIndex] = {
      ...questions[qIndex],
      text,
      type,
      options,
      shortAnswers,
      pairs,
      time
    };
  });
}

// Event delegation for dynamic elements
questionsContainer.addEventListener('change', (e) => {
  if (e.target.classList.contains('question-type')) {
    updateQuestionsFromDOM();
    renderQuestions();
  } else if (
    e.target.classList.contains('question-text') ||
    e.target.classList.contains('time-input') ||
    e.target.classList.contains('short-answer-input') ||
    e.target.classList.contains('correct-checkbox') ||
    e.target.classList.contains('option-block') ||
    e.target.classList.contains('match-pair-block')
  ) {
    updateQuestionsFromDOM();
  }
});

questionsContainer.addEventListener('click', (e) => {
  const qBlock = e.target.closest('.question-block');
  if (!qBlock) return;
  const qIndex = parseInt(qBlock.getAttribute('data-q-index'));
  if (e.target.classList.contains('remove-question-btn')) {
    removeQuestion(qIndex);
  } else if (e.target.classList.contains('add-option-btn')) {
    addOption(qIndex);
  } else if (e.target.classList.contains('remove-option-btn')) {
    const optDiv = e.target.closest('.option-block');
    const oIndex = parseInt(optDiv.getAttribute('data-o-index'));
    removeOption(qIndex, oIndex);
  } else if (e.target.classList.contains('add-pair-btn')) {
    addPair(qIndex);
  } else if (e.target.classList.contains('remove-pair-btn')) {
    const pairDiv = e.target.closest('.match-pair-block');
    const pIndex = parseInt(pairDiv.getAttribute('data-p-index'));
    removePair(qIndex, pIndex);
  }
});

addQuestionBtn.addEventListener('click', (e) => {
  e.preventDefault();
  addQuestion();
});

quizForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  updateQuestionsFromDOM();
  const quizName = document.getElementById('quizName').value.trim();
  if (!quizName) {
    adminMessage.textContent = 'Quiz name is required!';
    return;
  }
  if (questions.length === 0) {
    adminMessage.textContent = 'Add at least one question!';
    return;
  }
  for (const q of questions) {
    if (!q.text) {
      adminMessage.textContent = 'Each question must have text!';
      return;
    }
    if (q.type === 'mcq') {
      if (!q.options || q.options.length < 2) {
        adminMessage.textContent = 'Each MCQ must have at least 2 options!';
        return;
      }
      if (!q.options.some(opt => opt.isCorrect)) {
        adminMessage.textContent = 'Each MCQ must have at least one correct answer!';
        return;
      }
      if (q.options.some(opt => !opt.text)) {
        adminMessage.textContent = 'All options must have text!';
        return;
      }
    } else if (q.type === 'short') {
      if (!q.shortAnswers) {
        adminMessage.textContent = 'Short answer questions must have at least one correct answer!';
        return;
      }
    } else if (q.type === 'match') {
      if (!q.pairs || q.pairs.length < 1) {
        adminMessage.textContent = 'Each Match question must have at least one pair!';
        return;
      }
      if (q.pairs.some(pair => !pair.left || !pair.right)) {
        adminMessage.textContent = 'All pairs must have both left and right items!';
        return;
      }
    }
  }
  adminMessage.textContent = 'Creating quiz...';
  try {
    // 1. Create the quiz (room) and get the quiz ID
    const token = localStorage.getItem('adminToken') || '';
    const quizRes = await fetch('http://localhost:5050/api/quiz/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ title: quizName })
    });
    if (!quizRes.ok) {
      const err = await quizRes.json();
      throw new Error(err.message || 'Failed to create quiz');
    }
    const quizData = await quizRes.json();
    quizId = quizData.quiz.id; // Store quizId globally
    const accessCode = quizData.quiz.access_code;
    // 2. Add questions
    for (const q of questions) {
      let options = [];
      let pairs = [];
      if (q.type === 'mcq') {
        options = q.options.map(opt => ({ option_text: opt.text, is_correct: opt.isCorrect }));
      } else if (q.type === 'short') {
        options = q.shortAnswers.split(',').map(ans => ({ option_text: ans.trim(), is_correct: true }));
      } else if (q.type === 'match') {
        pairs = q.pairs.map((pair, idx) => ({ left_item: pair.left, right_item: pair.right, pair_group: idx + 1 }));
      }
      const qRes = await fetch(`http://localhost:5050/api/quiz/${quizId}/questions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          question_text: q.text,
          type: q.type,
          time_limit: q.time,
          points: 1, // You can add a points field if needed
          options,
          pairs
        })
      });
      if (!qRes.ok) {
        const err = await qRes.json();
        throw new Error(err.message || 'Failed to add question');
      }
    }
    adminMessage.textContent = '';
    quizRoomIdDiv.style.display = 'block';
    quizRoomIdDiv.innerHTML = `Quiz created! Room ID: <strong>${accessCode}</strong> (share this with users)`;
    quizForm.reset();
    questions = [];
    renderQuestions();
    startQuizBtn.style.display = 'inline-block';
    nextQuestionBtn.style.display = 'none';
  } catch (err) {
    adminMessage.textContent = 'Error: ' + err.message;
  }
});

// --- Logout ---
logoutBtn.addEventListener('click', () => {
  localStorage.removeItem('adminToken');
  window.location.href = 'login.html';
});

// --- Past Quizzes Logic ---
const fetchQuizzesBtn = document.getElementById('fetchQuizzesBtn');
const quizzesListDiv = document.getElementById('quizzesList');

fetchQuizzesBtn.addEventListener('click', async () => {
  quizzesListDiv.innerHTML = 'Loading...';
  try {
    const token = localStorage.getItem('adminToken') || '';
    const res = await fetch('http://localhost:5050/api/quiz/list', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to fetch quizzes');
    const data = await res.json();
    if (!data.quizzes || data.quizzes.length === 0) {
      quizzesListDiv.textContent = 'No quizzes found.';
      return;
    }
    const quizListHtml = data.quizzes.map(quiz => `
      <div class="quiz-item">
        <div class="quiz-item-header">
          <span><strong>Title:</strong> ${quiz.title}</span>
          <span><strong>Access Code:</strong> ${quiz.access_code}</span>
          <div>
            <button class="view-questions-btn quiz-action-btn" data-quiz-id="${quiz.id}">View Questions</button>
            <button class="view-leaderboard-btn quiz-action-btn" data-quiz-code="${quiz.access_code}">View Leaderboard</button>
            <button class="host-quiz-btn quiz-action-btn" data-quiz-id="${quiz.id}">Host Quiz</button>
            <button class="view-analytics-btn quiz-action-btn" data-quiz-id="${quiz.id}">View Quiz Analytics</button>
          </div>
        </div>
        <div class="questions-details" id="details-${quiz.id}" style="display:none;"></div>
      </div>
    `).join('');
    quizzesListDiv.innerHTML = quizListHtml;
  } catch (err) {
    quizzesListDiv.textContent = 'Error: ' + err.message;
  }
});

quizzesListDiv.addEventListener('click', async (e) => {
  if (e.target.classList.contains('host-quiz-btn')) {
    const quizId = e.target.getAttribute('data-quiz-id');
    window.open(`host.html?quizId=${quizId}`, '_blank');
    return;
  }

  if (e.target.classList.contains('view-leaderboard-btn')) {
    const quizCode = e.target.getAttribute('data-quiz-code');
    window.open(`../user/Leaderboard.html?quiz=${quizCode}`, '_blank');
    return;
  }

  if (e.target.classList.contains('view-analytics-btn')) {
    const quizId = e.target.getAttribute('data-quiz-id');
    window.open(`/admin/QuizAnalytics.html?quizId=${quizId}`, '_blank');
    return;
  }

  if (e.target.classList.contains('view-questions-btn')) {
    const selectedQuizId = e.target.getAttribute('data-quiz-id');
    quizId = selectedQuizId; // Set global quizId for other uses
    const detailsDiv = document.getElementById(`details-${selectedQuizId}`);

    if (detailsDiv.style.display === 'block') {
      detailsDiv.style.display = 'none';
      e.target.textContent = 'View Questions';
      return;
    }

    e.target.textContent = 'Loading...';
    detailsDiv.style.display = 'block';
    detailsDiv.innerHTML = 'Loading questions...';

    try {
      const token = localStorage.getItem('adminToken') || '';
      const res = await fetch(`http://localhost:5050/api/quiz/${selectedQuizId}/questions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch questions for this quiz.');
      const data = await res.json();

      if (!data.questions || data.questions.length === 0) {
        detailsDiv.innerHTML = '<p>This quiz has no questions.</p>';
        e.target.textContent = 'Hide Questions';
        return;
      }

      const questionsHtml = data.questions.map(q => {
        const optionsHtml = (q.options || []).map(opt => `
          <li class="${opt.is_correct ? 'correct-answer' : ''}">
            ${opt.option_text || 'No text'} ${opt.is_correct ? '<strong>(Correct)</strong>' : ''}
          </li>
        `).join('');

        return `
          <div class="question-detail-block">
            <p><strong>Question:</strong> ${q.question_text}</p>
            <ul>${optionsHtml}</ul>
            <p><strong>Points:</strong> ${q.points || 1}</p>
            <p><strong>Time Limit:</strong> ${q.time_limit} seconds</p>
          </div>
        `;
      }).join('');

      detailsDiv.innerHTML = `<div><h4>Questions</h4>${questionsHtml}</div>`;
      e.target.textContent = 'Hide Questions';

    } catch (err) {
      detailsDiv.innerHTML = `<p>Error: ${err.message}</p>`;
      e.target.textContent = 'View Questions';
    }
  }
});

// --- SOCKET.IO ---
const socket = io('http://127.0.0.1:5050');

// Add Start Quiz and Next Question buttons (move to top for global use)
const startQuizBtn = document.createElement('button');
startQuizBtn.id = 'startQuizBtn';
startQuizBtn.textContent = 'Start Quiz';
startQuizBtn.className = 'btn btn-primary';
startQuizBtn.style.marginRight = '10px';
startQuizBtn.style.display = 'none';

const nextQuestionBtn = document.createElement('button');
nextQuestionBtn.id = 'nextQuestionBtn';
nextQuestionBtn.textContent = 'Next Question';
nextQuestionBtn.className = 'btn btn-success';
nextQuestionBtn.style.display = 'none';

document.body.appendChild(startQuizBtn);
document.body.appendChild(nextQuestionBtn);

startQuizBtn.addEventListener('click', () => {
  console.log('Start Quiz clicked, quizId:', quizId); // Debug log
  if (!quizId) {
    adminMessage.textContent = 'Quiz ID not set!';
    return;
  }
  socket.emit('startQuiz', { quizId });
  startQuizBtn.style.display = 'none';
  nextQuestionBtn.style.display = 'inline-block';
});

nextQuestionBtn.addEventListener('click', () => {
  if (!quizId) return;
  socket.emit('nextQuestion', { quizId });
});

// Listen for per-question stats
socket.on('question-stats', (stats) => {
  // Display stats in a simple modal or div
  let statsHtml = '<h4>Question Statistics</h4>';
  if (stats.type === 'mcq') {
    statsHtml += '<ul>';
    Object.entries(stats.answers).forEach(([idx, count]) => {
      statsHtml += `<li style="color:#18122B;">Option ${parseInt(idx) + 1}: ${count} responses</li>`;
    });
    statsHtml += '</ul>';
  } else if (stats.type === 'short') {
    statsHtml += `<p style="color:#18122B;">Correct: ${stats.correctCount}</p><p style="color:#18122B;">Incorrect: ${stats.incorrectCount}</p>`;
  } else if (stats.type === 'tf' || stats.type === 'truefalse') {
    statsHtml += `<p style="color:#18122B;">True: ${stats.answers['True'] || 0}</p><p style="color:#18122B;">False: ${stats.answers['False'] || 0}</p>`;
  }
  showStatsModal(statsHtml);
});

function showStatsModal(html) {
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
  modal.innerHTML = html + '<br><button style="margin-top:12px;padding:0.5em 1.2em;border-radius:8px;background:#6C38FF;color:#fff;border:none;font-weight:600;cursor:pointer;" onclick="document.getElementById(\'statsModal\').style.display=\'none\'">Close</button>';
  modal.style.display = 'block';
}

// Initial render
renderQuestions();
 