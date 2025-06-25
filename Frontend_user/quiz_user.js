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
  clearInterval(questionTimer);
  const progressBar = document.getElementById("progressBar");
  progressBar.style.width = `100%`;
  progressBar.innerText = `Completed`;

  // 🔢 Count correct answers
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

  // ✅ Show final score
  document.getElementById("quiz").innerHTML = `
    <h4>Quiz Completed ✅</h4>
    <p>You scored <strong>${correctCount} out of ${quizData.length}</strong>.</p>
    <p>Redirecting to leaderboard...</p>
  `;
  document.getElementById("feedback").innerText = '';
  document.getElementById("timer").innerText = '';
  document.getElementById("nextBtn").style.display = 'none';

  // Call the new submission function
  submitParticipant(passcode, userName, correctCount);

  localStorage.removeItem("quizPasscode");
  localStorage.removeItem("userName");
}

/**
 * Submits a participant's quiz results to the server.
 *
 * @param {string} quizId - The access code for the quiz.
 * @param {string} name - The name of the participant.
 * @param {number} score - The final score achieved by the participant.
 */
function submitParticipant(quizId, name, score) {
  // The endpoint on your server to send the data to.
  const endpoint = 'http://localhost:5050/api/quiz/submit';

  // The data to be sent, formatted as a JavaScript object.
  const data = {
    quizId: quizId,
    name: name,
    score: score
  };

  // Use the Fetch API to make the POST request.
  fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    // Convert the JavaScript object to a JSON string for the request body.
    body: JSON.stringify(data)
  })
  .then(response => {
    // Check if the server responded with a success status (e.g., 200-299).
    if (!response.ok) {
      // If not, throw an error to be caught by the .catch block.
      throw new Error(`Submission failed with status: ${response.status}`);
    }
    // Parse the JSON response from the server (e.g., { message: "Submission successful" }).
    return response.json();
  })
  .then(responseData => {
    console.log('Server response:', responseData.message);
    
    // --- After successful submission, call loadLeaderboard ---
    console.log(`Submission successful for ${name}. Loading leaderboard for quiz ${quizId}...`);
    loadLeaderboard(quizId);
  })
  .catch(error => {
    // Handle any errors that occurred during the fetch operation.
    console.error('Error during participant submission:', error);
    // You could display an error message to the user here.
    document.getElementById("quiz").innerHTML += `<p style="color:red;">Could not save score to leaderboard. ${error.message}</p>`;
  });
}

function loadLeaderboard(quizId) {
  // In a real application, you would redirect to the leaderboard page or fetch its data here.
  window.location.href = `Leaderboard.html?quiz=${quizId}`; // ✅ correct key
}

function finishQuiz() {
  // 1. Get user info from localStorage
  const name = localStorage.getItem("username");
  const quiz_id = localStorage.getItem("quiz_id");
  const score = calculateScore(); // Will use real or mock implementation

  // 2. Submit the result to the backend
  fetch('http://localhost:3000/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quiz_id, name, score })
  })
  .then(response => {
    if (!response.ok) throw new Error("Submission failed");
    return response.json();
  })
  .then(() => {
    // 3. Redirect to leaderboard page for this quiz
    window.location.href = `leaderboard.html?quiz=${quiz_id}`;
  })
  .catch(err => {
    alert("Error submitting score: " + err.message);
  });
}

// --- Mock calculateScore if not defined ---
if (typeof calculateScore !== 'function') {
  function calculateScore() {
    // Replace with your real scoring logic
    return Math.floor(Math.random() * 100);
  }
}

// --- Call finishQuiz when quiz is completed ---
// If you have a function that is called when the quiz ends, call finishQuiz() there.
// For demonstration, here's a placeholder:
// function onQuizComplete() {
//   finishQuiz();
// }
// You should replace this with your actual quiz completion logic.
