import express from 'express';
import {
  getAllShifts,
  getShiftById,
  createShift,
  updateShift,
  deleteShift,
  getShiftStatistics
} from '../controllers/shiftController.ts';
import authMiddleware from '../middleware/authMiddleware.ts';

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