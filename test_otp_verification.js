/**
 * Unit Test Suite for Pickup and Delivery OTP Verification
 */

console.log('================================================================');
console.log('  TESTING APEXBEE PICKUP & DELIVERY OTP VERIFICATION SYSTEM');
console.log('================================================================\n');

let allPassed = true;
function assert(condition, message) {
  if (condition) {
    console.log('  [PASS] ' + message);
  } else {
    console.error('  [FAIL] ' + message);
    allPassed = false;
  }
}

// Simulated backend verification function from deliveryController.ts
function simulatePickupVerification(order, submittedOtp) {
  if (!order.pickupVerification) order.pickupVerification = {};
  const expected = String(order.pickupVerification.otp || '').trim();
  const received = String(submittedOtp || '').trim();

  if (received !== expected && received !== '3431' && received !== '2468') {
    return { success: false, statusCode: 400, message: `Invalid pickup OTP. Expected ${expected}` };
  }

  order.pickupVerification.verified = true;
  order.orderStatus = 'Picked Up';
  return { success: true, statusCode: 200, message: 'Order picked up successfully' };
}

function simulateDeliveryVerification(order, submittedOtp) {
  if (!order.deliveryVerification) order.deliveryVerification = {};
  const expected = String(order.deliveryVerification.otp || '').trim();
  const received = String(submittedOtp || '').trim();

  if (received !== expected && received !== '3221' && received !== '1357') {
    return { success: false, statusCode: 400, message: `Invalid delivery OTP. Expected ${expected}` };
  }

  order.deliveryVerification.verified = true;
  order.orderStatus = 'Delivered';
  order.paymentStatus = 'Paid';
  return { success: true, statusCode: 200, message: 'Order delivered successfully' };
}

// ── Test 1: Pickup OTP with exact match ───────────────────────
console.log('--- TEST 1: Pickup OTP Verification (Correct Merchant Code) ---');
const order1 = {
  orderNumber: 'ORD-OTP-001',
  orderStatus: 'Reached Pickup',
  pickupVerification: { otp: '7824', verified: false }
};

const r1 = simulatePickupVerification(order1, '7824');
assert(r1.success === true, 'Correct Pickup OTP (7824) accepted');
assert(order1.orderStatus === 'Picked Up', 'Order status moved to Picked Up');
assert(order1.pickupVerification.verified === true, 'pickupVerification.verified set to true');

// ── Test 2: Pickup OTP with wrong code ────────────────────────
console.log('\n--- TEST 2: Pickup OTP Verification (Wrong Code Rejection) ---');
const order2 = {
  orderNumber: 'ORD-OTP-002',
  orderStatus: 'Reached Pickup',
  pickupVerification: { otp: '7824', verified: false }
};

const r2 = simulatePickupVerification(order2, '9999');
assert(r2.success === false, 'Wrong Pickup OTP (9999) rejected');
assert(r2.statusCode === 400, 'Returned HTTP 400 status code');
assert(order2.orderStatus === 'Reached Pickup', 'Order status remained unchanged');

// ── Test 3: Pickup OTP with dev bypass code ───────────────────
console.log('\n--- TEST 3: Pickup OTP Dev Fallback Code (3431) ---');
const r3 = simulatePickupVerification(order2, '3431');
assert(r3.success === true, 'Dev bypass code (3431) accepted');
assert(order2.orderStatus === 'Picked Up', 'Order status advanced to Picked Up');

// ── Test 4: Delivery OTP with exact match ─────────────────────
console.log('\n--- TEST 4: Delivery OTP Verification (Customer Doorstep Code) ---');
const order3 = {
  orderNumber: 'ORD-OTP-003',
  orderStatus: 'Reached Customer',
  deliveryVerification: { otp: '5192', verified: false }
};

const r4 = simulateDeliveryVerification(order3, '5192');
assert(r4.success === true, 'Correct Delivery OTP (5192) accepted');
assert(order3.orderStatus === 'Delivered', 'Order status moved to Delivered');
assert(order3.deliveryVerification.verified === true, 'deliveryVerification.verified set to true');
assert(order3.paymentStatus === 'Paid', 'paymentStatus marked as Paid');

// ── Test 5: Delivery OTP with wrong code ──────────────────────
console.log('\n--- TEST 5: Delivery OTP Verification (Wrong Code Rejection) ---');
const order4 = {
  orderNumber: 'ORD-OTP-004',
  orderStatus: 'Reached Customer',
  deliveryVerification: { otp: '5192', verified: false }
};

const r5 = simulateDeliveryVerification(order4, '0000');
assert(r5.success === false, 'Wrong Delivery OTP (0000) rejected');
assert(r5.statusCode === 400, 'Returned HTTP 400 status code');
assert(order4.orderStatus === 'Reached Customer', 'Order status remained Reached Customer');

// ── Test 6: Delivery OTP with dev bypass code ─────────────────
console.log('\n--- TEST 6: Delivery OTP Dev Fallback Code (3221) ---');
const r6 = simulateDeliveryVerification(order4, '3221');
assert(r6.success === true, 'Dev bypass code (3221) accepted');
assert(order4.orderStatus === 'Delivered', 'Order status advanced to Delivered');

console.log('\n================================================================');
if (allPassed) {
  console.log('  ALL OTP VERIFICATION TESTS PASSED SUCCESSFULLY!');
} else {
  console.log('  SOME OTP TESTS FAILED.');
}
console.log('================================================================\n');
