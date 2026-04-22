require('dotenv').config();

const ExcelJS = require('exceljs');
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


app.get('/transactions/export', (req, res) => {
  const { whereClause, values } = buildFilters(req.query, { allowCategory: true });

  const sql = `
    SELECT date, category, subcategory, type, amount, comment
    FROM transactions
    ${whereClause}
    ORDER BY date DESC
  `;

  db.query(sql, values, async (err, rows) => {
    if (err) return res.status(500).send(err);

    try {
      const workbook = new ExcelJS.Workbook();

      // ===== Sheet 1: Transactions =====
      const worksheet = workbook.addWorksheet('Transactions');

      worksheet.columns = [
        { header: 'Date', key: 'date', width: 14 },
        { header: 'Category', key: 'category', width: 18 },
        { header: 'Subcategory', key: 'subcategory', width: 18 },
        { header: 'Type', key: 'type', width: 12 },
        { header: 'Amount', key: 'amount', width: 14 },
        { header: 'Comment', key: 'comment', width: 36 }
      ];

      rows.forEach(row => {
        worksheet.addRow({
          date: row.date ? new Date(row.date).toISOString().slice(0, 10) : '',
          category: row.category || '',
          subcategory: row.subcategory || '',
          type: row.type || '',
          amount: Number(row.amount || 0),
          comment: row.comment || ''
        });
      });

      // Header style
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '217346' }
      };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

      // Amount format
      worksheet.getColumn('amount').numFmt = '0.00';

      // Type colors
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;

        const typeCell = row.getCell(4);   // Type
        const amountCell = row.getCell(5); // Amount

        if (typeCell.value === 'income') {
          typeCell.font = { color: { argb: '2E7D32' }, bold: true };
          amountCell.font = { color: { argb: '2E7D32' }, bold: true };
        } else if (typeCell.value === 'expense') {
          typeCell.font = { color: { argb: 'C0392B' }, bold: true };
          amountCell.font = { color: { argb: 'C0392B' }, bold: true };
        }
      });

      // Borders
      worksheet.eachRow((row) => {
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFD9D9D9' } },
            left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
            bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } },
            right: { style: 'thin', color: { argb: 'FFD9D9D9' } }
          };
        });
      });

      worksheet.views = [{ state: 'frozen', ySplit: 1 }];

      // ===== Calculations =====
      const totalIncome = rows
        .filter(row => row.type === 'income')
        .reduce((sum, row) => sum + Number(row.amount || 0), 0);

      const totalExpense = rows
        .filter(row => row.type === 'expense')
        .reduce((sum, row) => sum + Number(row.amount || 0), 0);

      const balance = totalIncome - totalExpense;

     // ===== Sheet 2: Summary =====
const summarySheet = workbook.addWorksheet('Summary');

// Top summary
summarySheet.columns = [
  { header: 'Metric', key: 'metric', width: 24 },
  { header: 'Value', key: 'value', width: 18 }
];

summarySheet.addRow({ metric: 'Total Income', value: totalIncome });
summarySheet.addRow({ metric: 'Total Expense', value: totalExpense });
summarySheet.addRow({ metric: 'Balance', value: balance });
summarySheet.addRow({});
summarySheet.addRow({ metric: 'Transactions Count', value: rows.length });
summarySheet.addRow({});
summarySheet.addRow({});
summarySheet.addRow({ metric: 'Category', value: 'Income' });

// header style for first row
const summaryHeader = summarySheet.getRow(1);
summaryHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
summaryHeader.fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: '217346' }
};

summarySheet.getColumn('value').numFmt = '0.00';

summarySheet.getRow(2).font = { color: { argb: '2E7D32' }, bold: true };
summarySheet.getRow(3).font = { color: { argb: 'C0392B' }, bold: true };
summarySheet.getRow(4).font = { color: { argb: '1F5FBF' }, bold: true };

// ===== Category summary table =====
const categoryStartRow = 8;

summarySheet.getCell(`A${categoryStartRow}`).value = 'Category';
summarySheet.getCell(`B${categoryStartRow}`).value = 'Income';
summarySheet.getCell(`C${categoryStartRow}`).value = 'Expense';
summarySheet.getCell(`D${categoryStartRow}`).value = 'Balance';

['A', 'B', 'C', 'D'].forEach(col => {
  const cell = summarySheet.getCell(`${col}${categoryStartRow}`);
  cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  cell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: '217346' }
  };
});

summarySheet.getColumn('A').width = 24;
summarySheet.getColumn('B').width = 16;
summarySheet.getColumn('C').width = 16;
summarySheet.getColumn('D').width = 16;

const categoryMap = new Map();

rows.forEach(row => {
  const categoryName = row.category || 'Uncategorized';

  if (!categoryMap.has(categoryName)) {
    categoryMap.set(categoryName, {
      income: 0,
      expense: 0
    });
  }

  const item = categoryMap.get(categoryName);
  const amount = Number(row.amount || 0);

  if (row.type === 'income') {
    item.income += amount;
  } else if (row.type === 'expense') {
    item.expense += amount;
  }
});

let currentSummaryRow = categoryStartRow + 1;

Array.from(categoryMap.entries())
  .sort((a, b) => a[0].localeCompare(b[0]))
  .forEach(([categoryName, totals]) => {
    const categoryBalance = totals.income - totals.expense;

    summarySheet.getCell(`A${currentSummaryRow}`).value = categoryName;
    summarySheet.getCell(`B${currentSummaryRow}`).value = totals.income;
    summarySheet.getCell(`C${currentSummaryRow}`).value = totals.expense;
    summarySheet.getCell(`D${currentSummaryRow}`).value = categoryBalance;

    summarySheet.getCell(`B${currentSummaryRow}`).font = { color: { argb: '2E7D32' }, bold: true };
    summarySheet.getCell(`C${currentSummaryRow}`).font = { color: { argb: 'C0392B' }, bold: true };
    summarySheet.getCell(`D${currentSummaryRow}`).font = { color: { argb: '1F5FBF' }, bold: true };

    currentSummaryRow++;
  });

summarySheet.getColumn('B').numFmt = '0.00';
summarySheet.getColumn('C').numFmt = '0.00';
summarySheet.getColumn('D').numFmt = '0.00';

summarySheet.eachRow((row) => {
  row.eachCell((cell) => {
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFD9D9D9' } },
      left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
      bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } },
      right: { style: 'thin', color: { argb: 'FFD9D9D9' } }
    };
  });
});

const today = new Date().toISOString().slice(0, 10);

const { from, to, type, category, subcategory, comment } = req.query;

let fileFrom = from || '';
let fileTo = to || '';

// Если пользователь НЕ задал даты в фильтре,
// берём фактический диапазон из отфильтрованных строк
if (!from && !to) {
const dates = rows
  .map(row => {
    if (!row.date) return '';

    // если MySQL уже вернул YYYY-MM-DD, берём как есть
    if (typeof row.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(row.date)) {
      return row.date;
    }

    // если пришёл объект Date
    const d = new Date(row.date);
    if (isNaN(d)) return '';

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  })
  .filter(Boolean)
  .sort();

  if (dates.length) {
    fileFrom = dates[0];
    fileTo = dates[dates.length - 1];
  } else {
    fileFrom = today;
    fileTo = today;
  }
}

const formatFileDate = (value) => {
  if (!value) return '';

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const d = new Date(value);
  if (isNaN(d)) return value;

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

let nameParts = [];

nameParts.push(`${formatFileDate(fileFrom)}_${formatFileDate(fileTo)}`);

if (type && type !== 'all') {
  nameParts.push(type);
}

if (category && category !== 'all') {
  nameParts.push(category.replace(/\s+/g, '_').toLowerCase());
}

if (subcategory && subcategory !== 'all') {
  nameParts.push(subcategory.replace(/\s+/g, '_').toLowerCase());
}

if (comment) {
  const cleanComment = comment
  .trim()
  .split(' ')[0]
  .replace(/\W+/g, '')
  .toLowerCase();
  nameParts.push(`comment_${cleanComment}`);
}

const fileName = `transactions_${nameParts.join('_')}.xlsx`;

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
res.setHeader(
  'Content-Disposition',
  `attachment; filename="${fileName}"`
);

      await workbook.xlsx.write(res);
      res.end();
    } catch (e) {
      console.error(e);
      res.status(500).send('Excel export error');
    }
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

/* Quick Add Templates */

app.get('/quick-add-templates', (req, res) => {
  const sql = `
    SELECT id, title, type, category, subcategory, amount, comment, sort_order
    FROM quick_add_templates
    WHERE active = 1
    ORDER BY sort_order ASC, id ASC
    LIMIT 10
  `;

  db.query(sql, (err, result) => {
    if (err) return res.status(500).send(err);
    res.json(result);
  });
});

app.get('/quick-add-templates/manage', (req, res) => {
  const sql = `
    SELECT id, title, type, category, subcategory, amount, comment, sort_order, active
    FROM quick_add_templates
    ORDER BY active DESC, sort_order ASC, id ASC
    LIMIT 10
  `;

  db.query(sql, (err, result) => {
    if (err) return res.status(500).send(err);
    res.json(result);
  });
});

app.post('/quick-add-templates', (req, res) => {
  const {
    title,
    type,
    category,
    subcategory,
    subcategory_id,
    amount,
    comment
  } = req.body;

  if (!title || !type || !category || !subcategory) {
    return res.status(400).send('Missing required fields');
  }

  const countSql = `
    SELECT COUNT(*) AS total
    FROM quick_add_templates
    WHERE active = 1
  `;

  db.query(countSql, (countErr, countRows) => {
    if (countErr) return res.status(500).send(countErr);

    const total = Number(countRows[0]?.total || 0);
    if (total >= 10) {
      return res.status(400).send('Maximum 10 quick add buttons allowed');
    }

    const insertSql = `
      INSERT INTO quick_add_templates
      (title, type, category, subcategory, subcategory_id, amount, comment, sort_order, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    `;

    db.query(
      insertSql,
      [
        title.trim(),
        type,
        category,
        subcategory,
        subcategory_id || null,
        amount ?? null,
        comment || '',
        total + 1
      ],
      (insertErr, result) => {
        if (insertErr) return res.status(500).send(insertErr);

        res.status(201).json({
          id: result.insertId,
          message: 'Quick add template added'
        });
      }
    );
  });
});

app.delete('/quick-add-templates/:id', (req, res) => {
  const { id } = req.params;

  db.query('DELETE FROM quick_add_templates WHERE id = ?', [id], (err, result) => {
    if (err) return res.status(500).send(err);

    if (result.affectedRows === 0) {
      return res.status(404).send('Quick add template not found');
    }

    res.send('Quick add template deleted');
  });
});


const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Сервер запущен: http://localhost:${port}`);
});

app.get('/recurring-transactions/due-soon', (req, res) => {
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
});