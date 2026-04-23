const express = require('express');

const {
  getSummary,
  getMonthlySummary,
  getBalanceByCategory
} = require('../controllers/summary.controller');

const router = express.Router();

router.get('/summary', getSummary);
router.get('/summary/monthly', getMonthlySummary);
router.get('/balance/by-category', getBalanceByCategory);

module.exports = router;
