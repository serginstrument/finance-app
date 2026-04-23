const db = require('../db/db');

function getRecurringTransactions(req, res) {
  const { page = 1, limit = 10, title, type, category, status } = req.query;
  const currentPage = Number(page);
  const pageSize = Number(limit);
  const offset = (currentPage - 1) * pageSize;
  const conditions = [];
  const values = [];

  if (title) {
    conditions.push('title LIKE ?');
    values.push(`%${title}%`);
  }

  if (type) {
    conditions.push('type = ?');
    values.push(type);
  }

  if (category) {
    conditions.push('category = ?');
    values.push(category);
  }

  if (status === 'Overdue') {
    conditions.push('active = 1');
    conditions.push('next_due_date < CURDATE()');
  } else if (status === 'Due Soon') {
    conditions.push('active = 1');
    conditions.push('next_due_date >= CURDATE()');
    conditions.push('DATEDIFF(next_due_date, CURDATE()) <= reminder_days');
  } else if (status === 'Upcoming') {
    conditions.push('active = 1');
    conditions.push('next_due_date >= CURDATE()');
    conditions.push('DATEDIFF(next_due_date, CURDATE()) > reminder_days');
  } else if (status === 'Inactive') {
    conditions.push('active = 0');
  }

  const whereClause = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';

  const countSql = `
    SELECT COUNT(*) AS total
    FROM recurring_transactions
    ${whereClause}
  `;

  db.query(countSql, values, (countErr, countRows) => {
    if (countErr) return res.status(500).send(countErr);

    const total = Number(countRows[0]?.total || 0);

    const sql = `
      SELECT *
      FROM recurring_transactions
      ${whereClause}
      ORDER BY
        CASE
          WHEN active = 0 THEN 4
          WHEN next_due_date < CURDATE() THEN 1
          WHEN DATEDIFF(next_due_date, CURDATE()) <= reminder_days THEN 2
          ELSE 3
        END ASC,
        next_due_date ASC,
        id DESC
      LIMIT ? OFFSET ?
    `;

    db.query(sql, [...values, pageSize, offset], (err, result) => {
      if (err) return res.status(500).send(err);

      res.json({
        items: result,
        total,
        page: currentPage,
        limit: pageSize,
        hasNextPage: currentPage * pageSize < total
      });
    });
  });
}

function createRecurringTransaction(req, res) {
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
}

function updateRecurringTransaction(req, res) {
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
}

function deleteRecurringTransaction(req, res) {
  const { id } = req.params;

  db.query('DELETE FROM recurring_transactions WHERE id = ?', [id], (err, result) => {
    if (err) return res.status(500).send(err);

    if (result.affectedRows === 0) {
      return res.status(404).send('Recurring transaction not found');
    }

    res.send('Recurring transaction deleted');
  });
}

function toggleRecurringTransaction(req, res) {
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
}

function generateRecurringTransactions(req, res) {
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
}

function getOverdueRecurringTransactions(req, res) {
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
}

function payRecurringTransaction(req, res) {
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
}

function getDueSoonRecurringTransactions(req, res) {
  const sql = `
    SELECT 
      id,
      title,
      type,
      category,
      subcategory,
      amount,
      next_due_date,
      reminder_days,
      DATEDIFF(next_due_date, CURDATE()) AS days_until_due
    FROM recurring_transactions
    WHERE active = 1
      AND next_due_date >= CURDATE()
      AND DATEDIFF(next_due_date, CURDATE()) <= reminder_days
    ORDER BY next_due_date ASC
  `;

  db.query(sql, (err, rows) => {
    if (err) {
      console.error('Due soon error:', err);
      return res.status(500).send('Error loading due soon payments');
    }

    res.json(rows);
  });
}

module.exports = {
  getRecurringTransactions,
  createRecurringTransaction,
  updateRecurringTransaction,
  deleteRecurringTransaction,
  toggleRecurringTransaction,
  payRecurringTransaction,
  generateRecurringTransactions,
  getOverdueRecurringTransactions,
  getDueSoonRecurringTransactions
};
