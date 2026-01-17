/**
 * Token Top-Up API Tests
 *
 * @see docs/IMPLEMENTATION.md - Phase 5.2
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { NextRequest } from "next/server";

// Set up environment BEFORE mocks
beforeAll(() => {
  process.env.STRIPE_SECRET_KEY = "sk_test_xxx";
  process.env.STRIPE_PRICE_TOPUP_10K = "price_10k";
  process.env.STRIPE_PRICE_TOPUP_50K = "price_50k";
  process.env.STRIPE_PRICE_TOPUP_100K = "price_100k";
});

// Mock auth
vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

// Mock prisma
vi.mock("@/lib/db", () => ({
  prisma: {
    membership: { findFirst: vi.fn() },
    org: { findUnique: vi.fn(), update: vi.fn() },
  },
}));

// Mock Stripe - return a class that creates checkout sessions
vi.mock("stripe", () => ({
  default: class MockStripe {
    checkout = {
      sessions: {
        create: vi.fn().mockResolvedValue({
          id: "cs_123",
          url: "https://checkout.stripe.com/xxx",
        }),
      },
    };
    customers = {
      create: vi.fn().mockResolvedValue({ id: "cus_new" }),
    };
  },
}));

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { POST } from "../route";
import type { Mock } from "vitest";

const mockAuth = auth as Mock;
const mockFindFirst = prisma.membership.findFirst as Mock;
const mockOrgFindUnique = prisma.org.findUnique as Mock;

function createRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost/api/billing/topup", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/billing/topup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({
      user: { id: "user-1", email: "user@example.com" },
    });
    mockFindFirst.mockResolvedValue({
      userId: "user-1",
      orgId: "org-123",
      role: "OWNER",
    });
    mockOrgFindUnique.mockResolvedValue({
      id: "org-123",
      name: "Acme Corp",
      stripeCustomerId: "cus_123",
    });
  });

  describe("authentication", () => {
    it("returns 401 for unauthenticated users", async () => {
      mockAuth.mockResolvedValue(null);

      const response = await POST(
        createRequest({ packId: "10k", orgId: "org-123" }),
      );

      expect(response.status).toBe(401);
    });
  });

  describe("validation", () => {
    it("returns 400 for missing packId", async () => {
      const response = await POST(createRequest({ orgId: "org-123" }));

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toMatch(/invalid packId/i);
    });

    it("returns 400 for invalid packId", async () => {
      const response = await POST(
        createRequest({ packId: "invalid", orgId: "org-123" }),
      );

      expect(response.status).toBe(400);
    });

    it("returns 400 for missing orgId", async () => {
      const response = await POST(createRequest({ packId: "10k" }));

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toMatch(/orgId is required/i);
    });
  });

  describe("authorization", () => {
    it("returns 403 for non-admin members", async () => {
      mockFindFirst.mockResolvedValue(null);

      const response = await POST(
        createRequest({ packId: "10k", orgId: "org-123" }),
      );

      expect(response.status).toBe(403);
    });
  });

  describe("successful top-up", () => {
    it("creates checkout session and returns 200", async () => {
      const response = await POST(
        createRequest({ packId: "10k", orgId: "org-123" }),
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toHaveProperty("sessionId");
      expect(data).toHaveProperty("url");
      expect(data.tokens).toBe(10000);
    });

    it("returns correct token count for 50k pack", async () => {
      const response = await POST(
        createRequest({ packId: "50k", orgId: "org-123" }),
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.tokens).toBe(50000);
    });
  });
});
