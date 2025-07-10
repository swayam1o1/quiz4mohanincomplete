const pool = require('../config/db');
const crypto = require('crypto');

exports.createQuiz = async (req, res) => {
  const { title } = req.body;
  const creator_id = req.user.id;
  if (!title) {
    return res.status(400).json({ message: 'Title is required' });
  }

  const access_code = crypto.randomBytes(3).toString('hex').toUpperCase();

  try {
    const result = await pool.query(
      `INSERT INTO quizzes (title, creator_id, access_code) VALUES ($1, $2, $3) RETURNING *`,
      [title, creator_id, access_code]
    );

    res.status(201).json({ quiz: result.rows[0] });
  } catch (err) {
    console.error('Error creating quiz:', err);
    res.status(500).json({ message: 'Server error' });
  }
};


exports.addQuestion = async (req, res) => {
  const { quizId } = req.params;
  const { question_text, type, time_limit, points, options } = req.body;

  if (!question_text || !type || !time_limit || !Array.isArray(options)) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  try {
    let questionRes;
    let correctAnswers = '';
    if (type === 'short') {
      // For short answer, extract correct answer(s) from options
      correctAnswers = options
        .map(opt => (opt.text || opt.option_text || '').trim())
        .filter(Boolean)
        .join(',');
      questionRes = await pool.query(
        'INSERT INTO questions (quiz_id, question_text, type, time_limit, points, correct_answers) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [quizId, question_text, type, time_limit, points || 1, correctAnswers]
      );
    } else if (type === 'mcq' || type === 'mcq_single' || type === 'mcq_multiple') {
      // For MCQ, extract correct option_text(s)
      correctAnswers = options
        .filter(opt => opt.is_correct)
        .map(opt => (opt.option_text || opt.text || '').trim())
        .filter(Boolean)
        .join(',');
      questionRes = await pool.query(
        'INSERT INTO questions (quiz_id, question_text, type, time_limit, points, correct_answers) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [quizId, question_text, type, time_limit, points || 1, correctAnswers]
      );
    } else {
      questionRes = await pool.query(
        'INSERT INTO questions (quiz_id, question_text, type, time_limit, points) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [quizId, question_text, type, time_limit, points || 1]
      );
    }

    const questionId = questionRes.rows[0].id;

    if (type !== 'short') {
      for (const opt of options) {
        await pool.query(
          'INSERT INTO options (question_id, option_text, is_correct) VALUES ($1, $2, $3)',
          [questionId, opt.option_text, opt.is_correct || false]
        );
      }
    }

    res.status(201).json({ question: questionRes.rows[0], message: 'Question added' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error adding question' });
  }
};

exports.updateQuestion = async (req, res) => {
  const { questionId } = req.params;
  const { question_text, type, time_limit, points, options } = req.body;

  try {
    
    await pool.query(
      'UPDATE questions SET question_text = $1, type = $2, time_limit = $3, points = $4 WHERE id = $5',
      [question_text, type, time_limit, points, questionId]
    );

    await pool.query('DELETE FROM options WHERE question_id = $1', [questionId]);

    for (const opt of options) {
      await pool.query(
        'INSERT INTO options (question_id, option_text, is_correct) VALUES ($1, $2, $3)',
        [questionId, opt.option_text, opt.is_correct || false]
      );
    }

    res.json({ message: 'Question updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error updating question' });
  }
};

exports.deleteQuestion = async (req, res) => {
  const { questionId } = req.params;

  try {
    await pool.query('DELETE FROM questions WHERE id = $1', [questionId]);
    res.json({ message: 'Question deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error deleting question' });
  }
};

exports.getQuestionsByQuiz = async (req, res) => {
  const { quizId } = req.params;
  try {
    const questionsRes = await pool.query(
      `SELECT q.*, json_agg(o.*) AS options
       FROM questions q
       LEFT JOIN options o ON o.question_id = q.id
       WHERE q.quiz_id = $1
       GROUP BY q.id`,
      [quizId]
    );
    // Map correct answer for short answer questions
    const questions = questionsRes.rows.map(q => {
      if (q.type === 'short') {
        return { ...q, shortAnswers: q.short_answers || q.correct_answers };
      }
      return q;
    });
    res.json({ questions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching questions' });
  }
};

exports.startQuiz = async (req, res) => {
  const { quizId } = req.params;

  try {
    // Verify quiz ownership
    const quizResult = await pool.query(
      'SELECT * FROM quizzes WHERE id = $1',
      [quizId]
    );

    if (quizResult.rows.length === 0) {
      return res.status(403).json({ message: 'Not authorized to start this quiz' });
    }

    // Get quiz questions with options
    const questionsResult = await pool.query(
      `SELECT q.*, json_agg(
        json_build_object(
          'id', o.id,
          'option_text', o.option_text,
          'is_correct', o.is_correct
        )
      ) as options
      FROM questions q
      LEFT JOIN options o ON o.question_id = q.id
      WHERE q.quiz_id = $1
      GROUP BY q.id
      ORDER BY q.id`,
      [quizId]
    );
    // Map correct answer for short answer questions
    const questions = questionsResult.rows.map(q => {
      if (q.type === 'short') {
        return { ...q, shortAnswers: q.short_answers || q.correct_answers };
      }
      return q;
    });
    res.json({
      quiz: quizResult.rows[0],
      questions
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error starting quiz' });
  }
};

exports.getQuizState = async (req, res) => {
  const { quizId } = req.params;

  try {
    // Verify quiz ownership
    const quizResult = await pool.query(
      'SELECT * FROM quizzes WHERE id = $1',
      [quizId]
    );

    if (quizResult.rows.length === 0) {
      return res.status(403).json({ message: 'Not authorized to access this quiz' });
    }

    // Get quiz questions with options
    const questionsResult = await pool.query(
      `SELECT q.*, json_agg(
        json_build_object(
          'id', o.id,
          'option_text', o.option_text,
          'is_correct', o.is_correct
        )
      ) as options
      FROM questions q
      LEFT JOIN options o ON o.question_id = q.id
      WHERE q.quiz_id = $1
      GROUP BY q.id
      ORDER BY q.id`,
      [quizId]
    );
    // Map correct answer for short answer questions
    const questions = questionsResult.rows.map(q => {
      if (q.type === 'short') {
        return { ...q, shortAnswers: q.short_answers || q.correct_answers };
      }
      return q;
    });
    res.json({
      quiz: quizResult.rows[0],
      questions
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error getting quiz state' });
  }
};

exports.validateQuizCode = async (req, res) => {
  const { code } = req.params;
  console.log("Received passcode:", req.params.code);


  try {
    const quizResult = await pool.query(
      'SELECT id, title FROM quizzes WHERE access_code = $1',
      [code]
    );

    if (quizResult.rows.length === 0) {
      return res.status(404).json({ message: 'Invalid quiz code' });
    }

    res.json({ 
      valid: true, 
      quiz: quizResult.rows[0] 
    });
    console.log("Quiz code validated successfully:", quizResult.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error validating quiz code' });
  }
};

exports.submitQuiz = async (req, res) => {
  const { quizId, name, score } = req.body;

  if (quizId === undefined || name === undefined || score === undefined) {
    return res.status(400).json({ message: 'Missing required fields: quizId, name, and score are required.' });
  }

  try {
    // Look up quiz by access_code (quizId in frontend is actually the access_code)
    const quizResult = await pool.query('SELECT id, access_code FROM quizzes WHERE access_code = $1', [quizId]);
    if (quizResult.rows.length === 0) {
      return res.status(404).json({ message: 'Quiz not found' });
    }
    const actualQuizId = quizResult.rows[0].id;
    const accessCode = quizResult.rows[0].access_code;

    await pool.query(
        'INSERT INTO participants (quiz_id, name, score) VALUES ($1, $2, $3)',
        [actualQuizId, name, score]
    );

    // Emit leaderboard update to the quiz code room (string)
    const io = req.app.get('io');
    if (io) {
      io.to(accessCode).emit('leaderboardUpdate', { quizId: accessCode });
    }

    res.status(201).json({ message: 'Submission successful' });

  } catch (err) {
    console.error('Error submitting quiz:', err);
    res.status(500).json({ message: 'Server error during submission' });
  }
};

exports.getLeaderboard = async (req, res) => {
  const { code } = req.params;

  try {
    const quizResult = await pool.query('SELECT id FROM quizzes WHERE access_code = $1', [code]);
    if (quizResult.rows.length === 0) {
        return res.status(404).json({ message: 'Quiz not found for this code.' });
    }
    const quizId = quizResult.rows[0].id;

    const leaderboardRes = await pool.query(
      'SELECT name, score, submitted_at FROM participants WHERE quiz_id = $1 ORDER BY score DESC, submitted_at ASC',
      [quizId]
    );

    res.status(200).json({ leaderboard: leaderboardRes.rows });
  } catch (err) {
    console.error('Error fetching leaderboard:', err);
    res.status(500).json({ message: 'Error fetching leaderboard' });
  }
};

exports.listQuizzes = async (req, res) => {
  try {
    // Only show quizzes created by the logged-in admin
    const creator_id = req.user.id;
    const result = await pool.query(
      'SELECT id, title, access_code FROM quizzes WHERE creator_id = $1 ORDER BY id DESC',
      [creator_id]
    );
    res.json({ quizzes: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error fetching quizzes' });
  }
};

exports.getQuizQuestions = async (req, res) => {
  const { quizId } = req.params;
  const adminId = req.user.id;

  try {
    const quiz = await pool.query('SELECT * FROM quizzes WHERE id = $1 AND creator_id = $2', [quizId, adminId]);
    if (quiz.rows.length === 0) {
      return res.status(404).json({ message: 'Quiz not found or you do not have permission to view it.' });
    }

    const questionsRes = await pool.query('SELECT * FROM questions WHERE quiz_id = $1 ORDER BY id', [quizId]);
    const questions = questionsRes.rows;

    for (let i = 0; i < questions.length; i++) {
      const optionsRes = await pool.query('SELECT * FROM options WHERE question_id = $1 ORDER BY id', [questions[i].id]);
      questions[i].options = optionsRes.rows;
    }

    res.status(200).json({ questions });
  } catch (error) {
    console.error('Error fetching quiz questions:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getQuizAnalytics = async (req, res) => {
  const { quizId } = req.params;
  try {
    // Get all stats for this quiz
    const statsResult = await pool.query(
      'SELECT * FROM question_stats WHERE quiz_id = $1 ORDER BY session_date DESC, question_id ASC',
      [quizId]
    );
    // Get all questions for this quiz
    const questionsResult = await pool.query(
      'SELECT id, question_text, type, correct_answers FROM questions WHERE quiz_id = $1',
      [quizId]
    );
    // Get all options for these questions
    const optionsResult = await pool.query(
      'SELECT question_id, option_text, is_correct FROM options WHERE question_id = ANY($1::int[])',
      [questionsResult.rows.map(q => q.id)]
    );
    // Build a map: question_id -> { question_text, type, correct_answers, options: [...] }
    const questionMap = {};
    questionsResult.rows.forEach(q => {
      questionMap[q.id] = {
        question_text: q.question_text,
        type: q.type,
        correct_answers: q.correct_answers,
        options: []
      };
    });
    optionsResult.rows.forEach(opt => {
      if (questionMap[opt.question_id]) {
        questionMap[opt.question_id].options.push(opt);
      }
    });
    // Group stats by session_date
    const sessionsMap = {};
    statsResult.rows.forEach(stat => {
      const sessionKey = stat.session_date.toISOString();
      if (!sessionsMap[sessionKey]) sessionsMap[sessionKey] = [];
      sessionsMap[sessionKey].push(stat);
    });
    const sessions = Object.entries(sessionsMap).map(([session_date, stats]) => ({ session_date, stats }));
    res.json({ sessions, questions: questionMap });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching analytics' });
  }
};