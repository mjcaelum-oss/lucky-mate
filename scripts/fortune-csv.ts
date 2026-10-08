import { parse } from 'csv-parse/sync';
import { categories, validCategory, type Content } from '../lib/domain';

export function parseFortuneCsv(csv: string): Content[] {
  const rows: Record<string, string>[] = parse(csv, {
    bom: true,
    trim: true,
    skip_empty_lines: true,
    columns: (header: string[]) => {
      if (header.join(',') !== 'id,category,message,mission,score,is_active')
        throw new Error('CSV 헤더는 id,category,message,mission,score,is_active 순서여야 합니다.');
      return header;
    },
  });
  const ids = new Set<string>();
  const contents = rows.map((row, index): Content => {
    const at = `CSV ${index + 1}번째 데이터`;
    const id = row.id.trim(),
      category = row.category.trim();
    if (!validCategory(category))
      throw new Error(`${at}: category는 MONEY, LOVE, WORK, LUCK만 가능합니다.`);
    if (!new RegExp(`^${category}_[0-9]{2,}$`).test(id))
      throw new Error(`${at}: id는 항목 코드와 숫자 조합이어야 합니다. 예: ${category}_01`);
    if (ids.has(id)) throw new Error(`${at}: 중복 id ${id}`);
    ids.add(id);
    const message = row.message.trim(),
      mission = row.mission.trim();
    if (!message || !mission) throw new Error(`${at}: message와 mission은 비울 수 없습니다.`);
    if (!/^(100|[1-9]?[0-9])$/.test(row.score.trim()))
      throw new Error(`${at}: score는 0~100 정수여야 합니다.`);
    const active = row.is_active.trim().toLowerCase();
    if (!['true', 'false'].includes(active))
      throw new Error(`${at}: is_active는 true 또는 false여야 합니다.`);
    return {
      id,
      category,
      message,
      mission,
      score: Number(row.score),
      is_active: active === 'true',
    };
  });
  for (const category of categories) {
    if (contents.filter((c) => c.category === category && c.is_active).length < 2)
      throw new Error(`${category}: 전날 콘텐츠 제외를 위해 활성 콘텐츠를 최소 2개 유지하세요.`);
  }
  return contents;
}

export function buildSeedSql(contents: Content[]): string {
  const quote = (s: string) => `'${s.replaceAll("'", "''")}'`;
  return `-- Generated from supabase/seed/fortune_contents.csv.\ninsert into public.fortune_contents(id,category,message,mission,score,is_active) values\n${contents.map((c) => `(${[c.id, c.category, c.message, c.mission].map(quote).join(',')},${c.score},${c.is_active})`).join(',\n')}\non conflict(id) do update set message=excluded.message,mission=excluded.mission,score=excluded.score,is_active=excluded.is_active;\n`;
}

export async function syncContents(contents: Content[], url: string, key: string) {
  const endpoint = new URL('/rest/v1/fortune_contents?on_conflict=id', url);
  if (
    endpoint.protocol !== 'https:' &&
    endpoint.hostname !== 'localhost' &&
    endpoint.hostname !== '127.0.0.1'
  )
    throw new Error('SUPABASE_URL은 HTTPS 주소여야 합니다.');
  const headers = {
    apikey: key,
    ...(!key.startsWith('sb_secret_') && { Authorization: `Bearer ${key}` }),
    'Content-Type': 'application/json',
  };
  const existing = await fetch(new URL('/rest/v1/fortune_contents?select=id,category', url), {
    headers,
    signal: AbortSignal.timeout(30000),
  });
  if (!existing.ok)
    throw new Error(`기존 콘텐츠 확인 실패 (HTTP ${existing.status}). DB는 변경하지 않았습니다.`);
  const current: Pick<Content, 'id' | 'category'>[] = await existing.json();
  const byId = new Map(current.map((c) => [c.id, c.category]));
  for (const row of contents) {
    if (byId.has(row.id) && byId.get(row.id) !== row.category)
      throw new Error(`${row.id}: 기존 콘텐츠의 category는 변경할 수 없습니다.`);
  }
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(contents),
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok)
    throw new Error(`콘텐츠 반영 실패 (HTTP ${response.status}). 확인 후 다시 실행하세요.`);
  const saved: Content[] = await response.json();
  if (saved.length !== contents.length)
    throw new Error('DB 응답 개수가 CSV와 다릅니다. 반영 상태를 확인하세요.');
  return saved;
}
