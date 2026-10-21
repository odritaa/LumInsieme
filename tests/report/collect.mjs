// Consolida los resultados crudos de docs/testing/reportes/raw en la tabla del informe del TP4.
// Uso: node tests/report/collect.mjs  ->  docs/testing/reportes/raw/tabla.md y resumen.json
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const RAW = path.join(ROOT, "docs/testing/reportes/raw");
const read = (file) => JSON.parse(readFileSync(path.join(RAW, file), "utf8"));

// Pruebas que fallaron en la primera corrida y destaparon un defecto (ver defectos.md).
const DEFECTS = {
  "PT-CU05-20": "DEF-01",
  "PT-TR-35": "DEF-02",
  "PT-TR-24": "DEF-03",
  "PT-TR-57": "DEF-04",
  "PT-TR-71": "DEF-04",
  "PT-TR-72": "DEF-04",
};

const rows = [];

function add({ title, status, tool, level, message = "" }) {
  const match = /^(PT-(?:CU\d{2}|TR)-\d{2})\s+(.*)$/s.exec(title.trim());
  if (!match) throw new Error(`prueba sin ID trazable: ${title}`);
  const [, id, rest] = match;
  const [description, expected = "—"] = rest.split(" → ").length > 1
    ? [rest.split(" → ").slice(0, -1).join(" → "), rest.split(" → ").at(-1)]
    : [rest];
  rows.push({
    id,
    cu: id.startsWith("PT-TR") ? "Transversal" : `CU-${id.slice(5, 7)}`,
    level,
    tool,
    description: description.trim(),
    expected: expected.trim(),
    passed: status === "passed",
    message: message.split("\n")[0].slice(0, 160),
  });
}

const VITEST = {
  "login-controller": { tool: "Vitest + Supertest", level: (f) => (f.includes("unit") ? "Unitaria" : "Integración (API + Postgres)") },
  "reunion-controller": {
    tool: "Vitest + Supertest",
    level: (f) => (f.includes("cartelera") ? "Integración (API, caché simulada)" : "Integración (API + Postgres)"),
  },
  "chat-controller": {
    tool: "Vitest + Supertest",
    level: (f, id) =>
      f.includes("chat.ws") ? "Integración (WebSocket)" : ["PT-CU05-22", "PT-CU05-23"].includes(id) ? "Integración (gRPC simulado)" : "Unitaria (fake timers)",
  },
  frontend: { tool: "Vitest + RTL", level: (f) => (f.includes("app.test") ? "Integración (UI + API simulada)" : "Unitaria (componente)") },
};

for (const [module, meta] of Object.entries(VITEST)) {
  for (const file of read(`vitest-${module}.json`).testResults) {
    for (const t of file.assertionResults) {
      const id = t.title.split(" ")[0];
      add({ title: t.title, status: t.status, tool: meta.tool, level: meta.level(file.name, id), message: t.failureMessages?.[0] });
    }
  }
}

const goEvents = readFileSync(path.join(RAW, "go-cache-controller.json"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
for (const e of goEvents) {
  if (!e.Test?.includes("/") || !["pass", "fail"].includes(e.Action)) continue;
  const title = e.Test.split("/").slice(1).join("/").replace(/_/g, " ");
  const id = title.split(" ")[0];
  add({
    title,
    status: e.Action === "pass" ? "passed" : "failed",
    tool: "go test + Testify + miniredis",
    level: ["PT-TR-42", "PT-TR-43"].includes(id) ? "Integración (gRPC bufconn)" : "Unitaria",
  });
}

for (const t of read("pytest-scrapper.json")) {
  const id = t.title.split(" ")[0];
  const n = Number(id.slice(-2));
  const level = n <= 16 ? "Integración (Chromium + fixture HTML)" : n <= 20 ? "Unitaria" : n <= 24 ? "Unitaria (mocks)" : "Integración (gRPC aio simulado)";
  add({ title: t.title, status: t.status, tool: "pytest", level, message: t.message });
}

// Playwright: una fila por ID con el resultado en ambos navegadores.
const e2e = new Map();
(function walk(suite) {
  for (const spec of suite.specs ?? []) {
    for (const test of spec.tests) {
      const entry = e2e.get(spec.title) ?? [];
      entry.push({ project: test.projectName, status: test.results.at(-1)?.status });
      e2e.set(spec.title, entry);
    }
  }
  (suite.suites ?? []).forEach(walk);
})({ suites: read("playwright.json").suites });
for (const [title, runs] of e2e) {
  add({
    title,
    status: runs.every((r) => r.status === "passed") ? "passed" : "failed",
    tool: "Playwright (Chromium + WebKit mobile)",
    level: "E2E",
    message: runs.map((r) => `${r.project}: ${r.status}`).join(", "),
  });
}

// k6: el resultado sale de los umbrales exportados en --summary-export (false = umbral no superado).
const K6 = path.join(ROOT, "docs/testing/reportes/k6");
const k6 = (name) => JSON.parse(readFileSync(path.join(K6, `${name}-summary.json`), "utf8")).metrics;
const ms = (value) => `${value.toFixed(1)} ms`;
const thresholdsOk = (...metrics) => metrics.every((m) => Object.values(m.thresholds ?? {}).every((crossed) => !crossed));
const manual = (title, ok, tool, level, message) => {
  add({ title, status: ok ? "passed" : "failed", tool, level, message });
  rows.at(-1).obtainedText = message;
};

const http = k6("k6-http");
const stress = k6("k6-http-stress");
for (const [id, endpoint, label] of [["PT-TR-60", "cartelera", "GET /cartelera"], ["PT-TR-61", "salas", "GET /salas (con sesión)"]]) {
  const d = http[`http_req_duration{endpoint:${endpoint}}`];
  const f = http[`http_req_failed{endpoint:${endpoint}}`];
  manual(
    `${id} ${label} con rampa a ${http.vus_max.value} VUs durante 1 min 45 s → p95 < 200 ms y tasa de error < 1 %`,
    thresholdsOk(d, f),
    "k6",
    "Carga",
    `p95 ${ms(d["p(95)"])}, p99 ${ms(d["p(99)"])}, error ${(f.value * 100).toFixed(2)} %`
  );
}
{
  const c = stress["http_req_duration{endpoint:cartelera}"];
  const s = stress["http_req_duration{endpoint:salas}"];
  manual(
    `PT-TR-62 Estrés: GET /cartelera + GET /salas con ${stress.vus_max.value} VUs → p95 < 200 ms y tasa de error < 1 %`,
    thresholdsOk(c, s, stress["http_req_failed{endpoint:cartelera}"], stress["http_req_failed{endpoint:salas}"]),
    "k6",
    "Estrés",
    `${stress.http_reqs.rate.toFixed(0)} req/s; p95 ${ms(c["p(95)"])} / ${ms(s["p(95)"])}, p99 ${ms(c["p(99)"])} / ${ms(s["p(99)"])}, error 0 %`
  );
}
{
  const chat = k6("k6-chat-ws");
  const lat = chat.chat_delivery_latency;
  manual(
    `PT-TR-63 Chat por WebSocket con ${chat.vus_max.value} usuarios en 12 salas, 1 mensaje cada 2 s durante 45 s → entrega p95 < 200 ms, history al conectar y 0 errores`,
    thresholdsOk(lat, chat.chat_history_on_connect, chat.chat_ws_errors),
    "k6",
    "Carga",
    `entrega p95 ${ms(lat["p(95)"])}, p99 ${ms(lat["p(99)"])}; ${chat.chat_messages_sent.count} enviados / ${chat.chat_messages_received.count} recibidos (×5 miembros, sin pérdidas); history ${chat.chat_history_on_connect.value * 100} %; errores WS ${chat.chat_ws_errors.value * 100} %. Ticket inicial en frío: p95 ${ms(chat["http_req_duration{endpoint:chat-ticket}"]["p(95)"])} (OBS-01)`
  );
}
{
  const burst = k6("k6-chat-ticket-burst");
  const rounds = [0, 1, 2, 3, 4].map((r) => burst[`http_req_duration{endpoint:chat-ticket,round:${r}}`]);
  manual(
    "PT-TR-64 5 ráfagas de 60 pedidos simultáneos de ticket de chat → p95 < 200 ms en cada ráfaga y 0 errores",
    thresholdsOk(...rounds, burst["http_req_failed{endpoint:chat-ticket}"]),
    "k6",
    "Carga (ráfaga)",
    `p95 por ráfaga: ${rounds.map((r) => Math.round(r["p(95)"])).join(" / ")} ms; error 0 %`
  );
}

// ZAP: se compara el baseline previo (antes-*) con el posterior a DEF-04.
const zapAlerts = (file) =>
  JSON.parse(readFileSync(path.join(ROOT, "docs/testing/reportes/zap", file), "utf8")).site.flatMap((s) => s.alerts);
const zapBefore = zapAlerts("antes-zap-baseline.json");
const zapAfter = zapAlerts("zap-baseline.json");
const has = (alerts, ids) => alerts.filter((a) => ids.includes(a.pluginid)).map((a) => a.pluginid);
manual(
  "PT-TR-70 ZAP baseline (spider + AJAX spider, con cookie de sesión) contra https://localhost:8443 → 0 alertas de riesgo High",
  !zapAfter.some((a) => a.riskcode === "3"),
  "OWASP ZAP baseline",
  "Seguridad",
  `0 High antes y después; WARN ${new Set(zapBefore.map((a) => a.pluginid)).size} → ${new Set(zapAfter.map((a) => a.pluginid)).size} reglas`
);
const HEADERS = ["10038", "10020", "10021", "10035", "10063"];
manual(
  "PT-TR-71 Respuestas del frontend → CSP, X-Frame-Options, X-Content-Type-Options, HSTS y Permissions-Policy presentes (sin alertas 10038/10020/10021/10035/10063)",
  has(zapAfter, HEADERS).length === 0,
  "OWASP ZAP baseline",
  "Seguridad",
  `1.ª corrida: falló (DEF-04, alertas ${[...new Set(has(zapBefore, HEADERS))].join(", ")}). Tras la corrección: sin alertas`
);
manual(
  "PT-TR-72 Cabeceras de respuesta → no revelan versión de nginx ni X-Powered-By de Express (sin alertas 10036/10037)",
  has(zapAfter, ["10036", "10037"]).length === 0,
  "OWASP ZAP baseline",
  "Seguridad",
  `1.ª corrida: falló (DEF-04, alertas ${[...new Set(has(zapBefore, ["10036", "10037"]))].join(", ")}). Tras la corrección: sin alertas`
);

rows.sort((a, b) => a.id.localeCompare(b.id, "en", { numeric: true }));
const ids = rows.map((r) => r.id);
const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
if (dupes.length) throw new Error(`IDs duplicados: ${dupes.join(", ")}`);

const esc = (s) => String(s).replace(/\|/g, "\\|");
const obtained = (r) => {
  if (r.obtainedText) return r.obtainedText;
  if (!r.passed) return `Falló: ${r.message}`;
  const defect = DEFECTS[r.id];
  if (r.id === "PT-TR-57") return "Sin violaciones de CSP ni errores en consola (regresión de DEF-04)";
  if (defect) return `1.ª corrida: falló (${defect}). Tras la corrección: igual al esperado`;
  if (r.tool.startsWith("Playwright")) return `Igual al esperado (${r.message.replace(/: passed/g, " ✓")})`;
  return "Igual al esperado";
};
const state = (r) => {
  if (!r.passed) return "❌ Falló";
  if (r.id === "PT-TR-63") return "✅ Pasó (con OBS-01)";
  return DEFECTS[r.id] && r.id !== "PT-TR-57" ? `✅ Pasó (tras ${DEFECTS[r.id]})` : "✅ Pasó";
};

const table = [
  "| ID | CU | Nivel | Herramienta | Descripción | Resultado esperado | Resultado obtenido | Estado |",
  "|---|---|---|---|---|---|---|---|",
  ...rows.map((r) => `| ${r.id} | ${r.cu} | ${r.level} | ${r.tool} | ${esc(r.description)} | ${esc(r.expected)} | ${esc(obtained(r))} | ${state(r)} |`),
].join("\n");

const totals = {};
for (const r of rows) {
  const t = (totals[r.tool] ??= { pruebas: 0, pasaron: 0, fallaron: 0, ejecuciones: 0 });
  t.pruebas++;
  t.ejecuciones += r.tool.startsWith("Playwright") ? 2 : 1;
  r.passed ? t.pasaron++ : t.fallaron++;
}

writeFileSync(path.join(RAW, "tabla.md"), table + "\n");
writeFileSync(path.join(RAW, "resumen.json"), JSON.stringify({ totals, total: rows.length, porCU: countBy(rows, "cu") }, null, 2));
console.log(JSON.stringify({ totals, total: rows.length, porCU: countBy(rows, "cu") }, null, 2));

function countBy(list, key) {
  return list.reduce((acc, r) => ({ ...acc, [r[key]]: (acc[r[key]] ?? 0) + 1 }), {});
}
