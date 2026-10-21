// PT-TR-64: rafagas de 60 pedidos simultaneos de ticket de chat (todos los usuarios entrando a la vez).
import http from "k6/http";
import { check, sleep } from "k6";

const fixtures = JSON.parse(open("../stack/fixtures.local.json"));
const BASE_URL = __ENV.BASE_URL || "https://host.docker.internal:8443";
const ROUNDS = 5;

const members = fixtures.load.chatSalas.flatMap((sala) =>
  sala.members.map((id) => ({ sala: sala.id, user: fixtures.load.users.find((u) => u.id === id) }))
);

const thresholds = { "http_req_failed{endpoint:chat-ticket}": ["rate<0.01"] };
for (let round = 0; round < ROUNDS; round++) {
  thresholds[`http_req_duration{endpoint:chat-ticket,round:${round}}`] = ["p(95)<200"];
}

export const options = {
  insecureSkipTLSVerify: true,
  summaryTrendStats: ["avg", "min", "med", "p(90)", "p(95)", "p(99)", "max"],
  scenarios: {
    burst: { executor: "per-vu-iterations", vus: members.length, iterations: ROUNDS, maxDuration: "1m" },
  },
  thresholds,
};

export default function () {
  const { sala, user } = members[__VU - 1];
  const res = http.post(`${BASE_URL}/salas/${sala}/chat-ticket`, null, {
    headers: { Cookie: `lum_session=${user.token}` },
    tags: { endpoint: "chat-ticket", round: String(__ITER) },
  });
  check(res, { "ticket 200": (r) => r.status === 200 });
  // Realinea a las VUs al comienzo del proximo segundo par para que cada ronda sea una rafaga.
  sleep(2 - ((Date.now() / 1000) % 2));
}
