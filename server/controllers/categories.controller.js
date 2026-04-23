const db = require('../db/db');

function getCategories(req, res) {
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
}

function createCategory(req, res) {
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
}

function deleteCategory(req, res) {
  const { id } = req.params;

  db.query('DELETE FROM categories WHERE id = ?', [id], (err, result) => {
    if (err) return res.status(500).send(err);

    if (result.affectedRows === 0) {
      return res.status(404).send('Category not found');
    }

    res.send('Category deleted');
  });
}

function getSubcategories(req, res) {
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
}

function createSubcategory(req, res) {
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
}

function deleteSubcategory(req, res) {
  const { id } = req.params;

  db.query('DELETE FROM subcategories WHERE id = ?', [id], err => {
    if (err) return res.status(500).send(err);
    res.send('Subcategory deleted');
  });
}

module.exports = {
  getCategories,
  createCategory,
  deleteCategory,
  getSubcategories,
  createSubcategory,
  deleteSubcategory
};
