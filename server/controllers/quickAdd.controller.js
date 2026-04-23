const db = require('../db/db');

function getQuickAddTemplates(req, res) {
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
}

function getQuickAddTemplatesManage(req, res) {
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
}

function createQuickAddTemplate(req, res) {
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
}

function deleteQuickAddTemplate(req, res) {
  const { id } = req.params;

  db.query('DELETE FROM quick_add_templates WHERE id = ?', [id], (err, result) => {
    if (err) return res.status(500).send(err);

    if (result.affectedRows === 0) {
      return res.status(404).send('Quick add template not found');
    }

    res.send('Quick add template deleted');
  });
}

module.exports = {
  getQuickAddTemplates,
  getQuickAddTemplatesManage,
  createQuickAddTemplate,
  deleteQuickAddTemplate
};
