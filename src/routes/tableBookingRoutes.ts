import express from 'express';
import {
  createTableBooking,
  getCustomerTableBookings,
  getVendorTableBookings,
  updateTableBookingStatus,
} from '../controllers/tableBookingController';

const router = express.Router();

router.post('/', createTableBooking);
router.get('/customer', getCustomerTableBookings);
router.get('/vendor/:vendorId', getVendorTableBookings);
router.patch('/:id/status', updateTableBookingStatus);

export default router;
