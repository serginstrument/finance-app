const express = require('express');

const {
  getQuickAddTemplates,
  getQuickAddTemplatesManage,
  createQuickAddTemplate,
  deleteQuickAddTemplate
} = require('../controllers/quickAdd.controller');

const router = express.Router();

router.get('/quick-add-templates', getQuickAddTemplates);
router.get('/quick-add-templates/manage', getQuickAddTemplatesManage);
router.post('/quick-add-templates', createQuickAddTemplate);
router.delete('/quick-add-templates/:id', deleteQuickAddTemplate);

module.exports = router;
