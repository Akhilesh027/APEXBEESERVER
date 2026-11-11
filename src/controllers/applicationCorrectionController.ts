import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../middleware/auth';
import { BusinessApplication } from '../models/BusinessApplication';
import { resolveCategorySelections } from '../services/applicationCategorySelection';
import { parseApplicationBusinessDetails } from '../services/applicationBusinessDetails';
import { applicationDecisions, changeSubcategoryDecision } from '../services/applicationSubcategoryDecisions';

export async function reviewApplicationSubcategory(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) { res.status(400).json({ message: 'Invalid application.' }); return; }
    const app = await BusinessApplication.findOne({ _id: req.params.id, applicationType: 'vendor', onboardingVersion: 2 });
    if (!app) { res.status(404).json({ message: 'Application not found.' }); return; }
    if (!['pending', 'pending_approval', 'changes_requested'].includes(app.status) || app.correctionStage === 'documents') {
      res.status(409).json({ message: 'Individual decisions can be edited before initial approval. Request application corrections to reopen review.' }); return;
    }
    let decisions;
    try { decisions = changeSubcategoryDecision(app, req.body); }
    catch (error) { res.status(400).json({ message: (error as Error).message }); return; }
    const approved = decisions.filter(item => item.status === 'approved').map(item => item.subcategoryName);
    const corrections = decisions.filter(item => item.status === 'changes_requested');
    const needsCorrections = corrections.length > 0 && approved.length === 0;
    const updated = await BusinessApplication.findOneAndUpdate({ _id: app._id, updatedAt: app.updatedAt, status: app.status }, {
      $set: { subcategoryDecisions: decisions, approvedSubcategories: approved, status: needsCorrections ? 'changes_requested' : 'pending',
        ...(needsCorrections ? { correctionStage: 'application', correctionReason: corrections.map(item => `${item.subcategoryName}: ${item.reason}`).join('\n').slice(0, 2000) } : {}) },
      ...(!needsCorrections ? { $unset: { correctionStage: '', correctionReason: '' } } : {}),
    }, { new: true, runValidators: true });
    if (!updated) { res.status(409).json({ message: 'The application changed. Refresh before reviewing again.' }); return; }
    res.json({ success: true, application: updated });
  } catch { res.status(500).json({ message: 'Unable to save the subcategory decision.' }); }
}

export async function requestApplicationChanges(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { stage, reason } = req.body;
    if (!mongoose.isValidObjectId(id) || !['application', 'documents'].includes(stage) || typeof reason !== 'string' || reason.trim().length < 5 || reason.length > 2000) {
      res.status(400).json({ message: 'Choose the correction stage and provide a reason between 5 and 2000 characters.' }); return;
    }
    const application = await BusinessApplication.findOneAndUpdate({ _id: id, applicationType: 'vendor', onboardingVersion: 2,
      status: { $in: stage === 'documents' ? ['pre_approved', 'under_review', 'kyc_submitted'] : ['pending', 'pending_approval', 'pre_approved', 'under_review', 'changes_requested'] } },
      { $set: { status: 'changes_requested', correctionStage: stage, correctionReason: reason.trim(), adminRemarks: reason.trim(),
        ...(stage === 'documents' ? { kycStatus: 'rejected' } : {}) } }, { new: true, runValidators: true });
    if (!application) { res.status(409).json({ message: 'This application is not at a stage where these corrections can be requested.' }); return; }
    res.json({ success: true, message: 'Corrections requested. The applicant can now resubmit.', application });
  } catch { res.status(500).json({ message: 'Unable to request application changes.' }); }
}

export async function resubmitVendorApplication(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) { res.status(400).json({ message: 'Invalid application.' }); return; }
    const application = await BusinessApplication.findOne({ _id: req.params.id, userId: req.user?.id, applicationType: 'vendor', onboardingVersion: 2 });
    if (!application) { res.status(404).json({ message: 'Application not found.' }); return; }
    const individualCorrections = applicationDecisions(application).some(item => item.status === 'changes_requested');
    if (!((application.status === 'changes_requested' && application.correctionStage === 'application') ||
      (['pending', 'pending_approval', 'pre_approved'].includes(application.status) && individualCorrections))) { res.status(409).json({ message: 'This application is not awaiting business detail corrections.' }); return; }
    const fields = ['businessName', 'ownerName', 'mobile', 'email', 'state', 'district', 'mandal', 'address', 'pincode', 'panNumber'] as const;
    for (const field of fields) {
      if (typeof req.body[field] !== 'string' || !req.body[field].trim()) { res.status(400).json({ message: 'Complete the required contact, business, location, and PAN details.' }); return; }
    }
    if (!/^\d{6}$/.test(req.body.pincode)) { res.status(400).json({ message: 'Enter a valid six-digit PIN code.' }); return; }
    let selection;
    let business;
    try {
      selection = await resolveCategorySelections(req.body.categorySelections);
      business = parseApplicationBusinessDetails(req.body);
      if (selection.subcategoryNames.includes('Milk and Dairy') && (!req.body.businessDetails?.dairy?.businessType || (!req.body.businessDetails.dairy.morningDelivery && !req.body.businessDetails.dairy.eveningDelivery))) throw new Error('Complete the dairy business type and delivery timings.');
    } catch (error) { res.status(400).json({ message: error instanceof Error ? error.message : 'Invalid application details.' }); return; }
    const updates: Record<string, any> = { ...business, ...Object.fromEntries(fields.map(field => [field, req.body[field].trim()])), categorySelections: selection.selections, categories: selection.names, category: selection.names.join(', '),
      primaryCategory: selection.names[0], subCategory: selection.subcategoryNames[0], requestedSubcategories: selection.subcategoryNames,
      approvedSubcategories: [], subcategoryDecisions: [], businessDetails: selection.subcategoryNames.includes('Milk and Dairy') ? { dairy: req.body.businessDetails.dairy } : {},
      status: 'pending', kycStatus: 'not_uploaded' };
    for (const field of ['gstNumber', 'aadhaarNumber', 'experience', 'remarks'] as const) if (typeof req.body[field] === 'string') updates[field] = req.body[field].trim();
    const updated = await BusinessApplication.findOneAndUpdate({ _id: application._id, userId: req.user?.id, status: application.status, ...(application.correctionStage ? { correctionStage: application.correctionStage } : {}), ...(application.updatedAt ? { updatedAt: application.updatedAt } : {}) },
      { $set: updates, $unset: { correctionStage: '', ...(!business.location ? { location: '' } : {}) } }, { new: true, runValidators: true });
    if (!updated) { res.status(409).json({ message: 'The application status changed. Refresh before resubmitting.' }); return; }
    res.json({ success: true, message: 'Application resubmitted for admin review.', application: updated });
  } catch (error) {
    res.status(error instanceof mongoose.Error.ValidationError ? 400 : 500).json({ message: error instanceof mongoose.Error.ValidationError ? 'Check the business details and try again.' : 'Unable to resubmit the application.' });
  }
}
