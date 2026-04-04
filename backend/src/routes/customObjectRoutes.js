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

router.use(protect);

router.get('/', getObjects);
router.get('/:apiName', getObjectByApiName);
router.post('/', admin, createObject);
router.put('/:apiName', admin, updateObject);
router.delete('/:apiName', admin, deleteObject);

module.exports = router;
