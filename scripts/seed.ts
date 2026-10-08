import { writeFileSync, mkdirSync } from 'node:fs';
import { contents } from '../lib/content';
mkdirSync('supabase/seed', { recursive: true });
const quote = (s: unknown) => `"${String(s).replaceAll('"', '""')}"`;
writeFileSync(
  'supabase/seed/fortune_contents.csv',
  [
    'id,category,message,mission,score,is_active',
    ...contents.map((c) =>
      [c.id, c.category, c.message, c.mission, c.score, c.is_active].map(quote).join(','),
    ),
  ].join('\n'),
  'utf8',
);
const sqlQuote = (s: string) => `'${s.replaceAll("'", "''")}'`;
writeFileSync(
  'supabase/seed.sql',
  `-- Draft copy. Review before production.\ninsert into public.fortune_contents(id,category,message,mission,score,is_active) values\n${contents.map((c) => `(${[c.id, c.category, c.message, c.mission].map(sqlQuote).join(',')},${c.score},true)`).join(',\n')}\non conflict(id) do update set message=excluded.message,mission=excluded.mission,score=excluded.score;\n`,
);
console.log(`Generated ${contents.length} content sets.`);
