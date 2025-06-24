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
    const questionRes = await pool.query(
      'INSERT INTO questions (quiz_id, question_text, type, time_limit, points) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [quizId, question_text, type, time_limit, points || 1]
    );

    const questionId = questionRes.rows[0].id;

    
    for (const opt of options) {
      await pool.query(
        'INSERT INTO options (question_id, option_text, is_correct) VALUES ($1, $2, $3)',
        [questionId, opt.option_text, opt.is_correct || false]
      );
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
    res.json({ questions: questionsRes.rows });
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

    res.json({
      quiz: quizResult.rows[0],
      questions: questionsResult.rows
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

    res.json({
      quiz: quizResult.rows[0],
      questions: questionsResult.rows
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

exports.submitAnswer = async (req, res) => {
  const { code, questionId } = req.params;
  const { answer, participantId } = req.body;

  try {
    const quizState = activeQuizzes.get(code);
    if (!quizState) {
      return res.status(404).json({ message: 'Quiz not found or not active' });
    }

    quizState.submitAnswer(participantId, questionId, answer);
    res.json({ message: 'Answer submitted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error submitting answer' });
  }
};

exports.getLeaderboard = async (req, res) => {
  const { code } = req.params;

  try {
    const quizState = activeQuizzes.get(code);
    if (!quizState) {
      return res.status(404).json({ message: 'Quiz not found or not active' });
    }

    const leaderboard = quizState.getLeaderboard();
    res.json({ leaderboard });
  } catch (err) {
    console.error(err);
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