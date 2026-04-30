const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');

const {
  createRecord,
  getRecords,
  getRelatedRecords,
  getRecordById,
  getClientSummary,
  getSalePaymentSummary,
  getSalesPaymentHighlights,
  convertQuoteToSale,
  syncSaleCampaigns,
  syncProductSupplierReference,
  updateRecord,
  deleteRecord,
} = require('../controllers/customRecordController');

router.use(protect, admin);

router.post('/:object', createRecord);
router.get('/:object', getRecords);
router.post('/:object/:id/convert-to-sale', convertQuoteToSale);
router.post('/:object/:id/sync-campaigns', syncSaleCampaigns);
router.post('/:object/:id/sync-supplier-reference', syncProductSupplierReference);
router.get('/sales/payment-highlights', getSalesPaymentHighlights);
router.get('/:object/:id/client-summary', getClientSummary);
router.get('/:object/:id/payment-summary', getSalePaymentSummary);
router.get('/:object/:id/related/:relatedObject/:relatedField', getRelatedRecords);
router.get('/:object/:id', getRecordById);
router.put('/:object/:id', updateRecord);
router.delete('/:object/:id', deleteRecord);

module.exports = router;
