import assert from 'node:assert/strict';
import { test } from 'node:test';
import { arrangeDeliveryStops, distanceKm, mapPoint } from '../services/routePlanningService';

test('route planning validates points and arranges GPS stops from the store without increasing the known distance', () => {
  assert.deepEqual(mapPoint({ coordinates: [78.5, 17.4] }), { latitude: 17.4, longitude: 78.5 });
  assert.equal(mapPoint({ latitude: '', longitude: '' }), null);
  assert.equal(mapPoint({ latitude: 91, longitude: 0 }), null);
  const origin = { latitude: 17.4, longitude: 78.5 };
  const stops = [
    { id: 'far', address: 'Far street', point: { latitude: 17.5, longitude: 78.5 } },
    { id: 'near', address: 'Near street', point: { latitude: 17.41, longitude: 78.5 } },
    { id: 'middle', address: 'Middle street', point: { latitude: 17.45, longitude: 78.5 } },
  ];
  const result = arrangeDeliveryStops(origin, stops);
  assert.deepEqual(result.subscriptionIds, ['near', 'middle', 'far']);
  assert.equal(result.method, 'gps'); assert.ok(result.estimatedKm! > 0);
  const before = distanceKm(origin, stops[0].point) + distanceKm(stops[0].point, stops[1].point) + distanceKm(stops[1].point, stops[2].point);
  assert.ok(result.estimatedKm! <= before + 0.01);
});

test('missing GPS stops remain present, do not produce invented distances, and fall back to delivery-area grouping', () => {
  const mixed = arrangeDeliveryStops(null, [{ id: 'one', address: 'Road 1, North', point: { latitude: 17.4, longitude: 78.5 } }, { id: 'two', address: 'Road 2, South' }]);
  assert.deepEqual(new Set(mixed.subscriptionIds), new Set(['one', 'two']));
  assert.equal(mixed.estimatedKm, null); assert.deepEqual(mixed.missingCoordinates, ['two']);
  const areas = arrangeDeliveryStops(null, [{ id: 'b', address: 'House 1, West' }, { id: 'a', address: 'House 3, East' }]);
  assert.equal(areas.method, 'area'); assert.deepEqual(areas.subscriptionIds, ['a', 'b']);
  assert.throws(() => arrangeDeliveryStops(null, []));
  assert.throws(() => arrangeDeliveryStops(null, [{ id: 'same', address: '' }, { id: 'same', address: '' }]));
});
