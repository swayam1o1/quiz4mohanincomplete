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
      console.log("✅ Received question from server:", question);
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
  timer.style.color = questionTime <= 10 ? "red" : "blue";
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
    <button class="btn btn-success mt-3" onclick="checkAnswer(${q.id}, '${q.type}')">Submit Answer</button>
  `;

  questionTimer = setInterval(() => {
    questionTime--;
    updateTimerDisplay();
    if (questionTime === 0) {
      clearInterval(questionTimer);
      checkAnswer(q.id, q.type, true);
    }
  }, 1000);
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
  socket.emit('submitAnswer', { quizId: passcode, questionId, answer: answerValue });
  // Wait for stats from server before moving to next question
  document.getElementById("quiz").innerHTML += '<div id="waitingStats"><em>Waiting for statistics...</em></div>';
}

function showAutoSubmitMessage() {
  const msg = document.getElementById('autoSubmitMessage');
  msg.style.display = 'block';
  setTimeout(() => {
    msg.style.display = 'none';
  }, 3000);
}


async function submitQuiz() {
  
  console.log("submitQuiz() called");
  if (quizAlreadySubmitted) return;
  quizAlreadySubmitted = true;
  clearInterval(questionTimer);
  const progressBar = document.getElementById("progressBar");
  progressBar.style.width = `100%`;
  progressBar.innerText = `Completed`;

  // Count correct answers
  let correctCount = 0;
  userAnswers.forEach((ans, idx) => {
    const question = quizData[idx];
    if (question.type === 'short') {
      const correctAnswer = question.options.find(opt => opt.is_correct)?.option_text;
      if (typeof ans.answer === 'string' && correctAnswer && ans.answer.trim().toLowerCase() === correctAnswer.trim().toLowerCase()) {
        correctCount++;
      }
    } else {
      const correctOption = question.options.find(opt => opt.is_correct);
      if (question.options[ans.answer]?.id === correctOption?.id) {
        correctCount++;
      }
    }
  });

  // Show score on the page with a Show Leaderboard button
  document.getElementById("quiz").innerHTML = `
    <h4>Quiz Completed ✅</h4>
    <p>You scored <strong>${correctCount} out of ${quizData.length}</strong>.</p>
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

  // Submit the score to the backend
  await submitParticipant(passcode, userName, correctCount);

  // Remove localStorage keys
  localStorage.removeItem("quizPasscode");
  localStorage.removeItem("userName");

  // Wait 3 seconds, then redirect (unless user already clicked the button)
  setTimeout(() => {
    window.location.href = `Leaderboard.html?quiz=${passcode}`;
  }, 3000);
}

function showStatsModal(stats) {
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
  modal.innerHTML = statsHtml + '<br><button onclick="document.getElementById(\'statsModal\').style.display=\'none\';window.location.reload();">Close</button>';
  modal.style.display = 'block';
  // After closing, wait for next question from admin
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