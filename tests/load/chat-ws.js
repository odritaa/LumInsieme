// PT-TR-63: N usuarios conectados al chat por WebSocket (12 salas x 5 miembros), enviando mensajes.
import http from "k6/http";
import ws from "k6/ws";
import { check } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

const fixtures = JSON.parse(open("../stack/fixtures.local.json"));
const BASE_URL = __ENV.BASE_URL || "https://host.docker.internal:8443";
const WS_URL = BASE_URL.replace(/^http/, "ws");
const SESSION_SECONDS = Number(__ENV.SESSION_SECONDS || 45);
const SEND_EVERY_MS = 2000;

const deliveryLatency = new Trend("chat_delivery_latency", true);
const received = new Counter("chat_messages_received");
const sent = new Counter("chat_messages_sent");
const historyOk = new Rate("chat_history_on_connect");
const wsErrors = new Rate("chat_ws_errors");

// Cada VU es un miembro distinto de alguna de las 12 salas sembradas.
const members = fixtures.load.chatSalas.flatMap((sala) =>
  sala.members.map((id) => ({ sala: sala.id, user: fixtures.load.users.find((u) => u.id === id) }))
);

export const options = {
  insecureSkipTLSVerify: true,
  summaryTrendStats: ["avg", "min", "med", "p(90)", "p(95)", "p(99)", "max"],
  scenarios: {
    chat: {
      executor: "per-vu-iterations",
      vus: members.length,
      iterations: 1,
      maxDuration: `${SESSION_SECONDS + 30}s`,
    },
  },
  thresholds: {
    chat_delivery_latency: ["p(95)<200"],
    chat_history_on_connect: ["rate>0.99"],
    chat_ws_errors: ["rate<0.01"],
    "http_req_duration{endpoint:chat-ticket}": ["p(95)<200"],
  },
};

export default function () {
  const { sala, user } = members[__VU - 1];
  const headers = { Cookie: `lum_session=${user.token}` };
  const res = http.post(`${BASE_URL}/salas/${sala}/chat-ticket`, null, { headers, tags: { endpoint: "chat-ticket" } });
  if (!check(res, { "ticket 200": (r) => r.status === 200 })) {
    wsErrors.add(1);
    return;
  }

  const url = `${WS_URL}/ws/chat?ticket=${encodeURIComponent(res.json("ticket"))}`;
  let gotHistory = false;
  const response = ws.connect(url, {}, (socket) => {
    socket.on("open", () => {
      socket.setInterval(() => {
        socket.send(JSON.stringify({ content: `vu${__VU}|${Date.now()}` }));
        sent.add(1);
      }, SEND_EVERY_MS);
      socket.setTimeout(() => socket.close(), SESSION_SECONDS * 1000);
    });

    socket.on("message", (raw) => {
      const frame = JSON.parse(raw);
      if (frame.type === "history") {
        gotHistory = true;
        return;
      }
      received.add(1);
      const [author, sentAt] = String(frame.payload.content).split("|");
      // Latencia de entrega: desde que el emisor envia hasta que el broadcast vuelve al mismo emisor.
      if (author === `vu${__VU}`) deliveryLatency.add(Date.now() - Number(sentAt));
    });

    socket.on("error", () => wsErrors.add(1));
  });

  historyOk.add(gotHistory);
  wsErrors.add(response && response.status === 101 ? 0 : 1);
  check(response, { "ws upgrade 101": (r) => r && r.status === 101 });
}
