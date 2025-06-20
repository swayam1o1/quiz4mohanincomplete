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
  if (!passcode) {
    showError("Missing passcode.");
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

  document.getElementById("quiz").innerHTML = `
    <h5>Question ${currentQuestion + 1} of ${quizData.length}: ${q.question_text}</h5>
    ${q.options.map((opt, idx) => `
      <div class="form-check">
        <input class="form-check-input" type="radio" name="option" value="${idx}" id="opt${idx}">
        <label class="form-check-label" for="opt${idx}">${opt.option_text}</label>
      </div>
    `).join("")}
    <button class="btn btn-success mt-3" onclick="checkAnswer(${q.id})">Submit Answer</button>
  `;

  questionTimer = setInterval(() => {
    questionTime--;
    updateTimerDisplay();
    if (questionTime === 0) {
      clearInterval(questionTimer);
      checkAnswer(q.id, true);
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
  clearInterval(questionTimer);
  const progressBar = document.getElementById("progressBar");
  progressBar.style.width = `100%`;
  progressBar.innerText = `Completed`;

  // 🔢 Count correct answers
  let correctCount = 0;
  userAnswers.forEach((ans, idx) => {
    const correctOption = quizData[idx].options.find(opt => opt.is_correct);
    if (quizData[idx].options[ans.answer]?.id === correctOption?.id) {
      correctCount++;
    }
  });

  // ✅ Show final score
  document.getElementById("quiz").innerHTML = `
    <h4>Quiz Completed ✅</h4>
    <p>You scored <strong>${correctCount} out of ${quizData.length}</strong>.</p>
  `;
  document.getElementById("feedback").innerText = '';
  document.getElementById("timer").innerText = '';
  document.getElementById("nextBtn").style.display = 'none';

  // 📤 Submit to backend
  try {
    const response = await fetch("http://127.0.0.1:5050/api/submit", {
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

