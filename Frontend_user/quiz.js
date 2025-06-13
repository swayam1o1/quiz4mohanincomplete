// Mock database of passcodes with quiz data
const quizzes = {
  "ABC123": [
    {
      question: "What is 2 + 2?",
      options: ["3", "4", "5", "6"],
      correctIndex: 1
    },
    {
      question: "What is the capital of Italy?",
      options: ["Rome", "Paris", "Berlin", "Madrid"],
      correctIndex: 0
    }
  ],
  "XYZ789": [
    {
      question: "Sun rises in the?",
      options: ["East", "West", "North", "South"],
      correctIndex: 0
    }
  ]
};

let currentQuestion = 0;
let userAnswers = [];
let questionTimer;
let questionTime = 60;
let quizData = [];

window.onload = () => {
  const passcode = localStorage.getItem("quizPasscode");
  if (passcode && quizzes[passcode]) {
    quizData = quizzes[passcode];
    document.getElementById("quizSection").style.display = "block";
    displayQuestion();
  } else {
    document.getElementById("errorSection").style.display = "block";
  }
};

function updateTimerDisplay() {
  const timer = document.getElementById("timer");
  timer.innerText = `Time Left: ${questionTime}s`;
  timer.style.color = questionTime <= 10 ? "red" : "blue";
}

function displayQuestion() {
  clearInterval(questionTimer);
  questionTime = 60;
  updateTimerDisplay();

  document.getElementById("feedback").innerText = "";
  document.getElementById("nextBtn").style.display = "none";

  const progressPercent = (currentQuestion / quizData.length) * 100;
  const progressBar = document.getElementById("progressBar");
  progressBar.style.width = `${progressPercent}%`;
  progressBar.innerText = `Q${currentQuestion + 1}/${quizData.length}`;

  const q = quizData[currentQuestion];
  document.getElementById("quiz").innerHTML = `
    <h5>Question ${currentQuestion + 1} of ${quizData.length}: ${q.question}</h5>
    ${q.options.map((opt, idx) => `
      <div class="form-check">
        <input class="form-check-input" type="radio" name="option" value="${idx}" id="opt${idx}">
        <label class="form-check-label" for="opt${idx}">${opt}</label>
      </div>
    `).join("")}
    <button class="btn btn-success mt-3" onclick="checkAnswer()">Submit Answer</button>
  `;

  questionTimer = setInterval(() => {
    questionTime--;
    updateTimerDisplay();
    if (questionTime === 0) {
      clearInterval(questionTimer);
      checkAnswer(true); // Auto submit when time ends
    }
  }, 1000);
}

function checkAnswer(auto = false) {
  clearInterval(questionTimer);

  const q = quizData[currentQuestion];
  const selectedOption = document.querySelector('input[name="option"]:checked');
  const feedback = document.getElementById("feedback");
  const allOptions = document.querySelectorAll('input[name="option"]');

  let selected = null;
  if (selectedOption) selected = parseInt(selectedOption.value);
  userAnswers[currentQuestion] = selected;

  allOptions.forEach((input, idx) => {
    input.disabled = true;
    const label = input.nextElementSibling;
    label.classList.remove("text-success", "text-danger", "fw-bold");
    if (idx === q.correctIndex) label.classList.add("text-success", "fw-bold");
    if (selected !== null && idx === selected && idx !== q.correctIndex)
      label.classList.add("text-danger");
  });

  if (selected === null) {
    feedback.innerText = "⛔ No option selected.";
    feedback.style.color = "orange";
  } else if (selected === q.correctIndex) {
    feedback.innerText = "✔️ Correct!";
    feedback.style.color = "green";
  } else {
    feedback.innerText = `❌ Incorrect. Correct: ${q.options[q.correctIndex]}`;
    feedback.style.color = "red";
  }

  const nextBtn = document.getElementById("nextBtn");
  nextBtn.style.display = "inline-block";
  nextBtn.onclick = () => {
    currentQuestion++;
    if (currentQuestion < quizData.length) {
      displayQuestion();
    } else {
      submitQuiz();
    }
  };

  // Automatically go to next after delay if auto-submit
  if (auto) {
    setTimeout(() => {
      nextBtn.click();
    }, 2000); // Wait 2 seconds to show feedback
  }
}
function showAutoSubmitMessage() {
  const msg = document.getElementById('autoSubmitMessage');
  msg.style.display = 'block';

  // Optional: hide after some time
  setTimeout(() => {
    msg.style.display = 'none';
  }, 3000);
}

function submitQuiz() {
  clearInterval(questionTimer);
  const progressBar = document.getElementById("progressBar");
  progressBar.style.width = `100%`;
  progressBar.innerText = `Completed`;

  document.getElementById("quiz").innerHTML = '<h4>Quiz Completed ✅</h4>';
  document.getElementById("feedback").innerText = '';
  document.getElementById("timer").innerText = '';
  document.getElementById("nextBtn").style.display = 'none';

  localStorage.removeItem("quizPasscode");
  console.log("User Answers:", userAnswers);
}
