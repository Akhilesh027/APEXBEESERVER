import assert from 'assert';

export async function testProfileIsolation(tokens: Record<string, string>, host: string, userIds: Record<string, string>) {
  console.log(' - Running Profile Isolation Tests...');

  // User IDs from db seeds
  const vendorAId = userIds.vendorA;
  const vendorBId = userIds.vendorB;

  // 1. Vendor B reads Vendor A's profile -> expects 404
  const resRead = await fetch(`${host}/api/vendor/profile/${vendorAId}`, {
    headers: { 'Authorization': `Bearer ${tokens.vendorB}` }
  });
  assert.strictEqual(resRead.status, 404, "Vendor B should get 404 when reading Vendor A's profile");

  // 2. Vendor B updates Vendor A's profile -> expects 404
  const resUpdate = await fetch(`${host}/api/vendor/profile/${vendorAId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${tokens.vendorB}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ businessName: 'Hacked Business' })
  });
  assert.strictEqual(resUpdate.status, 404, "Vendor B should get 404 when updating Vendor A's profile");

  // 3. Customer updates Vendor A's profile -> expects 404
  const resCust = await fetch(`${host}/api/vendor/profile/${vendorAId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${tokens.customer}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ businessName: 'Hacked Business' })
  });
  assert.strictEqual(resCust.status, 404, "Customer should get 404 when updating Vendor A's profile");

  // 4. Customer requests vendor document (KYC route) -> expects 403 (requires admin role)
  const resReqDoc = await fetch(`${host}/api/vendor/profile/${vendorAId}/request-document`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${tokens.customer}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ name: 'GST Certificate' })
  });
  if (resReqDoc.status !== 403) {
    console.error('Request doc status:', resReqDoc.status, await resReqDoc.clone().text());
  }
  assert.strictEqual(resReqDoc.status, 403, "Non-admin requesting document should get 403 Forbidden");

  console.log('   - Profile Isolation Tests: PASS');
}
