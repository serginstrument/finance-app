const express = require('express');

const {
  getCategories,
  createCategory,
  deleteCategory,
  getSubcategories,
  createSubcategory,
  deleteSubcategory
} = require('../controllers/categories.controller');

const router = express.Router();

router.get('/categories', getCategories);
router.post('/categories', createCategory);
router.delete('/categories/:id', deleteCategory);
router.get('/subcategories', getSubcategories);
router.post('/subcategories', createSubcategory);
router.delete('/subcategories/:id', deleteSubcategory);

module.exports = router;
