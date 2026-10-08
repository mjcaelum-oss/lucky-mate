import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
test('PostgreSQL generation, constraints, historical sharing and access control', async () => {
  const db = new PGlite();
  try {
    await db.exec('create role anon; create role authenticated; create role service_role;');
    await db.exec(readFileSync('supabase/migrations/001_initial.sql', 'utf8'));
    await db.exec(readFileSync('supabase/seed.sql', 'utf8'));
    await db.exec(readFileSync('supabase/qa.sql', 'utf8'));
    const results = await Promise.all(
      Array.from({ length: 12 }, () =>
        db.query<{
          result: { id: string; content_id: string; lucky_number: number; lucky_color: string };
        }>("select public.get_fortune('FC004','LOVE') as result"),
      ),
    );
    assert.equal(new Set(results.map((r) => r.rows[0].result.id)).size, 1);
    const count = await db.query<{ n: number }>(
      "select count(*)::integer n from public.daily_results where keyring_id='FC004' and category='LOVE'",
    );
    assert.equal(count.rows[0].n, 1);
    for (const category of ['MONEY', 'WORK', 'LUCK'])
      await db.query('select public.get_fortune($1,$2)', ['FC004', category]);
    const four = await db.query<{ n: number }>(
      "select count(*)::integer n from public.daily_results where keyring_id='FC004'",
    );
    assert.equal(four.rows[0].n, 4);
    await db.exec("update public.fortune_contents set is_active=false where category='MONEY';");
    await assert.rejects(
      () => db.query("select public.get_fortune('FC005','MONEY')"),
      /NO_ACTIVE_CONTENT/,
    );
    await db.query("select public.get_fortune('FC004','MONEY')"); // Existing inactive content still resolves.
    await db.exec(
      "insert into public.share_links(daily_result_id) select id from public.daily_results where keyring_id='FC004' and category='LOVE'; update public.daily_results set fortune_date=fortune_date-5 where keyring_id='FC004' and category='LOVE';",
    );
    const historical = await db.query<{ age: number }>(
      "select ((clock_timestamp() at time zone 'Asia/Seoul')::date-r.fortune_date)::integer age from public.share_links s join public.daily_results r on s.daily_result_id=r.id",
    );
    assert.equal(historical.rows[0].age, 5);
    await db.exec('set role anon');
    await assert.rejects(() => db.query('select * from public.daily_results'), /permission denied/);
    await assert.rejects(
      () => db.query("select public.get_fortune('FC004','LOVE')"),
      /permission denied/,
    );
    await db.exec('reset role');
  } finally {
    await db.close();
  }
});
