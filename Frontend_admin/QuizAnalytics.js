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
      sessionHtml += `<div class="stat-block">
        <h3>Question: ${q.question_text || '(text not found)'}</h3>`;
      if (q.type === 'mcq' || q.type === 'mcq_single' || q.type === 'mcq_multiple') {
        sessionHtml += '<ul>';
        (q.options || []).forEach((opt, idx) => {
          sessionHtml += `<li${opt.is_correct ? ' style="font-weight:bold;color:green;"' : ''}>${opt.option_text}${opt.is_correct ? ' (Correct)' : ''}</li>`;
        });
        sessionHtml += '</ul>';
        sessionHtml += '<div>Stats:</div><ul>';
        Object.entries(stats.answers).forEach(([idx, count]) => {
          const opt = (q.options || [])[idx];
          const optText = opt ? opt.option_text : `Option ${parseInt(idx) + 1}`;
          sessionHtml += `<li>${optText}: ${count} responses</li>`;
        });
        sessionHtml += `</ul><div>Correct: ${stats.correctCount ?? '-'} | Incorrect: ${stats.incorrectCount ?? '-'}</div>`;
      } else if (q.type === 'short') {
        sessionHtml += `<div>Correct: ${stats.correctCount ?? '-'} | Incorrect: ${stats.incorrectCount ?? '-'}</div>`;
        if (stats.correctAnswers && stats.correctAnswers.length > 0) {
          sessionHtml += `<div>Correct Answers: <b>${stats.correctAnswers.join(', ')}</b></div>`;
        } else if (q.correct_answers) {
          sessionHtml += `<div>Correct Answers: <b>${q.correct_answers}</b></div>`;
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