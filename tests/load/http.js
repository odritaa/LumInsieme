// PT-TR-60 / PT-TR-61: carga sobre GET /cartelera y GET /salas a traves de nginx (HTTPS). Con VUS=200: PT-TR-62 (estres).
import http from "k6/http";
import { check, sleep } from "k6";

const fixtures = JSON.parse(open("../stack/fixtures.local.json"));
const BASE_URL = __ENV.BASE_URL || "https://host.docker.internal:8443";
const VUS = Number(__ENV.VUS || 50);

export const options = {
  insecureSkipTLSVerify: true,
  summaryTrendStats: ["avg", "min", "med", "p(90)", "p(95)", "p(99)", "max"],
  scenarios: {
    feed: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: VUS },
        { duration: "1m", target: VUS },
        { duration: "15s", target: 0 },
      ],
      gracefulRampDown: "5s",
    },
  },
  thresholds: {
    "http_req_duration{endpoint:cartelera}": ["p(95)<200"],
    "http_req_duration{endpoint:salas}": ["p(95)<200"],
    "http_req_failed{endpoint:cartelera}": ["rate<0.01"],
    "http_req_failed{endpoint:salas}": ["rate<0.01"],
    checks: ["rate>0.99"],
  },
};

export default function () {
  const users = fixtures.load.users;
  const user = users[(__VU - 1) % users.length];
  const headers = { Cookie: `lum_session=${user.token}` };

  const cartelera = http.get(`${BASE_URL}/cartelera`, { tags: { endpoint: "cartelera" } });
  check(cartelera, {
    "cartelera 200": (r) => r.status === 200,
    "cartelera con funciones": (r) => r.json("dates").length > 0,
  });

  const salas = http.get(`${BASE_URL}/salas`, { headers, tags: { endpoint: "salas" } });
  check(salas, {
    "salas 200": (r) => r.status === 200,
    "salas ordenadas por created_at DESC": (r) => {
      const dates = r.json("salas").map((s) => s.createdAt);
      return dates.every((d, i) => i === 0 || dates[i - 1] >= d);
    },
  });

  sleep(1);
}
