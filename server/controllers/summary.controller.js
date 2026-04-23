const db = require('../db/db');
const { buildFilters } = require('../utils/filters');

function getSummary(req, res) {
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
}

function getMonthlySummary(req, res) {
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
}

function getBalanceByCategory(req, res) {
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
}

module.exports = {
  getSummary,
  getMonthlySummary,
  getBalanceByCategory
};
