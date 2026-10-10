import { NextResponse } from 'next/server';
import { loadMvpPlayers } from '@/lib/mvp-data';

export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    return NextResponse.json(await loadMvpPlayers(), { headers: { 'Cache-Control': 'no-store', 'X-MVP-Season': '2025' } });
  } catch {
    return NextResponse.json({ error: 'MVP_DATA_UNAVAILABLE' }, { status: 503 });
  }
}
