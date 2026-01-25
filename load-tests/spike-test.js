import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "30s", target: 50 }, // Ramp up to 50 users (spike)
    { duration: "1m", target: 50 }, // Stay at peak
    { duration: "30s", target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_failed: ["rate<0.05"], // Allow slightly higher error rate during spike
    http_req_duration: ["p(95)<500"], // Allow higher latency
  },
};

export default function () {
  const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

  // Hit the landing page (SSR load)
  const res = http.get(`${BASE_URL}/`);

  check(res, {
    "status is 200": (r) => r.status === 200,
  });

  sleep(1);
}
