require('dotenv').config();

const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('.'));


function buildFilters(query, options = {}) {
  const { allowCategory = false } = options;
  const { type, category, subcategory, comment, from, to } = query;
  const conditions = [];
  const values = [];

  if (type) {
    conditions.push('type = ?');
    values.push(type);
  }

  if (allowCategory && category) {
    conditions.push('category = ?');
    values.push(category);
  }

  if (subcategory) {
  conditions.push('subcategory = ?');
  values.push(subcategory);
}

if (comment) {
  conditions.push('comment LIKE ?');
  values.push(`%${comment}%`);
}

  if (from) {
    conditions.push('date >= ?');
    values.push(from);
  }

  if (to) {
    conditions.push('date <= ?');
    values.push(to);
  }

  return {
    whereClause: conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '',
    values
  };
}

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

db.connect(err => {
  if (err) {
    console.error('Ошибка подключения:', err);
    return;
  }
  console.log('Подключено к MySQL');
});

app.get('/', (req, res) => {
  res.send('Сервер работает');
});

app.get('/transactions', (req, res) => {
  const { page = 1, limit = 10 } = req.query;

  const offset = (page - 1) * limit;

  const { whereClause, values } = buildFilters(req.query, { allowCategory: true });

  const sql = `
    SELECT * FROM transactions
    ${whereClause}
    ORDER BY date DESC
    LIMIT ? OFFSET ?
  `;

  db.query(sql, [...values, Number(limit), Number(offset)], (err, result) => {
    if (err) return res.status(500).send(err);
    res.json(result);
  });
});
app.get('/categories', (req, res) => {
  const { type } = req.query;

  let sql = 'SELECT * FROM categories';
  const values = [];

  if (type) {
    sql += ' WHERE type = ?';
    values.push(type);
  }

  sql += ' ORDER BY name ASC';

  db.query(sql, values, (err, result) => {
    if (err) return res.status(500).send(err);
    res.json(result);
  });
});

app.get('/subcategories', (req, res) => {
  const { category_id } = req.query;

  let sql = 'SELECT * FROM subcategories';
  const values = [];

  if (category_id) {
    sql += ' WHERE category_id = ?';
    values.push(category_id);
  }

  sql += ' ORDER BY name ASC';

  db.query(sql, values, (err, result) => {
    if (err) return res.status(500).send(err);
    res.json(result);
  });
});

app.post('/transactions', (req, res) => {
  const { date, section, category, subcategory, subcategory_id, type, amount, comment } = req.body;

  const sql = `
    INSERT INTO transactions
    (date, section, category, subcategory, subcategory_id, type, amount, comment)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(
    sql,
    [date, section, category, subcategory, subcategory_id || null, type, amount, comment],
    err => {
      if (err) return res.status(500).send(err);
      res.send('Добавлено');
    }
  );
});

app.get('/summary', (req, res) => {
  const { whereClause, values } = buildFilters(req.query, { allowCategory: true });
  const sql = `
    SELECT
      COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS total_income,
      COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS total_expense,
      COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) -
      COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS balance
    FROM transactions${whereClause}
  `;

  db.query(sql, values, (err, result) => {
    if (err) return res.status(500).send(err);
    res.json(result[0]);
  });
});

app.get('/summary/monthly', (req, res) => {
  const { whereClause, values } = buildFilters(req.query, { allowCategory: true });
  const sql = `
    SELECT
      DATE_FORMAT(date, '%Y-%m') AS month,
      COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS total_income,
      COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS total_expense,
      COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) -
      COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS balance
    FROM transactions${whereClause}
    GROUP BY DATE_FORMAT(date, '%Y-%m')
    ORDER BY month DESC
  `;

  db.query(sql, values, (err, result) => {
    if (err) return res.status(500).send(err);
    res.json(result);
  });
});

app.get('/balance/by-category', (req, res) => {
  const { whereClause, values } = buildFilters(req.query, { allowCategory: true });
  const sql = `
    SELECT
      category,
      COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS total_income,
      COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS total_expense,
      COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) -
      COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS balance
    FROM transactions${whereClause}
    GROUP BY category
    ORDER BY category ASC
  `;

  db.query(sql, values, (err, result) => {
    if (err) return res.status(500).send(err);
    res.json(result);
  });
});

app.put('/transactions/:id', (req, res) => {
  const { id } = req.params;
  const { date, section, category, subcategory, subcategory_id, type, amount, comment } = req.body;

  const sql = `
    UPDATE transactions
    SET date=?, section=?, category=?, subcategory=?, subcategory_id=?, type=?, amount=?, comment=?
    WHERE id=?
  `;

  db.query(
    sql,
    [date, section, category, subcategory, subcategory_id || null, type, amount, comment, id],
    err => {
      if (err) return res.status(500).send(err);
      res.send('Обновлено');
    }
  );
});

app.delete('/transactions/:id', (req, res) => {
  const { id } = req.params;

  db.query('DELETE FROM transactions WHERE id=?', [id], err => {
    if (err) return res.status(500).send(err);
    res.send('Удалено');
  });
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Сервер запущен: http://localhost:${port}`);
});
