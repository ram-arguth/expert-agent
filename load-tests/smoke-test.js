import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  vus: 1, // 1 Virtual User
  duration: "1m", // Run for 1 minute
  thresholds: {
    http_req_failed: ["rate<0.01"], // http errors should be less than 1%
    http_req_duration: ["p(95)<200"], // 95% of requests should be below 200ms
  },
};

export default function () {
  const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

  // 1. Check Health Endpoint
  const healthRes = http.get(`${BASE_URL}/api/health`);
  check(healthRes, {
    "health status is 200": (r) => r.status === 200,
    "health returns ok": (r) => r.json("status") === "ok",
  });

  // 2. Check Landing Page
  const landingRes = http.get(`${BASE_URL}/`);
  check(landingRes, {
    "landing page status is 200": (r) => r.status === 200,
  });

  sleep(1);
}
