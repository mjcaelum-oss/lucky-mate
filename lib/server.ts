import 'server-only';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs';
import { contents } from './content';
import { AppError, colors, kstDate, previousDate, type Category, type Fortune } from './domain';
type Event = {
  event_type: string;
  keyring_id?: string | null;
  category?: Category | null;
  daily_result_id?: string | null;
  share_token?: string | null;
  error_type?: string | null;
};
type Store = { results: Fortune[]; shares: Record<string, string>; events: Event[] };
export const demo = process.env.LOCAL_DEMO_MODE === 'true' && !process.env.VERCEL;
const file = '.local/store.json';
function load(): Store {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return { results: [], shares: {}, events: [] };
  }
}
function save(store: Store) {
  mkdirSync('.local', { recursive: true });
  writeFileSync(file + '.tmp', JSON.stringify(store));
  renameSync(file + '.tmp', file);
}
async function db(path: string, init: RequestInit = {}) {
  const url = process.env.SUPABASE_URL,
    key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new AppError('NOT_CONFIGURED', 503);
  const res = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    cache: 'no-store',
    headers: {
      apikey: key,
      ...(!key.startsWith('sb_secret_') && { Authorization: `Bearer ${key}` }),
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...init.headers,
    },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    if (body.message?.includes('INVALID_KEYRING')) throw new AppError('INVALID_KEYRING', 404);
    throw new AppError('DATABASE_ERROR', 503);
  }
  return res.status === 204 ? null : res.json();
}
export async function entry(id: string) {
  if (!demo) {
    const rows = await db(`keyrings?id=eq.${id}&is_active=eq.true&select=id`);
    if (!rows.length) throw new AppError('INVALID_KEYRING', 404);
  }
  return { date: kstDate(), demo };
}
export async function fortune(id: string, category: Category): Promise<Fortune> {
  if (!demo)
    return db('rpc/get_fortune', {
      method: 'POST',
      body: JSON.stringify({ p_keyring: id, p_category: category }),
    });
  const store = load(),
    date = kstDate();
  const existing = store.results.find(
    (r) => r.keyring_id === id && r.category === category && r.fortune_date === date,
  );
  if (existing)
    return { ...existing, content: contents.find((c) => c.id === existing.content_id)! };
  const yesterday = store.results.find(
    (r) => r.keyring_id === id && r.category === category && r.fortune_date === previousDate(date),
  );
  const candidates = contents.filter(
    (c) => c.category === category && c.is_active && c.id !== yesterday?.content_id,
  );
  const content = candidates[Math.floor(Math.random() * candidates.length)];
  if (!content) throw new AppError('NO_ACTIVE_CONTENT', 503);
  const result = {
    id: randomUUID(),
    keyring_id: id,
    fortune_date: date,
    category,
    content_id: content.id,
    lucky_number: 1 + Math.floor(Math.random() * 10),
    lucky_color: colors[Math.floor(Math.random() * colors.length)][0],
    content,
  };
  store.results.push(result);
  save(store);
  return result;
}
export async function log(event: Event) {
  try {
    if (demo) {
      const store = load();
      store.events.push(event);
      save(store);
    } else await db('event_logs', { method: 'POST', body: JSON.stringify(event) });
  } catch {
    console.warn('Analytics event could not be saved:', event.event_type);
  }
}
export async function share(resultId: string): Promise<string> {
  if (demo) {
    const store = load();
    if (!store.results.some((r) => r.id === resultId)) throw new AppError('SHARE_NOT_FOUND', 404);
    const existing = Object.entries(store.shares).find(([, id]) => id === resultId);
    if (existing) return existing[0];
    const token = randomUUID().replaceAll('-', '');
    store.shares[token] = resultId;
    save(store);
    return token;
  }
  const results = await db(`daily_results?id=eq.${resultId}&select=id,keyring_id`);
  if (!results.length) throw new AppError('SHARE_NOT_FOUND', 404);
  await entry(results[0].keyring_id);
  const rows = await db('share_links?on_conflict=daily_result_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
    body: JSON.stringify({ daily_result_id: resultId }),
  });
  if (rows.length) return rows[0].token;
  return (await db(`share_links?daily_result_id=eq.${resultId}&select=token`))[0].token;
}
export async function shared(token: string): Promise<Fortune> {
  if (demo) {
    const store = load();
    const result = store.results.find((r) => r.id === store.shares[token]);
    if (!result) throw new AppError('SHARE_NOT_FOUND', 404);
    return { ...result, content: contents.find((c) => c.id === result.content_id)! };
  }
  const links = await db(`share_links?token=eq.${token}&select=daily_result_id`);
  if (!links.length) throw new AppError('SHARE_NOT_FOUND', 404);
  const rows = await db(
    `daily_results?id=eq.${links[0].daily_result_id}&select=*,content:fortune_contents(*)`,
  );
  if (!rows[0]?.content) throw new AppError('SHARE_NOT_FOUND', 404);
  await entry(rows[0].keyring_id);
  return rows[0];
}
