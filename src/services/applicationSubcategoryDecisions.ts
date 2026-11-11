export type SubcategoryDecision = { subcategoryName: string; status: 'pending' | 'approved' | 'changes_requested' | 'rejected'; reason: string; reviewedAt?: Date };

export function applicationDecisions(app: any): SubcategoryDecision[] {
  const names = [...new Set<string>(app.requestedSubcategories || [])];
  return names.map(subcategoryName => {
    const saved = app.subcategoryDecisions?.find((item: any) => item.subcategoryName === subcategoryName);
    return saved ? { subcategoryName, status: saved.status, reason: saved.reason || '', reviewedAt: saved.reviewedAt }
      : { subcategoryName, status: app.approvedSubcategories?.includes(subcategoryName) ? 'approved' : 'pending', reason: '' };
  });
}

export function approvedApplicationSubcategories(app: any): string[] {
  if (app.subcategoryDecisions?.length) return applicationDecisions(app).filter(item => item.status === 'approved').map(item => item.subcategoryName);
  const requested: string[] = app.requestedSubcategories || [];
  return (app.approvedSubcategories || []).filter((name: string) => requested.includes(name));
}

export function changeSubcategoryDecision(app: any, input: any): SubcategoryDecision[] {
  if (!['pending', 'approved', 'changes_requested', 'rejected'].includes(input.status)) throw new Error('Choose a valid subcategory decision.');
  const decisions = applicationDecisions(app);
  const decision = decisions.find(item => item.subcategoryName === input.subcategoryName);
  if (!decision) throw new Error('This subcategory was not requested in the application.');
  const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
  if (reason.length > 2000 || (['changes_requested', 'rejected'].includes(input.status) && reason.length < 5)) throw new Error('Provide a reason between 5 and 2000 characters for corrections or rejection.');
  return decisions.map(item => item === decision ? { ...item, status: input.status, reason, reviewedAt: new Date() } : item);
}
