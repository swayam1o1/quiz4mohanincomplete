// admin.js - Modern Quiz Admin Panel

// --- Auth Check ---
const token = localStorage.getItem('adminToken');
if (!token) {
  window.location.href = 'login.html';
}

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

function createQuestionBlock(q, qIndex) {
  const isMCQ = q.type === 'mcq';
  const isShort = q.type === 'short';
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

function updateQuestionsFromDOM() {
  document.querySelectorAll('.question-block').forEach((block, qIndex) => {
    const text = block.querySelector('.question-text').value;
    const type = block.querySelector('.question-type').value;
    const time = parseInt(block.querySelector('.time-input').value) || 30;
    let options = [];
    let shortAnswers = '';
    if (type === 'mcq') {
      options = Array.from(block.querySelectorAll('.option-block')).map(optDiv => ({
        text: optDiv.querySelector('input[type="text"]').value,
        isCorrect: optDiv.querySelector('.correct-checkbox').checked
      }));
    } else {
      shortAnswers = block.querySelector('.short-answer-input').value;
    }
    questions[qIndex] = {
      ...questions[qIndex],
      text,
      type,
      options,
      shortAnswers,
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
    e.target.classList.contains('option-block')
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
    const quizId = quizData.quiz.id;
    const accessCode = quizData.quiz.access_code;
    // 2. Add questions
    for (const q of questions) {
      let options = [];
      if (q.type === 'mcq') {
        options = q.options.map(opt => ({ option_text: opt.text, is_correct: opt.isCorrect }));
      } else if (q.type === 'short') {
        options = q.shortAnswers.split(',').map(ans => ({ option_text: ans.trim(), is_correct: true }));
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
          options
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
  quizzesListDiv.textContent = 'Loading...';
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
    const table = document.createElement('table');
    table.innerHTML = `<tr><th>Title</th><th>Access Code</th><th>ID</th></tr>` +
      data.quizzes.map(q => `<tr><td>${q.title}</td><td>${q.access_code}</td><td>${q.id}</td></tr>`).join('');
    quizzesListDiv.innerHTML = '';
    quizzesListDiv.appendChild(table);
  } catch (err) {
    quizzesListDiv.textContent = 'Error: ' + err.message;
  }
});

// Initial render
renderQuestions();
