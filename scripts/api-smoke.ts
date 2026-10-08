import assert from 'node:assert/strict';
const origin = process.env.SMOKE_ORIGIN || 'http://localhost:3000';
async function call(action: string, body: object, status = 200) {
  const res = await fetch(`${origin}/api/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin },
    body: JSON.stringify(body),
  });
  assert.equal(res.status, status, `${action} HTTP status`);
  return res.json();
}
async function main() {
  const entry = await call('entry', { keyring_id: 'FC098', nfc: true });
  assert.equal(entry.demo, process.env.SMOKE_EXPECT_DEMO !== 'false', 'Unexpected database mode.');
  const all = await Promise.all(
    Array.from({ length: 12 }, () => call('fortune', { keyring_id: 'FC098', category: 'LOVE' })),
  );
  assert.equal(new Set(all.map((r) => r.id)).size, 1);
  for (const r of all) assert.deepEqual(r, all[0]);
  assert.equal(all[0].fortune_date, entry.date);
  for (const category of ['MONEY', 'WORK', 'LUCK']) {
    const r = await call('fortune', { keyring_id: 'FC098', category });
    assert.ok(r.lucky_number >= 1 && r.lucky_number <= 10);
  }
  const a = await call('share', { result_id: all[0].id }),
    b = await call('share', { result_id: all[0].id });
  assert.equal(a.token, b.token);
  assert.deepEqual(await call('shared', { token: a.token }), all[0]);
  await call('fortune', { keyring_id: 'FC999', category: 'LOVE' }, 404);
  await call('fortune', { keyring_id: 'FC098', category: 'UNKNOWN' }, 400);
  await call('shared', { token: 'not-a-token' }, 404);
  await call('events', {
    event_type: 'FORTUNE_VIEW',
    keyring_id: 'FC098',
    category: 'LOVE',
    daily_result_id: all[0].id,
  });
  await call('events', { event_type: 'NFC_ENTRY', keyring_id: 'FC098' }, 400);
  console.log(
    'API smoke passed: 12 concurrent requests, 4 categories, fixed results, reusable share link, invalid input and view event.',
  );
}
void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
