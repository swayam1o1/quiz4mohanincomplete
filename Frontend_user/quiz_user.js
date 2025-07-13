const urlParams = new URLSearchParams(window.location.search);
const quizIdFromURL = urlParams.get("quizId");

// Redirect to join.html if name is missing from localStorage
if (!localStorage.getItem("quizId") || !quizIdFromURL) {
  alert("not found");
  window.location.href = `/user/join.html?quizId=${quizIdFromURL || ''}`;
}

let quizAlreadySubmitted = false;
console.log("quiz_user loaded");
const socket = io("http://127.0.0.1:5050");
socket.emit("pingCheck");
socket.on("pongCheck", () => console.log("✅ pongCheck received from server"));

const passcode = localStorage.getItem("quizPasscode");
const userName = localStorage.getItem("userName");



let currentQuestion = 0;
let userAnswers = [];
let questionTimer;
let questionTime = 60;
let quizData = [];

window.onload = async () => {
  // Read quizId from URL and name from localStorage
  const quizId = localStorage.getItem("quizId");

  const userName = localStorage.getItem("userName");

  if (!passcode || !userName) {
    window.location.href = `join.html?quizId=${quizId}`; // or your intended entry page
    return;
  }

  // Always store the username in localStorage when the user enters the quiz
  if (userName) {
    localStorage.setItem('userName', userName);
  }

  try {
    const response = await fetch(`http://127.0.0.1:5050/api/quiz/validate/${passcode}`);
    if (!response.ok) throw new Error("Quiz not found");

    const data = await response.json();
    const quizId = data.quiz.id;
    localStorage.setItem('quizId', quizId);

    // Step 2: Get full quiz state (including questions)
    const stateRes = await fetch(`http://127.0.0.1:5050/api/quiz/${quizId}/state`, {});
    if (!stateRes.ok) throw new Error("Failed to get quiz state");
    const quizState = await stateRes.json();
    quizData = quizState.questions;
    document.getElementById("quizSection").style.display = "block";
    socket.emit("joinQuiz", {
      quizId: quizId,
      name: userName
    });
    console.log("[User] Emitted joinQuiz with:", quizId, userName, quizData.length, "questions");

    // Wait for startQuiz event from admin
    document.getElementById("quiz").innerHTML = '<h4>Waiting for quiz to start...</h4>';
    socket.on("show-question", (question) => {
      window.currentQuestion = question;
      displayQuestion(question); // ✅ Use the server-sent question directly
    });
    
    socket.on("quiz-ended", () => {
      submitQuiz();
    });
  } catch (error) {
    console.error("Failed to load quiz:", error);
    showError("Invalid or expired passcode. Please try again.");
  }
};

function showError(msg) {
  const errorEl = document.getElementById("errorSection");
  errorEl.classList.remove("d-none");
  errorEl.innerText = msg;
}

function updateTimerDisplay() {
  const timer = document.getElementById("timer");
  timer.innerText = `Time Left: ${questionTime}s`;
  timer.style.color = '#fff';
}

function shuffleArray(arr) {
  return arr.map(a => [Math.random(), a]).sort((a, b) => a[0] - b[0]).map(a => a[1]);
}

function displayQuestion(q) {
  console.log("🎯 Rendering question", q.id, q.question_text);

  clearInterval(questionTimer);
  questionTime = q.time_limit || 60;

  updateTimerDisplay();

  document.getElementById("feedback").innerText = "";
  document.getElementById("nextBtn").style.display = "none";

  const progressBar = document.getElementById("progressBar");
  progressBar.style.width = `${(q.questionNumber / q.totalQuestions) * 100}%`;
  progressBar.innerText = `Q${q.questionNumber}/${q.totalQuestions}`;

  let optionsHtml = '';
  if (q.type === 'short') {
    optionsHtml = `<div class="form-group">
      <label for="typedAnswer">Your Answer:</label>
      <input type="text" class="form-control" id="typedAnswer" placeholder="Type your answer here">
    </div>`;
  } else if (q.type === 'match') {
    renderCustomMatchUI(q);
    return;
  } else {
    optionsHtml = q.options.map((opt, idx) => `
      <div class="form-check">
        <input class="form-check-input" type="radio" name="option" value="${idx}" id="opt${idx}">
        <label class="form-check-label" for="opt${idx}">${opt.option_text}</label>
      </div>
    `).join("");
  }

  document.getElementById("quiz").innerHTML = `
    <h5>Question ${q.questionNumber} of ${q.totalQuestions}: ${q.question_text}</h5>
    ${optionsHtml}
    <button class="btn btn-success mt-3" id="submitMatchBtn" style="${q.type === 'match' ? '' : 'display:none;'}">Submit Answer</button>
    <button class="btn btn-success mt-3" onclick="checkAnswer(${q.id}, '${q.type}')" style="${q.type !== 'match' ? '' : 'display:none;'}">Submit Answer</button>
  `;

  if (q.type === 'match') {
    setupCustomMatchDragDrop(q);
    document.getElementById('submitMatchBtn').onclick = function() {
      submitMatchAnswer(q);
    };
  }

  questionTimer = setInterval(() => {
    questionTime--;
    updateTimerDisplay();
    if (questionTime === 0) {
      clearInterval(questionTimer);
      if (q.type === 'match') {
        submitMatchAnswer(q, true);
      } else {
        checkAnswer(q.id, q.type, true);
      }
    }
  }, 1000);
}

function renderCustomMatchUI(q) {
  const leftItems = shuffleArray(q.pairs.map(p => p.left_item));
  const rightItems = shuffleArray(q.pairs.map(p => p.right_item));
  const quizDiv = document.getElementById("quiz");

  // Render left and right columns
  quizDiv.innerHTML = `
    <div style="display:flex;gap:32px;justify-content:center;align-items:flex-start;">
      <div style="flex:1;">
        <strong>Left</strong>
        <ul id="match-left" style="list-style:none;padding:0;">
          ${leftItems.map(item => `
            <li class="match-left-item" data-left="${item}" style="margin-bottom:18px;padding:12px 16px;background:#fff;color:#18122B;border-radius:8px;min-height:48px;display:flex;align-items:center;justify-content:space-between;position:relative;">
              <span>${item}</span>
              <span class="drop-zone" data-left="${item}" style="flex:1;margin-left:12px;min-height:32px;"></span>
              <button class="clear-match-btn" style="display:none;margin-left:8px;background:none;border:none;color:#e74c3c;font-size:1.2em;cursor:pointer;">&times;</button>
            </li>
          `).join('')}
        </ul>
      </div>
      <div style="flex:1;">
        <strong>Right</strong>
        <ul id="match-right" style="list-style:none;padding:0;">
          ${rightItems.map(item => `
            <li class="match-right-item" data-right="${item}" style="margin-bottom:18px;padding:12px 16px;background:#6C38FF;color:#fff;border-radius:8px;cursor:grab;user-select:none;position:relative;">${item}</li>
          `).join('')}
        </ul>
      </div>
    </div>
    <button class="btn btn-success mt-3" id="submitMatchBtn">Submit Answer</button>
  `;

  setupCustomMatchDragDrop(leftItems, rightItems, q);
}

function setupCustomMatchDragDrop(leftItems, rightItems, q) {
  const matches = {}; // { left: right }
  const usedRight = {}; // { right: left }

  let dragging = null;
  let ghost = null;
  let originalCursor = null;

  // Helper: update UI for matches
  function updateUI() {
    // Clear all drop zones and clear buttons
    document.querySelectorAll('.drop-zone').forEach(zone => {
      zone.textContent = '';
      zone.classList.remove('locked');
      zone.parentElement.querySelector('.clear-match-btn').style.display = 'none';
    });
    // Show matches
    Object.entries(matches).forEach(([left, right]) => {
      const zone = document.querySelector(`.drop-zone[data-left="${left}"]`);
      if (zone) {
        zone.textContent = right;
        zone.classList.add('locked');
        zone.parentElement.querySelector('.clear-match-btn').style.display = '';
      }
    });
    // Show/hide right items
    document.querySelectorAll('.match-right-item').forEach(item => {
      const right = item.getAttribute('data-right');
      item.style.opacity = usedRight[right] ? 0.3 : 1;
      item.style.pointerEvents = usedRight[right] ? 'none' : 'auto';
    });
  }

  // Drag logic
  document.querySelectorAll('.match-right-item').forEach(item => {
    item.addEventListener('mousedown', e => {
      e.preventDefault(); // Prevent text selection on drag start
      if (usedRight[item.getAttribute('data-right')]) return;
      dragging = item.getAttribute('data-right');
      // Save and set cursor
      originalCursor = item.style.cursor;
      item.style.cursor = 'grabbing';
      // Prevent text selection
      document.body.style.userSelect = 'none';
      // Create ghost
      ghost = document.createElement('div');
      ghost.className = 'drag-ghost';
      ghost.textContent = dragging;
      Object.assign(ghost.style, {
        position: 'fixed',
        top: e.clientY + 'px',
        left: e.clientX + 'px',
        cursor: 'grabbing',
        userSelect: 'none',
      });
      document.body.appendChild(ghost);

      function moveGhost(ev) {
        ev.preventDefault(); // Prevent text selection while dragging
        ghost.style.left = ev.clientX + 'px';
        ghost.style.top = ev.clientY + 'px';
      }
      function upGhost(ev) {
        document.removeEventListener('mousemove', moveGhost);
        document.removeEventListener('mouseup', upGhost);
        // Reset cursor and user-select
        item.style.cursor = originalCursor || 'pointer';
        document.body.style.userSelect = '';
        // Check if over a drop zone
        let dropped = false;
        document.querySelectorAll('.drop-zone').forEach(zone => {
          const rect = zone.getBoundingClientRect();
          if (
            ev.clientX >= rect.left && ev.clientX <= rect.right &&
            ev.clientY >= rect.top && ev.clientY <= rect.bottom
          ) {
            const left = zone.getAttribute('data-left');
            // Remove previous match if any
            if (matches[left]) usedRight[matches[left]] = null;
            // Remove this right from any other left
            Object.keys(matches).forEach(l => {
              if (matches[l] === dragging) delete matches[l];
            });
            matches[left] = dragging;
            usedRight[dragging] = left;
            dropped = true;
          }
        });
        document.body.removeChild(ghost);
        ghost = null;
        dragging = null;
        updateUI();
      }
      document.addEventListener('mousemove', moveGhost);
      document.addEventListener('mouseup', upGhost);
    });
  });

  // Clear button logic
  document.querySelectorAll('.clear-match-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      const left = btn.parentElement.querySelector('.drop-zone').getAttribute('data-left');
      if (matches[left]) {
        usedRight[matches[left]] = null;
        delete matches[left];
        updateUI();
      }
    });
  });

  updateUI();

  // Submit logic
  document.getElementById('submitMatchBtn').onclick = function() {
    const pairs = Object.entries(matches).map(([left, right]) => ({ left, right }));
    if (pairs.length !== leftItems.length) {
      document.getElementById('feedback').innerText = 'Please match all items before submitting.';
      return;
    }
    // Lock UI
    document.querySelectorAll('.match-right-item').forEach(item => item.style.pointerEvents = 'none');
    document.querySelectorAll('.clear-match-btn').forEach(btn => btn.style.pointerEvents = 'none');
    document.getElementById('submitMatchBtn').disabled = true;
    document.getElementById('submitMatchBtn').innerText = 'Submitted';
    document.getElementById('feedback').innerText = '\u2705 Submitted!';
    // Send to backend
    const quizIdNum = Number(localStorage.getItem('quizId'));
    socket.emit('submitAnswer', { quizId: quizIdNum, questionId: q.id, answer: pairs });
  };
}

function submitMatchAnswer(q, autoSubmit = false) {
  // Collect user matches
  const pairs = [];
  document.querySelectorAll('.match-left-item').forEach(leftLi => {
    const left = leftLi.getAttribute('data-left');
    const right = leftLi.querySelector('.drop-zone').textContent.trim();
    if (right) pairs.push({ left, right });
  });
  if (pairs.length !== q.pairs.length && !autoSubmit) {
    document.getElementById("feedback").innerText = "Please match all items before submitting.";
    return;
  }
  userAnswers.push({
    questionId: q.id,
    answer: pairs,
    autoSubmitted: autoSubmit
  });
  // Disable further changes
  document.querySelectorAll('.match-right-item').forEach(item => { item.draggable = false; item.style.cursor = 'not-allowed'; });
  document.querySelectorAll('.drop-zone').forEach(zone => { zone.style.pointerEvents = 'none'; });
  const submitBtn = document.getElementById('submitMatchBtn');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerText = "Submitted";
  }
  document.getElementById("feedback").innerText = autoSubmit ? "\u23f0 Time's up! Auto-submitted." : "\u2705 Submitted!";
  // Send answer to server
  const quizIdNum = Number(localStorage.getItem('quizId'));
  socket.emit('submitAnswer', { quizId: quizIdNum, questionId: q.id, answer: pairs });
}

function checkAnswer(questionId, questionType, autoSubmit = false) {
  console.log("🧪 checkAnswer called", questionId, questionType, autoSubmit);
  clearInterval(questionTimer);
  let answerValue = null;
  let submittedText = '';
  if (questionType === 'short') {
    const typedAnswer = document.getElementById('typedAnswer');
    answerValue = typedAnswer.value;
    submittedText = `\u2705 Submitted: "${answerValue}"`;
    if (!answerValue && !autoSubmit) {
      document.getElementById("feedback").innerText = "Please type an answer before submitting.";
      return;
    }
  } else if (questionType === 'match') {
    const pairs = [];
    document.querySelectorAll('.match-left-item').forEach(leftLi => {
      const left = leftLi.getAttribute('data-left');
      const right = leftLi.querySelector('.drop-zone').textContent.trim();
      if (right) pairs.push({ left, right });
    });
    answerValue = pairs;
    submittedText = `\u2705 Submitted: ${pairs.length} matches`;
    if (pairs.length === 0 && !autoSubmit) {
      document.getElementById("feedback").innerText = "Please make at least one match before submitting.";
      return;
    }
  } else {
    const selectedOption = document.querySelector('input[name="option"]:checked');
    answerValue = selectedOption ? parseInt(selectedOption.value) : null;
    submittedText = `\u2705 Submitted: Option ${answerValue + 1}`;
    if (answerValue === null && !autoSubmit) {
      document.getElementById("feedback").innerText = "Please select an option before submitting.";
      return;
    }
  }
  userAnswers.push({
    questionId: questionId,
    answer: answerValue,
    autoSubmitted: autoSubmit
  });
  const feedback = document.getElementById("feedback");
  if (autoSubmit && answerValue === null) {
    showAutoSubmitMessage();
    feedback.innerText = "\u23f0 Time's up! No answer selected.";
  } else if (autoSubmit) {
    showAutoSubmitMessage();
    feedback.innerText = `\u2705 Auto-submitted: ${questionType === 'short' ? `"${answerValue}"` : `Option ${answerValue + 1}`}`;
  } else {
    feedback.innerText = submittedText;
  }
  if (questionType === 'short') {
    document.getElementById('typedAnswer').disabled = true;
  } else if (questionType === 'match') {
    document.querySelectorAll('.match-right-item').forEach(item => { item.draggable = false; item.style.cursor = 'not-allowed'; });
    document.querySelectorAll('.drop-zone').forEach(zone => { zone.style.pointerEvents = 'none'; });
  } else {
    document.querySelectorAll('input[name="option"]').forEach(input => input.disabled = true);
  }
  const submitBtn = document.querySelector("button.btn-success");
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerText = "Submitted";
  }
  console.log("📤 Emitting submitAnswer:", {
    quizId: passcode,
    questionId,
    answer: answerValue
  });
  // Send answer to server
  const quizIdNum = Number(localStorage.getItem('quizId'));
  socket.emit('submitAnswer', { quizId: quizIdNum, questionId, answer: answerValue });
}

function showAutoSubmitMessage() {
  const msg = document.getElementById('autoSubmitMessage');
  msg.style.display = 'block';
  setTimeout(() => {
    msg.style.display = 'none';
  }, 3000);
}

socket.on('question-stats', (stats) => {
  console.log('DEBUG: window.currentQuestion', window.currentQuestion);
  if (window.currentQuestion) {
    console.log('DEBUG: options array', window.currentQuestion.options);
  }
  let statsHtml = '<h4 style="color:#18122B;">Question Statistics</h4>';
  if ((stats.type === 'mcq' || stats.type === 'mcq_single' || stats.type === 'mcq_multiple') && window.currentQuestion && window.currentQuestion.options) {
    statsHtml += '<ul>';
    Object.entries(stats.answers).forEach(([idx, count]) => {
      const opt = window.currentQuestion.options[idx];
      const optText = opt?.option_text || opt?.text || `Option ${parseInt(idx) + 1}`;
      statsHtml += `<li style="color:#18122B;">${optText}: ${count} responses</li>`;
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


// Polling function to fetch user's score until it is nonzero or timeout
async function fetchUserScoreWithPolling(quizIdNum, userName, maxAttempts = 10, delayMs = 500) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await fetch(`http://localhost:5050/api/quiz/leaderboard/${quizIdNum}`);
      if (response.ok) {
        const leaderboard = (await response.json()).leaderboard;
        const userEntry = leaderboard.find(entry => entry.name === userName);
        if (userEntry) {
          return userEntry.score;
        }
      }
    } catch (err) {
      // ignore, will retry
    }
    await new Promise(res => setTimeout(res, delayMs));
  }
  // Fallback: return 0 if not found after polling
  return 0;
}

async function submitQuiz() {
  
  console.log("submitQuiz() called");
  if (quizAlreadySubmitted) return;
  quizAlreadySubmitted = true;
  clearInterval(questionTimer);
  const progressBar = document.getElementById("progressBar");
  progressBar.style.width = `100%`;
  progressBar.innerText = `Completed`;

  // Poll for the real score from the backend leaderboard
  const quizIdNum = Number(localStorage.getItem('quizId'));
  const backendScore = await fetchUserScoreWithPolling(quizIdNum, userName);

  // Show score on the page with a Show Leaderboard button
  document.getElementById("quiz").innerHTML = `
    <h4>Quiz Completed ✅</h4>
    <p>You will be redirected to the leaderboard in a moment...</p>
    <button id="showLeaderboardBtn" class="btn btn-primary mt-3">Show Leaderboard</button>
  `;
  document.getElementById("feedback").innerText = '';
  document.getElementById("timer").innerText = '';
  document.getElementById("nextBtn").style.display = 'none';

  // Add click handler for the Show Leaderboard button
  document.getElementById("showLeaderboardBtn").onclick = function() {
    window.location.href = `Leaderboard.html?quiz=${passcode}`;
  };

  // Remove only quizPasscode, not userName
  localStorage.removeItem("quizPasscode");

  // Wait 3 seconds, then redirect (unless user already clicked the button)
  setTimeout(() => {
    window.location.href = `Leaderboard.html?quiz=${passcode}`;
  }, 3000);
}

// Make submitParticipant async and remove redirect from it
async function submitParticipant(quizId, name, score) {
  const endpoint = 'http://localhost:5050/api/quiz/submit';
  const data = { quizId: quizId, name: name, score: score };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error(`Submission failed with status: ${response.status}`);
    const responseData = await response.json();
    console.log('Server response:', responseData.message);
  } catch (error) {
    console.error('Error during participant submission:', error);
    document.getElementById("quiz").innerHTML += `<p style="color:red;">Could not save score to leaderboard. ${error.message}</p>`;
  }
}

function loadLeaderboard(quizId) {
  // In a real application, you would redirect to the leaderboard page or fetch its data here.
  window.location.href = `Leaderboard.html?quiz=${quizId}`; // ✅ correct key
}