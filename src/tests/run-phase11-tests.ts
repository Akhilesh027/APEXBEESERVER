import path from 'path';
import fs from 'fs';
import assert from 'assert';

function runPhase11Tests() {
  console.log('Starting Phase 11 k6 Script Suite Verification...');

  const loadTestDir = path.join(__dirname, 'load');
  const files = fs.readdirSync(loadTestDir);

  console.log(`Found ${files.length} load testing scripts in directory.`);

  for (const file of files) {
    if (!file.endsWith('.js')) continue;

    console.log(`\nValidating script: ${file}...`);
    const filePath = path.join(loadTestDir, file);
    const content = fs.readFileSync(filePath, 'utf8');

    // Basic structural checks on k6 JavaScript scripts
    assert.ok(content.includes('export const options'), `Script ${file} must export options configuration`);
    assert.ok(content.includes('thresholds:'), `Script ${file} must define performance targets/thresholds`);
    assert.ok(content.includes('export default function'), `Script ${file} must export a default function scenario`);

    console.log(`Script ${file} structure: VALID`);
  }

  console.log('\n=======================================');
  console.log('ALL PHASE 11 TESTS PASSED SUCCESSFULLY! (100%)');
  console.log('=======================================');
  process.exit(0);
}

runPhase11Tests();
