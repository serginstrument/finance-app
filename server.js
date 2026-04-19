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

app.post('/categories', (req, res) => {
  const { name, type } = req.body;

  if (!name || !type) {
    return res.status(400).send('Name and type are required');
  }

  const cleanName = name.trim();

  const checkSql = `
    SELECT id
    FROM categories
    WHERE name = ? AND type = ?
    LIMIT 1
  `;

  db.query(checkSql, [cleanName, type], (checkErr, checkResult) => {
    if (checkErr) return res.status(500).send(checkErr);

    if (checkResult.length > 0) {
      return res.status(400).send('Category already exists');
    }

    const insertSql = `
      INSERT INTO categories (name, type)
      VALUES (?, ?)
    `;

    db.query(insertSql, [cleanName, type], (insertErr, result) => {
      if (insertErr) return res.status(500).send(insertErr);

      res.status(201).json({
        id: result.insertId,
        message: 'Category added'
      });
    });
  });
});

app.delete('/categories/:id', (req, res) => {
  const { id } = req.params;

  db.query('DELETE FROM categories WHERE id = ?', [id], (err, result) => {
    if (err) return res.status(500).send(err);

    if (result.affectedRows === 0) {
      return res.status(404).send('Category not found');
    }

    res.send('Category deleted');
  });
});

app.get('/recurring-transactions', (req, res) => {
  const sql = `
    SELECT *
    FROM recurring_transactions
    ORDER BY next_due_date ASC, id DESC
  `;

  db.query(sql, (err, result) => {
    if (err) return res.status(500).send(err);
    res.json(result);
  });
});

app.post('/recurring-transactions', (req, res) => {
  const {
    title,
    type,
    category,
    subcategory,
    subcategory_id,
    amount,
    frequency,
    start_date,
    next_due_date,
    comment
  } = req.body;

  if (!title || !type || !category || !subcategory || !amount || !frequency || !start_date || !next_due_date) {
    return res.status(400).send('Missing required fields');
  }

  const sql = `
    INSERT INTO recurring_transactions
    (title, type, category, subcategory, subcategory_id, amount, frequency, start_date, next_due_date, active, comment)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
  `;

  db.query(
    sql,
    [
      title.trim(),
      type,
      category,
      subcategory,
      subcategory_id || null,
      amount,
      frequency,
      start_date,
      next_due_date,
      comment || ''
    ],
    (err, result) => {
      if (err) return res.status(500).send(err);

      res.status(201).json({
        id: result.insertId,
        message: 'Recurring transaction added'
      });
    }
  );
});

app.delete('/recurring-transactions/:id', (req, res) => {
  const { id } = req.params;

  db.query('DELETE FROM recurring_transactions WHERE id = ?', [id], (err, result) => {
    if (err) return res.status(500).send(err);

    if (result.affectedRows === 0) {
      return res.status(404).send('Recurring transaction not found');
    }

    res.send('Recurring transaction deleted');
  });

});

app.put('/recurring-transactions/:id/toggle', (req, res) => {
  const { id } = req.params;

  const sql = `
    UPDATE recurring_transactions
    SET active = NOT active
    WHERE id = ?
  `;

  db.query(sql, [id], (err, result) => {
    if (err) return res.status(500).send(err);

    if (result.affectedRows === 0) {
      return res.status(404).send('Recurring transaction not found');
    }

    res.send('Recurring transaction updated');
  });
});

app.post('/subcategories', (req, res) => {
  const { category_id, name } = req.body;

  if (!category_id || !name) {
    return res.status(400).send('Category ID and name are required');
  }

  const cleanName = name.trim();

  const checkSql = `
    SELECT id
    FROM subcategories
    WHERE category_id = ? AND name = ?
    LIMIT 1
  `;

  db.query(checkSql, [category_id, cleanName], (checkErr, checkResult) => {
    if (checkErr) return res.status(500).send(checkErr);

    if (checkResult.length > 0) {
      return res.status(400).send('Subcategory already exists');
    }

    const insertSql = `
      INSERT INTO subcategories (category_id, name)
      VALUES (?, ?)
    `;

    db.query(insertSql, [category_id, cleanName], (insertErr, result) => {
      if (insertErr) return res.status(500).send(insertErr);

      res.status(201).json({
        id: result.insertId,
        message: 'Subcategory added'
      });
    });
  });
});

app.put('/recurring-transactions/:id', (req, res) => {
  const { id } = req.params;
  const {
    title,
    type,
    category,
    subcategory,
    subcategory_id,
    amount,
    frequency,
    start_date,
    next_due_date,
    comment
  } = req.body;

  if (!title || !type || !category || !subcategory || !amount || !frequency || !start_date || !next_due_date) {
    return res.status(400).send('Missing required fields');
  }

  const sql = `
    UPDATE recurring_transactions
    SET
      title = ?,
      type = ?,
      category = ?,
      subcategory = ?,
      subcategory_id = ?,
      amount = ?,
      frequency = ?,
      start_date = ?,
      next_due_date = ?,
      comment = ?
    WHERE id = ?
  `;

  db.query(
    sql,
    [
      title.trim(),
      type,
      category,
      subcategory,
      subcategory_id || null,
      amount,
      frequency,
      start_date,
      next_due_date,
      comment || '',
      id
    ],
    (err, result) => {
      if (err) return res.status(500).send(err);

      if (result.affectedRows === 0) {
        return res.status(404).send('Recurring transaction not found');
      }

      res.send('Recurring transaction updated');
    }
  );
});

app.delete('/subcategories/:id', (req, res) => {
  const { id } = req.params;

  db.query('DELETE FROM subcategories WHERE id = ?', [id], err => {
    if (err) return res.status(500).send(err);
    res.send('Subcategory deleted');
  });
});

app.post('/recurring-transactions/generate', (req, res) => {
  const today = new Date().toISOString().slice(0, 10);

  const selectSql = `
    SELECT *
    FROM recurring_transactions
    WHERE active = 1
      AND next_due_date <= ?
    ORDER BY next_due_date ASC, id ASC
  `;

  db.query(selectSql, [today], (selectErr, recurringRows) => {
    if (selectErr) return res.status(500).send(selectErr);

    if (recurringRows.length === 0) {
      return res.json({
        created: 0,
        message: 'No due recurring transactions'
      });
    }

    let processed = 0;
    let created = 0;

    recurringRows.forEach(item => {
      const insertSql = `
        INSERT INTO transactions
        (date, section, category, subcategory, subcategory_id, type, amount, comment)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const transactionComment = item.comment || `Generated from recurring: ${item.title}`;

      db.query(
        insertSql,
        [
          item.next_due_date,
          'budget',
          item.category,
          item.subcategory,
          item.subcategory_id || null,
          item.type,
          item.amount,
          transactionComment
        ],
        insertErr => {
          if (insertErr) {
            processed++;
            if (processed === recurringRows.length) {
              return res.json({
                created,
                message: `${created} recurring transaction(s) generated`
              });
            }
            return;
          }

          const currentDate = new Date(item.next_due_date);
          const nextDate = new Date(currentDate);

          if (item.frequency === 'weekly') {
            nextDate.setDate(nextDate.getDate() + 7);
          } else if (item.frequency === 'biweekly') {
            nextDate.setDate(nextDate.getDate() + 14);
          } else if (item.frequency === 'monthly') {
            nextDate.setMonth(nextDate.getMonth() + 1);
          }

          const nextDueDate = nextDate.toISOString().slice(0, 10);

          const updateSql = `
            UPDATE recurring_transactions
            SET next_due_date = ?
            WHERE id = ?
          `;

          db.query(updateSql, [nextDueDate, item.id], updateErr => {
            if (!updateErr) {
              created++;
            }

            processed++;

            if (processed === recurringRows.length) {
              return res.json({
                created,
                message: `${created} recurring transaction(s) generated`
              });
            }
          });
        }
      );
    });
  });
});

app.get('/recurring-transactions/overdue', (req, res) => {
  const today = new Date().toISOString().slice(0, 10);

  const sql = `
    SELECT *
    FROM recurring_transactions
    WHERE active = 1
      AND next_due_date < ?
    ORDER BY next_due_date ASC, id ASC
  `;

  db.query(sql, [today], (err, result) => {
    if (err) return res.status(500).send(err);
    res.json(result);
  });
});

app.post('/recurring-transactions/:id/pay', (req, res) => {
  const { id } = req.params;
  const { mode } = req.body || {};

  const selectSql = `
    SELECT *
    FROM recurring_transactions
    WHERE id = ? AND active = 1
    LIMIT 1
  `;

  db.query(selectSql, [id], (selectErr, rows) => {
    if (selectErr) return res.status(500).send(selectErr);

    if (rows.length === 0) {
      return res.status(404).send('Recurring transaction not found');
    }

    const item = rows[0];
    const today = new Date().toISOString().slice(0, 10);

    const transactionDate =
      mode === 'early'
        ? today
        : item.next_due_date;

    const insertSql = `
      INSERT INTO transactions
      (date, section, category, subcategory, subcategory_id, type, amount, comment)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const transactionComment = item.comment || `Recorded from recurring: ${item.title}`;

    db.query(
      insertSql,
      [
        transactionDate,
        'budget',
        item.category,
        item.subcategory,
        item.subcategory_id || null,
        item.type,
        item.amount,
        transactionComment
      ],
      insertErr => {
        if (insertErr) return res.status(500).send(insertErr);

        const currentDueDate = new Date(item.next_due_date);
        const nextDate = new Date(currentDueDate);

        if (item.frequency === 'weekly') {
          nextDate.setDate(nextDate.getDate() + 7);
        } else if (item.frequency === 'biweekly') {
          nextDate.setDate(nextDate.getDate() + 14);
        } else if (item.frequency === 'monthly') {
          nextDate.setMonth(nextDate.getMonth() + 1);
        }

        const nextDueDate = nextDate.toISOString().slice(0, 10);

        const updateSql = `
          UPDATE recurring_transactions
          SET next_due_date = ?
          WHERE id = ?
        `;

        db.query(updateSql, [nextDueDate, item.id], updateErr => {
          if (updateErr) return res.status(500).send(updateErr);

          res.json({
            message: mode === 'early' ? 'Payment recorded early' : 'Payment recorded',
            next_due_date: nextDueDate
          });
        });
      }
    );
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
