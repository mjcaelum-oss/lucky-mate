import { readFileSync, writeFileSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { parseFortuneCsv, buildSeedSql, syncContents } from './fortune-csv';

async function main() {
  const args = process.argv.slice(2);
  if (args.some((arg) => !['--check', '--apply'].includes(arg)) || args.length > 1)
    throw new Error('사용법: npm run content:check 또는 npm run content:sync');
  const contents = parseFortuneCsv(readFileSync('supabase/seed/fortune_contents.csv', 'utf8'));
  console.log(`CSV 검증 완료: ${contents.length}개 콘텐츠.`);
  if (args.includes('--check')) return;
  if (args.includes('--apply')) {
    try {
      loadEnvFile('.env.local');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key)
      throw new Error('.env.local에 SUPABASE_URL과 SUPABASE_SECRET_KEY를 설정하세요.');
    if (!key.startsWith('sb_secret_')) {
      try {
        const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString());
        if (payload.role !== 'service_role') throw new Error();
      } catch {
        throw new Error('공개 키 대신 서버 전용 secret 또는 service_role 키를 사용하세요.');
      }
    }
    console.log(`반영 대상: ${new URL(url).hostname}`);
    await syncContents(contents, url, key);
    console.log(`Supabase 반영 완료: ${contents.length}개. CSV에 없는 기존 행은 유지했습니다.`);
  }
  writeFileSync('supabase/seed.sql', buildSeedSql(contents), 'utf8');
  console.log('supabase/seed.sql 생성 완료. CSV 원본은 변경하지 않았습니다.');
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : '콘텐츠 처리 실패');
  process.exitCode = 1;
});
