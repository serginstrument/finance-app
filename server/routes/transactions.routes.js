const express = require('express');

const {
  getTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  exportTransactions
} = require('../controllers/transactions.controller');

const router = express.Router();

router.get('/transactions', getTransactions);
router.get('/transactions/export', exportTransactions);
router.post('/transactions', createTransaction);
router.put('/transactions/:id', updateTransaction);
router.delete('/transactions/:id', deleteTransaction);

module.exports = router;
