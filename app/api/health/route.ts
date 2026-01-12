import { NextResponse } from 'next/server';

/**
 * Health check endpoint for Cloud Run and load balancer probes.
 * This endpoint does NOT require authentication.
 */
export async function GET() {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '0.1.0',
    environment: process.env.NEXT_PUBLIC_ENV || 'development',
  };

  return NextResponse.json(health, { status: 200 });
}
