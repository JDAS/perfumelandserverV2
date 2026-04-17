const express = require('express');
const router = express.Router();
const { protect, admin } = require('../middleware/authMiddleware');

const {
  createObject,
  getObjects,
  getObjectByApiName,
  updateObject,
  deleteObject,
} = require('../controllers/customObjectController');

router.use(protect, admin);

router.get('/', getObjects);
router.get('/:apiName', getObjectByApiName);
router.post('/', createObject);
router.put('/:apiName', updateObject);
router.delete('/:apiName', deleteObject);

module.exports = router;
