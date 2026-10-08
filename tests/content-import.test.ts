import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { parseFortuneCsv, buildSeedSql, syncContents } from '../scripts/fortune-csv';
import { contents as drafts } from '../lib/content';

// Keep parser checks independent of administrator edits to the managed CSV.
const csv = [
  'id,category,message,mission,score,is_active',
  ...drafts.map((c) =>
    [c.id, c.category, c.message, c.mission, c.score, c.is_active]
      .map((value) => `"${String(value).replaceAll('"', '""')}"`)
      .join(','),
  ),
].join('\n');

test('managed CSV has an Excel UTF-8 BOM and valid UTF-8 bytes', () => {
  const bytes = readFileSync('supabase/seed/fortune_contents.csv');
  assert.equal(bytes.subarray(0, 3).toString('hex'), 'efbbbf');
  assert.doesNotThrow(() => new TextDecoder('utf-8', { fatal: true }).decode(bytes));
});

test('CSV handles Excel BOM, punctuation and newlines, and rejects invalid catalogs', () => {
  const contents = parseFortuneCsv(
    '\ufeff' + csv.replace(/^\ufeff/, '').replace('"70","true"', '"70","TRUE"'),
  );
  assert.equal(contents.length, 120);
  assert.equal(contents[0].is_active, true);
  const quoted = csv
    .replace('"MONEY_01","MONEY",', '"MONEY_01","MONEY",')
    .replace(
      '"작은 선택이 든든한 내일을 만들어요. 오늘은 작은 시작에 마음을 기울여보세요. 나만의 속도로 움직여도 괜찮아요."',
      '"쉼표, 큰따옴표 ""인용""\n다음 줄"',
    );
  assert.equal(parseFortuneCsv(quoted)[0].message, '쉼표, 큰따옴표 "인용"\n다음 줄');
  for (const invalid of [
    csv.replace('id,category', 'wrong,category'),
    csv.replace('"70","true"', '"101","true"'),
    csv.replace('"70","true"', '"","true"'),
    csv.replace('"70","true"', '"70","maybe"'),
    csv.replace('"MONEY_02"', '"MONEY_01"'),
    csv.replace('"MONEY_01","MONEY"', '"MONEY_01","LOVE"'),
    csv.replaceAll('"true"', '"false"'),
    csv.replaceAll('"true"', '"true","extra"'),
    'id,category,message,mission,score,is_active\n',
  ])
    assert.throws(() => parseFortuneCsv(invalid));
});

test('CSV SQL updates content and active flags without removing results or omitted rows', async () => {
  const db = new PGlite();
  try {
    await db.exec('create role anon; create role authenticated; create role service_role;');
    await db.exec(readFileSync('supabase/migrations/001_initial.sql', 'utf8'));
    const contents = parseFortuneCsv(csv);
    await db.exec(buildSeedSql(contents));
    const before = (
      await db.query<{
        r: { id: string; content_id: string; lucky_number: number; lucky_color: string };
      }>("select public.get_fortune('FC001','LOVE') r")
    ).rows[0].r;
    const selected = contents.find((c) => c.id === before.content_id)!;
    selected.message = "관리자 수정: 쉼표, 작은따옴표 ' 및 줄바꿈\n본문";
    selected.mission = '수정 미션';
    selected.score = 99;
    selected.is_active = false;
    await db.exec(buildSeedSql(contents));
    const after = (
      await db.query<{ r: typeof before & { content: typeof selected } }>(
        "select public.get_fortune('FC001','LOVE') r",
      )
    ).rows[0].r;
    assert.equal(after.id, before.id);
    assert.equal(after.lucky_number, before.lucky_number);
    assert.equal(after.lucky_color, before.lucky_color);
    assert.equal(after.content.message, selected.message);
    assert.equal(after.content.score, 99);
    assert.equal(after.content.is_active, false);
    await db.exec(buildSeedSql([contents[0]]));
    assert.equal(
      (await db.query<{ n: number }>('select count(*)::integer n from public.fortune_contents'))
        .rows[0].n,
      120,
    );
  } finally {
    await db.close();
  }
});

test('Supabase sync uses one bulk upsert, correct credentials and refuses category changes', async (t) => {
  const contents = parseFortuneCsv(csv);
  const calls: { url: string; init?: RequestInit }[] = [];
  t.mock.method(globalThis, 'fetch', async (url: URL, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return Response.json(
      init?.method === 'POST' ? contents : contents.map(({ id, category }) => ({ id, category })),
    );
  });
  assert.equal(
    (await syncContents(contents, 'https://example.supabase.co', 'sb_secret_test')).length,
    120,
  );
  assert.equal(calls.length, 2);
  assert.equal(calls[1].url, 'https://example.supabase.co/rest/v1/fortune_contents?on_conflict=id');
  const headers = new Headers(calls[1].init?.headers);
  assert.equal(headers.get('apikey'), 'sb_secret_test');
  assert.equal(headers.has('Authorization'), false);
  assert.equal(headers.get('Prefer'), 'resolution=merge-duplicates,return=representation');
  assert.deepEqual(JSON.parse(calls[1].init?.body as string), contents);
  calls.length = 0;
  await assert.rejects(
    syncContents(
      [{ ...contents[0], category: 'LOVE' }],
      'https://example.supabase.co',
      'sb_secret_test',
    ),
    /category/,
  );
  assert.equal(calls.length, 1);
  t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 503 }));
  await assert.rejects(
    syncContents(contents, 'https://example.supabase.co', 'sb_secret_test'),
    /HTTP 503/,
  );
});
