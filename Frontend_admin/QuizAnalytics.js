const urlParams = new URLSearchParams(window.location.search);
const quizId = urlParams.get('quizId');
const analyticsDiv = document.getElementById('analytics');

async function fetchStats() {
  const res = await fetch(`http://localhost:5050/api/quiz/${quizId}/analytics`);
  if (!res.ok) {
    analyticsDiv.innerHTML = '<p>Error loading analytics.</p>';
    return;
  }
  const data = await res.json();
  if (!data.sessions || data.sessions.length === 0) {
    analyticsDiv.innerHTML = '<p>No analytics data found for this quiz.</p>';
    return;
  }
  const questionMap = data.questions || {};
  analyticsDiv.innerHTML = data.sessions.map(session => {
    let sessionHtml = `<div style="margin-bottom:2em;"><h2>Session: ${new Date(session.session_date).toLocaleString()}</h2>`;
    session.stats.forEach(stat => {
      const stats = typeof stat.stats_json === 'string' ? JSON.parse(stat.stats_json) : stat.stats_json;
      const q = questionMap[stat.question_id] || {};
      sessionHtml += `<div class="stat-block" style="background:#fff;border-radius:18px;color:#18122B;padding:30px 36px;box-shadow:0 0 18px #3332;border:2px solid #333;min-width:320px;max-width:90vw;margin-bottom:2em;">`;
      sessionHtml += `<h3>Question: ${q.question_text || '(text not found)'}</h3>`;
      if (q.type === 'mcq' || q.type === 'mcq_single' || q.type === 'mcq_multiple') {
        sessionHtml += '<ul>';
        (q.options || []).forEach((opt, idx) => {
          const count = stats.answers && stats.answers[idx] ? stats.answers[idx] : 0;
          let correct = 0, incorrect = 0;
          if (opt.is_correct) {
            correct = count;
            const totalResponses = stats.totalResponses ?? Object.values(stats.answers || {}).reduce((a, b) => a + b, 0);
            incorrect = totalResponses - count;
          } else {
            incorrect = count;
          }
          sessionHtml += `<li style="color:${opt.is_correct ? '#22b573' : '#18122B'};font-weight:${opt.is_correct ? 'bold' : 'normal'};">${opt.option_text}${opt.is_correct ? ' <span style="color:#22b573;font-weight:bold;">(Correct)</span>' : ''}: ${count} responses`;
          if (opt.is_correct) {
            sessionHtml += ` <span style="font-size:0.97em;color:#18122B;">correct: ${correct}, incorrect: ${incorrect}</span>`;
          }
          sessionHtml += '</li>';
        });
        sessionHtml += '</ul>';
      } else if (q.type === 'short') {
        sessionHtml += `<div style="color:#18122B;">Correct: <span style="color:#22b573;">${stats.correctCount ?? '-'}</span> | Incorrect: ${stats.incorrectCount ?? '-'}</div>`;
        if (stats.correctAnswers && stats.correctAnswers.length > 0) {
          sessionHtml += `<div>Correct Answers: <b style="color:#22b573;">${stats.correctAnswers.join(', ')}</b></div>`;
        } else if (q.correct_answers) {
          sessionHtml += `<div>Correct Answers: <b style="color:#22b573;">${q.correct_answers}</b></div>`;
        }
      } else {
        sessionHtml += `<pre>${JSON.stringify(stats, null, 2)}</pre>`;
      }
      sessionHtml += '</div>';
    });
    sessionHtml += '</div>';
    return sessionHtml;
  }).join('');
}

fetchStats(); 