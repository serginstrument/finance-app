const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// подключение к базе
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'root123', // твой пароль
  database: 'finance_app'
});

db.connect(err => {
  if (err) {
    console.error('Ошибка подключения:', err);
    return;
  }
  console.log('Подключено к MySQL 🚀');
});

// тест
app.get('/', (req, res) => {
  res.send('Сервер работает 🚀');
});

// получить все записи
app.get('/transactions', (req, res) => {
  db.query('SELECT * FROM transactions', (err, result) => {
    if (err) return res.status(500).send(err);
    res.json(result);
  });
});

// добавить запись
app.post('/transactions', (req, res) => {
  const { date, section, category, subcategory, type, amount, comment } = req.body;

  const sql = `
    INSERT INTO transactions 
    (date, section, category, subcategory, type, amount, comment)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(sql, [date, section, category, subcategory, type, amount, comment], (err) => {
    if (err) return res.status(500).send(err);
    res.send('Добавлено');
  });
});
app.get('/summary', (req, res) => {
  const sql = `
    SELECT
      SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) AS total_income,
      SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) AS total_expense,
      SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) -
      SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) AS balance
    FROM transactions
  `;

  db.query(sql, (err, result) => {
    if (err) return res.status(500).send(err);
    res.json(result[0]);
  });
});

app.get('/summary/monthly', (req, res) => {
  const sql = `
    SELECT
      DATE_FORMAT(date, '%Y-%m') AS month,
      SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) AS total_income,
      SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) AS total_expense,
      SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) -
      SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) AS balance
    FROM transactions
    GROUP BY DATE_FORMAT(date, '%Y-%m')
    ORDER BY month DESC
  `;

  db.query(sql, (err, result) => {
    if (err) return res.status(500).send(err);
    res.json(result);
  });
});

app.put('/transactions/:id', (req, res) => {
  const { id } = req.params;
  const { date, section, category, subcategory, type, amount, comment } = req.body;

  const sql = `
    UPDATE transactions
    SET date=?, section=?, category=?, subcategory=?, type=?, amount=?, comment=?
    WHERE id=?
  `;

  db.query(sql, [date, section, category, subcategory, type, amount, comment, id], (err) => {
    if (err) return res.status(500).send(err);
    res.send('Обновлено');
  });
});

app.delete('/transactions/:id', (req, res) => {
  const { id } = req.params;

  db.query('DELETE FROM transactions WHERE id=?', [id], (err) => {
    if (err) return res.status(500).send(err);
    res.send('Удалено');
  });
});

app.listen(3000, () => {
  console.log('Сервер запущен: http://localhost:3000');
});