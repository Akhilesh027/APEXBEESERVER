import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'node:fs/promises';
import path from 'node:path';
import Category from '../models/Category';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

type Definition = { name: string; slug: string; supportedItemTypes: string[]; subcategories: { name: string; slug: string; aliases?: string[] }[] };
type RecordData = { _id: any; name: string; slug: string; level: number; parentId?: any; [key: string]: any };
const key = (value: string) => value.toLowerCase().trim();

export function createCategorySeedPlan(definitions: Definition[], existing: RecordData[]) {
  const inserts: RecordData[] = [];
  const renames: { id: any; from: string; to: string }[] = [];
  const targets: RecordData[] = [];
  const records = [...existing];
  function ensure(name: string, slug: string, level: number, parentId: any, types: string[], order: number, aliases: string[] = []) {
    const slugMatch = records.find(item => item.slug === slug);
    if (slugMatch && (slugMatch.level !== level || String(slugMatch.parentId || '') !== String(parentId || ''))) throw new Error(`Slug conflict for ${name}; no changes made.`);
    const candidates = slugMatch ? [slugMatch] : records.filter(item => item.level === level && String(item.parentId || '') === String(parentId || '') &&
      (key(item.name) === key(name) || aliases.includes(key(item.slug)) || aliases.includes(key(item.name))));
    if (candidates.length > 1) throw new Error(`Multiple existing matches for ${name}; no changes made.`);
    let record = candidates[0];
    if (!record) {
      record = { _id: new mongoose.Types.ObjectId(), name, slug, level, parentId: parentId || null, supportedItemTypes: types, isActive: true, sortOrder: order, displayOrder: order };
      inserts.push(record); records.push(record);
    } else if (record.name !== name) {
      renames.push({ id: record._id, from: record.name, to: name });
      record = { ...record, name };
    }
    targets.push(record);
    return record;
  }
  definitions.forEach((parent, index) => {
    const record = ensure(parent.name, parent.slug, 1, null, parent.supportedItemTypes, index + 1);
    parent.subcategories.forEach((child, childIndex) => ensure(child.name, child.slug, 2, record._id, parent.supportedItemTypes, childIndex + 1, child.aliases));
  });
  return { inserts, renames, targets };
}

async function run() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const definitions: Definition[] = JSON.parse(await fs.readFile(path.join(__dirname, 'data/vendorApplicationCategories.json'), 'utf8'));
  if (definitions.length !== 7 || definitions.reduce((sum, item) => sum + item.subcategories.length, 0) !== 40) throw new Error('Expected exactly 7 requested categories and 40 subcategories.');
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not configured.');
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
    const existing = await Category.find().lean();
    const plan = createCategorySeedPlan(definitions, existing);
    console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', database: mongoose.connection.name,
      requestedCategories: 7, requestedSubcategories: 40, inserts: plan.inserts.length,
      nameUpdates: plan.renames.map(item => ({ from: item.from, to: item.to })),
      preservedOtherRecords: existing.filter(item => !plan.targets.some(target => String(target._id) === String(item._id))).length }, null, 2));
    if (!apply) return;
    const outputDir = path.resolve(__dirname, '../../../outputs/category-seed');
    await fs.mkdir(outputDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backup = path.join(outputDir, `categories-before-${stamp}.json`);
    await fs.writeFile(backup, JSON.stringify(existing, null, 2));
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        if (plan.inserts.length) await Category.insertMany(plan.inserts, { session });
        for (const rename of plan.renames) {
          const result = await Category.updateOne({ _id: rename.id, name: rename.from }, { $set: { name: rename.to } }, { session, runValidators: true });
          if (result.matchedCount !== 1) throw new Error('A category changed during seeding. The transaction was cancelled.');
        }
      });
    } finally { await session.endSession(); }
    const saved = await Category.find().lean();
    for (const target of plan.targets) {
      const record = saved.find(item => String(item._id) === String(target._id));
      if (!record || record.name !== target.name || record.level !== target.level || String(record.parentId || '') !== String(target.parentId || '')) throw new Error(`Verification failed for ${target.name}.`);
    }
    for (const record of existing) {
      const current = saved.find(item => String(item._id) === String(record._id));
      if (!current || current.slug !== record.slug || String(current.parentId || '') !== String(record.parentId || '')) throw new Error(`Existing category identity changed: ${record.name}.`);
    }
    const repeat = createCategorySeedPlan(definitions, saved);
    if (repeat.inserts.length || repeat.renames.length) throw new Error('Seed verification found repeat changes.');
    const summary = { verified: true, requestedCategories: 7, requestedSubcategories: 40,
      totalCategories: saved.filter(item => item.level === 1).length, totalSubcategories: saved.filter(item => item.level === 2).length,
      totalChildCategories: saved.filter(item => item.level === 3).length, inserted: plan.inserts.length, renamed: plan.renames.length,
      repeatRunChanges: 0, backup };
    await fs.writeFile(path.join(outputDir, 'latest-result.json'), JSON.stringify(summary, null, 2));
    console.log(JSON.stringify(summary, null, 2));
  } finally { await mongoose.disconnect(); }
}

if (require.main === module) run().catch(error => { console.error(error instanceof Error ? error.message : 'Category seed failed.'); process.exitCode = 1; });
