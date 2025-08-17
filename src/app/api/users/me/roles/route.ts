
// src/app/api/users/me/roles/route.ts
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  // This feature has been disabled.
  return NextResponse.json(
    { message: 'This feature is currently disabled.' },
    { status: 404 }
  );
}
