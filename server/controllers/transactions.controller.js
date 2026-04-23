const ExcelJS = require('exceljs');

const db = require('../db/db');
const { buildFilters } = require('../utils/filters');

function getTransactions(req, res) {
  const { page = 1, limit = 10 } = req.query;
  const currentPage = Number(page);
  const pageSize = Number(limit);
  const offset = (currentPage - 1) * pageSize;
  const { whereClause, values } = buildFilters(req.query, { allowCategory: true });

  const countSql = `
    SELECT COUNT(*) AS total
    FROM transactions
    ${whereClause}
  `;

  db.query(countSql, values, (countErr, countRows) => {
    if (countErr) return res.status(500).send(countErr);

    const total = Number(countRows[0]?.total || 0);

    const sql = `
      SELECT * FROM transactions
      ${whereClause}
      ORDER BY date DESC
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

function exportTransactions(req, res) {
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

      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '217346' }
      };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

      worksheet.getColumn('amount').numFmt = '0.00';

      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;

        const typeCell = row.getCell(4);
        const amountCell = row.getCell(5);

        if (typeCell.value === 'income') {
          typeCell.font = { color: { argb: '2E7D32' }, bold: true };
          amountCell.font = { color: { argb: '2E7D32' }, bold: true };
        } else if (typeCell.value === 'expense') {
          typeCell.font = { color: { argb: 'C0392B' }, bold: true };
          amountCell.font = { color: { argb: 'C0392B' }, bold: true };
        }
      });

      worksheet.eachRow(row => {
        row.eachCell(cell => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFD9D9D9' } },
            left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
            bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } },
            right: { style: 'thin', color: { argb: 'FFD9D9D9' } }
          };
        });
      });

      worksheet.views = [{ state: 'frozen', ySplit: 1 }];

      const totalIncome = rows
        .filter(row => row.type === 'income')
        .reduce((sum, row) => sum + Number(row.amount || 0), 0);

      const totalExpense = rows
        .filter(row => row.type === 'expense')
        .reduce((sum, row) => sum + Number(row.amount || 0), 0);

      const balance = totalIncome - totalExpense;

      const summarySheet = workbook.addWorksheet('Summary');

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

      summarySheet.eachRow(row => {
        row.eachCell(cell => {
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

      if (!from && !to) {
        const dates = rows
          .map(row => {
            if (!row.date) return '';

            if (typeof row.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(row.date)) {
              return row.date;
            }

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

      const formatFileDate = value => {
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

      const nameParts = [];

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
}

function createTransaction(req, res) {
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
      res.send('Р”РѕР±Р°РІР»РµРЅРѕ');
    }
  );
}

function updateTransaction(req, res) {
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
      res.send('РћР±РЅРѕРІР»РµРЅРѕ');
    }
  );
}

function deleteTransaction(req, res) {
  const { id } = req.params;

  db.query('DELETE FROM transactions WHERE id=?', [id], err => {
    if (err) return res.status(500).send(err);
    res.send('РЈРґР°Р»РµРЅРѕ');
  });
}

module.exports = {
  getTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  exportTransactions
};
