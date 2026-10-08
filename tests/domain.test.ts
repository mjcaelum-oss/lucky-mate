import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  categories,
  colors,
  kstDate,
  previousDate,
  validCategory,
  validKeyring,
} from '../lib/domain';
import { contents } from '../lib/content';
test('KST midnight boundary uses Korea date', () => {
  assert.equal(kstDate(new Date('2026-10-07T14:59:59Z')), '2026-10-07');
  assert.equal(kstDate(new Date('2026-10-07T15:00:00Z')), '2026-10-08');
  assert.equal(previousDate('2026-01-01'), '2025-12-31');
});
test('only issued keyring IDs are accepted', () => {
  for (let i = 1; i <= 100; i++)
    assert.equal(validKeyring('FC' + String(i).padStart(3, '0')), true);
  for (const id of ['FC000', 'FC101', 'FC999', 'fc001', 'FC01', null, "FC001' OR true"])
    assert.equal(validKeyring(id), false);
});
test('draft content has 30 unique sets per category and valid values', () => {
  assert.equal(contents.length, 120);
  assert.equal(new Set(contents.map((c) => c.id)).size, 120);
  for (const category of categories) {
    const group = contents.filter((c) => c.category === category);
    assert.equal(group.length, 30);
    assert.equal(new Set(group.map((c) => c.message)).size, 30);
  }
  for (const c of contents) {
    assert.ok(c.score >= 0 && c.score <= 100);
    assert.ok(c.message && c.mission);
  }
  assert.equal(colors.length, 12);
  assert.equal(validCategory('LOVE'), true);
  assert.equal(validCategory('love'), false);
});
