let quizAlreadySubmitted = false;
console.log("quiz_user loaded");
const socket = io("http://127.0.0.1:5050");
const passcode = localStorage.getItem("quizPasscode");
const userName = localStorage.getItem("userName");
const token = localStorage.getItem('adminToken');



let currentQuestion = 0;
let userAnswers = [];
let questionTimer;
let questionTime = 60;
let quizData = [];

window.onload = async () => {
  if (!passcode || !userName) {
    // Redirect to entry page if missing info
    window.location.href = "index_user.html";
    return;
  }

  try {
    const response = await fetch(`http://127.0.0.1:5050/api/quiz/validate/${passcode}`);
  if (!response.ok) throw new Error("Quiz not found");
  
  const data = await response.json();
  const quizId = data.quiz.id;

  // Step 2: Get full quiz state (including questions)
  const stateRes = await fetch(`http://127.0.0.1:5050/api/quiz/${quizId}/state`, {
  });

  if (!stateRes.ok) throw new Error("Failed to get quiz state");

  const quizState = await stateRes.json();
  quizData = quizState.questions;

  console.log("Loaded questions:", quizData);
    document.getElementById("quizSection").style.display = "block";

    socket.emit("joinQuiz", {
      quizId: quizId,
      name: userName,
      questions: quizData  // 💡 this is required by backend
    });
    socket.emit("startQuiz", { quizId: quizId });


    socket.on("show-question", (question) => {
      currentQuestion = question.questionNumber - 1;
      displayQuestion(quizData[currentQuestion]);
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
  clearInterval(questionTimer);
  questionTime = q.time_limit || 60;

  updateTimerDisplay();

  document.getElementById("feedback").innerText = "";
  document.getElementById("nextBtn").style.display = "none";

  const progressBar = document.getElementById("progressBar");
  progressBar.style.width = `${((currentQuestion + 1) / quizData.length) * 100}%`;
  progressBar.innerText = `Q${currentQuestion + 1}/${quizData.length}`;

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
    <h5>Question ${currentQuestion + 1} of ${quizData.length}: ${q.question_text}</h5>
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
  clearInterval(questionTimer);

  let answerValue = null;
  let submittedText = '';

  if (questionType === 'short') {
    const typedAnswer = document.getElementById('typedAnswer');
    answerValue = typedAnswer.value;
    submittedText = `✅ Submitted: "${answerValue}"`;
    if (!answerValue && !autoSubmit) {
      document.getElementById("feedback").innerText = "Please type an answer before submitting.";
      return;
    }
  } else {
    const selectedOption = document.querySelector('input[name="option"]:checked');
    answerValue = selectedOption ? parseInt(selectedOption.value) : null;
    submittedText = `✅ Submitted: Option ${answerValue + 1}`;
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
    feedback.innerText = "⏰ Time's up! No answer selected.";
  } else if (autoSubmit) {
    showAutoSubmitMessage();
    feedback.innerText = `✅ Auto-submitted: ${questionType === 'short' ? `"${answerValue}"` : `Option ${answerValue + 1}`}`;
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
  setTimeout(() => {
  currentQuestion++;
  if (currentQuestion < quizData.length) {
    displayQuestion(quizData[currentQuestion]);
  } else {
    submitQuiz();
  }
}, 2000); // wait 2 seconds before moving to next

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
