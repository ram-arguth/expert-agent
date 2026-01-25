import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "30s", target: 5 },
    { duration: "1m", target: 10 },
    { duration: "30s", target: 0 },
  ],
};

export default function () {
  const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

  // 1. Visit Agent Catalog (Mocked as just agent page for now)
  const catalogRes = http.get(`${BASE_URL}/agents`);

  // Note: Since /agents might redirect or be protected, we check 200 or 401/307 depending on auth state.
  // For this test, we assume public access or we expect a redirect to login.
  check(catalogRes, {
    "catalog access (200 or redirect)": (r) =>
      r.status === 200 || r.status === 307 || r.status === 401,
  });

  // 2. Visit Specific Agent Page (Public Landing)
  const agentRes = http.get(`${BASE_URL}/agents/ux-analyst`);
  check(agentRes, {
    "agent page status is 200": (r) => r.status === 200,
    "content has agent name": (r) => r.body.includes("UX Analyst"),
  });

  sleep(1);
}
