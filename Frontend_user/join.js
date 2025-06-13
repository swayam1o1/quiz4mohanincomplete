function joinQuiz() {
  const passcode = document.getElementById('passcode').value.trim();
  if (!passcode) {
    alert('Please enter a passcode');
    return;
  }
  // Save passcode locally and redirect to quiz page
  localStorage.setItem('quizPasscode', passcode);
  window.location.href = 'quiz.html';
}
