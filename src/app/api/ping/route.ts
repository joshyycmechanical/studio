// src/app/api/ping/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  console.log('[API /ping] Received ping request.');
  return NextResponse.json({ message: 'pong', timestamp: new Date().toISOString() });
}
