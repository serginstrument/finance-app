const express = require('express');

const {
  getRecurringTransactions,
  createRecurringTransaction,
  updateRecurringTransaction,
  deleteRecurringTransaction,
  toggleRecurringTransaction,
  payRecurringTransaction,
  generateRecurringTransactions,
  getOverdueRecurringTransactions,
  getDueSoonRecurringTransactions
} = require('../controllers/recurring.controller');

const router = express.Router();

router.get('/recurring-transactions', getRecurringTransactions);
router.post('/recurring-transactions', createRecurringTransaction);
router.put('/recurring-transactions/:id', updateRecurringTransaction);
router.delete('/recurring-transactions/:id', deleteRecurringTransaction);
router.put('/recurring-transactions/:id/toggle', toggleRecurringTransaction);
router.post('/recurring-transactions/:id/pay', payRecurringTransaction);
router.post('/recurring-transactions/generate', generateRecurringTransactions);
router.get('/recurring-transactions/overdue', getOverdueRecurringTransactions);
router.get('/recurring-transactions/due-soon', getDueSoonRecurringTransactions);

module.exports = router;
