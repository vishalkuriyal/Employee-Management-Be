import express from 'express';
import {
  getAllShifts,
  getShiftById,
  createShift,
  updateShift,
  deleteShift,
  getShiftStatistics
} from '../controllers/shiftController';
import authMiddleware from '../middleware/authMiddleware';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authMiddleware);

// GET routes
router.get('/', getAllShifts);
router.get('/statistics', getShiftStatistics);
router.get('/:id', getShiftById);

// POST routes
router.post('/add', createShift);

// PUT routes
router.put('/:id', updateShift);

// DELETE routes
router.delete('/:id', deleteShift);

export default router;