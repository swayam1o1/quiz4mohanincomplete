const socket = io();
const passcode = localStorage.getItem("quizPasscode");
const userName = localStorage.getItem("userName");
socket.emit("join-quiz", { quizId: passcode, name: userName });


let currentQuestion = 0;
let userAnswers = [];
let questionTimer;
let questionTime = 60;
let quizData = [];

window.onload = async () => {
  if (!passcode) {
    showError("Missing passcode.");
    return;
  }

  try {
    const response = await fetch(`/validate/${passcode}`);
    if (!response.ok) throw new Error("Quiz not found");

    const data = await response.json();
    const quiz = data.quiz;
    quizData = quiz.questions;

    // ✅ Only emit once, with name included
    socket.emit("join-quiz", { quizId: quiz._id, name: userName });

    document.getElementById("quizSection").style.display = "block";

    socket.on("show-question", (question) => {
      currentQuestion = question.questionNumber - 1;
      quizData = [question];
      displayQuestion(question);
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
  questionTime = q.duration || 60;

  updateTimerDisplay();

  document.getElementById("feedback").innerText = "";
  document.getElementById("nextBtn").style.display = "none";

  const progressBar = document.getElementById("progressBar");
  progressBar.style.width = `${(q.questionNumber / q.totalQuestions) * 100}%`;
  progressBar.innerText = `Q${q.questionNumber}/${q.totalQuestions}`;

  document.getElementById("quiz").innerHTML = `
    <h5>Question ${q.questionNumber} of ${q.totalQuestions}: ${q.question}</h5>
    ${q.options.map((opt, idx) => `
      <div class="form-check">
        <input class="form-check-input" type="radio" name="option" value="${idx}" id="opt${idx}">
        <label class="form-check-label" for="opt${idx}">${opt}</label>
      </div>
    `).join("")}
    <button class="btn btn-success mt-3" onclick="checkAnswer('${q._id}')">Submit Answer</button>
  `;

  questionTimer = setInterval(() => {
    questionTime--;
    updateTimerDisplay();
    if (questionTime === 0) {
      clearInterval(questionTimer);
      checkAnswer(q._id, true);
    }
  }, 1000);
}

function checkAnswer(questionId, autoSubmit = false) {
  clearInterval(questionTimer);

  const selectedOption = document.querySelector('input[name="option"]:checked');
  const answerIndex = selectedOption ? parseInt(selectedOption.value) : null;

  userAnswers.push({
    questionId: questionId,
    answer: answerIndex,
    autoSubmitted: autoSubmit
  });

  const feedback = document.getElementById("feedback");
  if (!selectedOption && !autoSubmit) {
    feedback.innerText = "Please select an option before submitting.";
    return;
  } else if (autoSubmit && answerIndex === null) {
    showAutoSubmitMessage();
    feedback.innerText = "⏰ Time's up! No answer selected.";
  } else if (autoSubmit) {
    showAutoSubmitMessage();
    feedback.innerText = `✅ Auto-submitted: Option ${answerIndex + 1}`;
  } else {
    feedback.innerText = `✅ Submitted: Option ${answerIndex + 1}`;
  }

  document.querySelectorAll('input[name="option"]').forEach(input => input.disabled = true);
  const submitBtn = document.querySelector("button.btn-success");
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerText = "Submitted";
  }
}

function showAutoSubmitMessage() {
  const msg = document.getElementById('autoSubmitMessage');
  msg.style.display = 'block';
  setTimeout(() => {
    msg.style.display = 'none';
  }, 3000);
}

async function submitQuiz() {
  clearInterval(questionTimer);
  const progressBar = document.getElementById("progressBar");
  progressBar.style.width = `100%`;
  progressBar.innerText = `Completed`;

  document.getElementById("quiz").innerHTML = '<h4>Quiz Completed ✅</h4>';
  document.getElementById("feedback").innerText = '';
  document.getElementById("timer").innerText = '';
  document.getElementById("nextBtn").style.display = 'none';

  try {
    const response = await fetch("/api/submit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        quizId: passcode,
        name: userName,
        answers: userAnswers
      })
    });
    const result = await response.json();
    console.log("Submitted to backend:", result);
  } catch (err) {
    console.error("Failed to submit answers to backend:", err);
  }

  localStorage.removeItem("quizPasscode");
  localStorage.removeItem("userName");
}
