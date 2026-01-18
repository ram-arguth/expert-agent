/**
 * Internal Summarization API
 *
 * POST /api/internal/summarize
 * Triggered by Cloud Scheduler to archive old sessions.
 *
 * This endpoint is internal-only (validated by secret header).
 *
 * @see docs/IMPLEMENTATION.md - Phase 3.5
 */

import { NextRequest, NextResponse } from "next/server";
import { summarizeBatch } from "@/lib/memory/summarization-service";

export async function POST(request: NextRequest) {
  try {
    // Read env var inside function for test compatibility
    const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET;

    // Validate internal secret
    const authHeader = request.headers.get("x-internal-secret");

    if (!INTERNAL_SECRET) {
      console.error("INTERNAL_API_SECRET not configured");
      return NextResponse.json(
        { error: "Internal API not configured" },
        { status: 500 },
      );
    }

    if (authHeader !== INTERNAL_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Cedar authorization with Service principal
    const { cedar } = await import("@/lib/authz/cedar");
    const decision = cedar.isAuthorized({
      principal: { type: "Service", id: "cloud-scheduler" },
      action: { type: "Action", id: "TriggerSummarization" },
      resource: { type: "Agent", id: "system" },
    });

    if (!decision.isAuthorized) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Parse optional limit parameter
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? Math.min(parseInt(limitParam, 10), 100) : 50;

    // Run summarization batch
    const result = await summarizeBatch(limit);

    console.log(
      `Summarization complete: ${result.succeeded}/${result.processed} succeeded`,
    );

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Summarization error:", error);
    return NextResponse.json(
      { error: "Summarization failed" },
      { status: 500 },
    );
  }
}

// Health check for Cloud Scheduler
export async function GET() {
  return NextResponse.json({
    status: "ok",
    endpoint: "/api/internal/summarize",
    description: "Memory summarization endpoint for archiving old sessions",
  });
}
