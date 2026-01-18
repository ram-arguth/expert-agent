import { NextResponse } from "next/server";
import { cedar } from "@/lib/authz/cedar";

/**
 * Health check endpoint for Cloud Run and load balancer probes.
 * Uses Anonymous principal for Cedar authorization.
 */
export async function GET() {
  // Authorize with Anonymous principal
  const decision = cedar.isAuthorized({
    principal: { type: "Anonymous", id: "health-check" },
    action: { type: "Action", id: "HealthCheck" },
    resource: { type: "Agent", id: "system" },
  });

  if (!decision.isAuthorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const health = {
    status: "ok",
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "0.1.0",
    environment: process.env.NEXT_PUBLIC_ENV || "development",
  };

  return NextResponse.json(health, { status: 200 });
}
