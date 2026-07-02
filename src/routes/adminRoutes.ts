import { Router } from 'express';
import {
  getApplications,
  getApplicationById,
  approveApplication,
  rejectApplication,
  reviewApplication,
  verifyKycApplication,
  getDashboardStats,
  getVendors,
  updateVendorDocumentStatus,
  updateVendorStatus,
  getServiceProviderKycs,
  updateServiceProviderKycStatus,
  updateServiceProviderDocumentStatus,
  requestServiceProviderDocument,
  getUsers,
  getWholesalers,
  getManufacturers,
  getEntrepreneurs,
  getServiceProviders,
  updateServiceProviderStatus,
  getFranchises,
  getTerritories,
  createTerritory,
  updateUserStatus,
  updateWholesalerStatus,
  updateManufacturerStatus,
  updateEntrepreneurStatus,
  processVendorDrawdown,
  processWholesalerDrawdown,
  processManufacturerDrawdown,
  processEntrepreneurCommissionRelease,
  getWallets,
  getReconciliationStats,
  getDeliveryPartners,
  createDeliveryPartner
} from '../controllers/adminController';
import { requestVendorDocument } from '../controllers/vendorController';
import { processReferralReleases } from '../controllers/referralController';
import { protect, restrictTo } from '../middleware/auth';

const router = Router();

// Restrict all routes under admin to users with 'admin' role
router.get('/applications', protect, restrictTo('admin'), getApplications);
router.get('/applications/:id', protect, restrictTo('admin'), getApplicationById);
router.patch('/applications/:id/approve', protect, restrictTo('admin'), approveApplication);
router.patch('/applications/:id/reject', protect, restrictTo('admin'), rejectApplication);
router.patch('/applications/:id/review', protect, restrictTo('admin'), reviewApplication);
router.patch('/applications/:id/verify-kyc', protect, restrictTo('admin'), verifyKycApplication);
router.post('/vendors/:userId/request-document', protect, restrictTo('admin'), requestVendorDocument);
router.get('/vendors', protect, restrictTo('admin'), getVendors);
router.patch('/vendors/:userId/documents/:docId', protect, restrictTo('admin'), updateVendorDocumentStatus);
router.patch('/vendors/:userId/status', protect, restrictTo('admin'), updateVendorStatus);
router.get('/service-providers/kyc', protect, restrictTo('admin'), getServiceProviderKycs);
router.patch('/service-providers/kyc/:id', protect, restrictTo('admin'), updateServiceProviderKycStatus);
router.patch('/service-providers/:userId/documents/:docId', protect, restrictTo('admin'), updateServiceProviderDocumentStatus);
router.post('/service-providers/:userId/request-document', protect, restrictTo('admin'), requestServiceProviderDocument);
router.get('/service-providers', protect, restrictTo('admin'), getServiceProviders);
router.patch('/service-providers/:userId/status', protect, restrictTo('admin'), updateServiceProviderStatus);
router.get('/dashboard-stats', protect, restrictTo('admin'), getDashboardStats);

router.get('/users', protect, restrictTo('admin'), getUsers);
router.get('/wholesalers', protect, restrictTo('admin'), getWholesalers);
router.get('/manufacturers', protect, restrictTo('admin'), getManufacturers);
router.get('/entrepreneurs', protect, restrictTo('admin'), getEntrepreneurs);
router.get('/franchises', protect, restrictTo('admin'), getFranchises);
router.get('/territories', protect, restrictTo('admin'), getTerritories);
router.get('/delivery-partners', protect, restrictTo('admin'), getDeliveryPartners);
router.post('/delivery-partners/create', protect, restrictTo('admin'), createDeliveryPartner);

router.patch('/users/:userId/status', protect, restrictTo('admin'), updateUserStatus);
router.patch('/wholesalers/:userId/status', protect, restrictTo('admin'), updateWholesalerStatus);
router.patch('/manufacturers/:userId/status', protect, restrictTo('admin'), updateManufacturerStatus);
router.patch('/entrepreneurs/:userId/status', protect, restrictTo('admin'), updateEntrepreneurStatus);

router.post('/vendors/:userId/drawdown', protect, restrictTo('admin'), processVendorDrawdown);
router.post('/wholesalers/:userId/drawdown', protect, restrictTo('admin'), processWholesalerDrawdown);
router.post('/manufacturers/:userId/drawdown', protect, restrictTo('admin'), processManufacturerDrawdown);
router.post('/entrepreneurs/:userId/release-commission', protect, restrictTo('admin'), processEntrepreneurCommissionRelease);

router.get('/wallets', protect, restrictTo('admin'), getWallets);
router.get('/reconciliation', protect, restrictTo('admin'), getReconciliationStats);
router.post('/settlements/release', protect, restrictTo('admin'), processReferralReleases);

export default router;

