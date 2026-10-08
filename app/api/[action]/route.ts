import { NextResponse } from 'next/server';
import { AppError, eventTypes, validCategory, validKeyring } from '@/lib/domain';
import { entry, fortune, log, share, shared } from '@/lib/server';
export const runtime = 'nodejs';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function POST(request: Request, { params }: { params: Promise<{ action: string }> }) {
  try {
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) throw new AppError('INVALID_ORIGIN', 403);
    if (Number(request.headers.get('content-length') || 0) > 2048)
      throw new AppError('INVALID_INPUT', 413);
    const body = await request.text();
    if (body.length > 2048) throw new AppError('INVALID_INPUT', 413);
    let b;
    try {
      b = JSON.parse(body);
    } catch {
      throw new AppError('INVALID_INPUT');
    }
    if (!b || typeof b !== 'object' || Array.isArray(b)) throw new AppError('INVALID_INPUT');
    const { action } = await params;
    if (action === 'shared') {
      if (typeof b.token !== 'string' || !/^[0-9a-f]{32}$/.test(b.token))
        throw new AppError('SHARE_NOT_FOUND', 404);
      const result = await shared(b.token);
      await log({
        event_type: 'SHARE_VISIT',
        keyring_id: result.keyring_id,
        daily_result_id: result.id,
        share_token: b.token,
      });
      return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
    }
    if (action === 'entry') {
      if (!validKeyring(b.keyring_id)) throw new AppError('INVALID_KEYRING', 404);
      const data = await entry(b.keyring_id);
      await log({
        event_type: b.nfc === true ? 'NFC_ENTRY' : 'DIRECT_ENTRY',
        keyring_id: b.keyring_id,
      });
      return NextResponse.json(data);
    }
    if (action === 'fortune') {
      if (!validKeyring(b.keyring_id)) throw new AppError('INVALID_KEYRING', 404);
      if (!validCategory(b.category)) throw new AppError('INVALID_CATEGORY');
      await entry(b.keyring_id);
      await log({ event_type: 'FORTUNE_SELECT', keyring_id: b.keyring_id, category: b.category });
      return NextResponse.json(await fortune(b.keyring_id, b.category), {
        headers: { 'Cache-Control': 'no-store' },
      });
    }
    if (action === 'share') {
      if (typeof b.result_id !== 'string' || !uuid.test(b.result_id))
        throw new AppError('INVALID_INPUT');
      const token = await share(b.result_id),
        result = await shared(token);
      await log({
        event_type: 'SHARE_CLICK',
        keyring_id: result.keyring_id,
        daily_result_id: result.id,
      });
      return NextResponse.json({ token });
    }
    if (action === 'events') {
      if (
        !eventTypes.includes(b.event_type) ||
        !['FORTUNE_VIEW', 'PURCHASE_CTA_CLICK', 'BACK_TO_HOME'].includes(b.event_type)
      )
        throw new AppError('INVALID_INPUT');
      if (
        !validKeyring(b.keyring_id) ||
        (b.category != null && !validCategory(b.category)) ||
        (b.daily_result_id != null && !uuid.test(b.daily_result_id)) ||
        (b.share_token != null && !/^[0-9a-f]{32}$/.test(b.share_token))
      )
        throw new AppError('INVALID_INPUT');
      await entry(b.keyring_id);
      await log({
        event_type: b.event_type,
        keyring_id: b.keyring_id,
        category: b.category || null,
        daily_result_id: b.daily_result_id || null,
        share_token: b.share_token || null,
      });
      return NextResponse.json({ ok: true });
    }
    throw new AppError('NOT_FOUND', 404);
  } catch (error) {
    const e = error instanceof AppError ? error : new AppError('SYSTEM_ERROR', 503);
    if (e.code === 'INVALID_KEYRING') await log({ event_type: 'INVALID_ID' });
    if (e.status >= 500)
      await log({ event_type: 'SYSTEM_ERROR', error_type: e.code }).catch(() => {});
    return NextResponse.json(
      { error: e.code },
      { status: e.status, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
