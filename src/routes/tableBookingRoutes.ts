import express from 'express';
import {
  createTableBooking,
  getVendorTableBookings,
  updateTableBookingStatus,
} from '../controllers/tableBookingController';

const router = express.Router();

router.post('/', createTableBooking);
router.get('/vendor/:vendorId', getVendorTableBookings);
router.patch('/:id/status', updateTableBookingStatus);

export default router;
