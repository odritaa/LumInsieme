// B1: compara por ID la corrida del 21/10 (docs/testing/reportes) con la regresion sobre main (docs/calidad/raw/regresion).
// Uso: node docs/calidad/scripts/regresion.mjs  ->  docs/calidad/raw/regresion/comparacion.json
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const BEFORE = path.join(ROOT, "docs/testing/reportes");
const AFTER = path.join(ROOT, "docs/calidad/raw/regresion");
const json = (file) => JSON.parse(readFileSync(file, "utf8"));
const idOf = (title) => /^(PT-(?:CU\d{2}|TR)-\d{2})/.exec(title.trim().replace(/_/g, " "))[1];

function load(dir, k6Dir, zapFile) {
  const results = new Map();
  const put = (tool, id, ok, detail = "") => results.set(id, { tool, ok, detail });

  for (const module of ["login-controller", "reunion-controller", "chat-controller", "frontend"]) {
    const tool = module === "frontend" ? "Vitest + RTL" : "Vitest + Supertest";
    for (const file of json(path.join(dir, `vitest-${module}.json`)).testResults)
      for (const t of file.assertionResults) put(tool, idOf(t.title), t.status === "passed", t.failureMessages?.[0]?.split("\n")[0] ?? "");
  }
  const goOutput = {};
  for (const line of readFileSync(path.join(dir, "go-cache-controller.json"), "utf8").trim().split("\n")) {
    const e = JSON.parse(line);
    if (e.Test && e.Action === "output" && /expected:|actual\s*:/.test(e.Output)) (goOutput[e.Test] ??= []).push(e.Output.trim().replace(/\s+/g, " "));
    if (e.Test?.includes("/") && ["pass", "fail"].includes(e.Action))
      put("go test + Testify + miniredis", idOf(e.Test.split("/").slice(1).join("/")), e.Action === "pass", (goOutput[e.Test] ?? []).join("; "));
  }
  for (const t of json(path.join(dir, "pytest-scrapper.json"))) put("pytest", idOf(t.title), t.status === "passed", t.message);

  const e2e = new Map();
  (function walk(suite) {
    for (const spec of suite.specs ?? [])
      for (const test of spec.tests) {
        const id = idOf(spec.title);
        e2e.set(id, [...(e2e.get(id) ?? []), `${test.projectName}: ${test.results.at(-1)?.status}`]);
      }
    (suite.suites ?? []).forEach(walk);
  })({ suites: json(path.join(dir, "playwright.json")).suites });
  for (const [id, runs] of e2e) put("Playwright", id, runs.every((r) => r.endsWith("passed")), runs.join(", "));

  const k6 = (name) => json(path.join(k6Dir, `${name}-summary.json`)).metrics;
  const ok = (...ms) => ms.every((m) => Object.values(m.thresholds ?? {}).every((crossed) => !crossed));
  const p95 = (m) => `${m["p(95)"].toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ms`;
  const http = k6("k6-http");
  const stress = k6("k6-http-stress");
  const chat = k6("k6-chat-ws");
  const burst = k6("k6-chat-ticket-burst");
  const rounds = [0, 1, 2, 3, 4].map((r) => burst[`http_req_duration{endpoint:chat-ticket,round:${r}}`]);
  for (const [id, endpoint] of [["PT-TR-60", "cartelera"], ["PT-TR-61", "salas"]]) {
    const d = http[`http_req_duration{endpoint:${endpoint}}`];
    put("k6", id, ok(d, http[`http_req_failed{endpoint:${endpoint}}`]), `p95 ${p95(d)}`);
  }
  const sc = stress["http_req_duration{endpoint:cartelera}"];
  const ss = stress["http_req_duration{endpoint:salas}"];
  put("k6", "PT-TR-62", ok(sc, ss), `p95 ${p95(sc)} / ${p95(ss)}`);
  put("k6", "PT-TR-63", ok(chat.chat_delivery_latency, chat.chat_history_on_connect, chat.chat_ws_errors), `entrega p95 ${p95(chat.chat_delivery_latency)}; ticket p95 ${p95(chat["http_req_duration{endpoint:chat-ticket}"])}`);
  put("k6", "PT-TR-64", ok(...rounds), `p95 por ráfaga ${rounds.map((r) => Math.round(r["p(95)"])).join(" / ")} ms`);

  const alerts = json(zapFile).site.flatMap((s) => s.alerts).map((a) => a.pluginid);
  put("OWASP ZAP baseline", "PT-TR-70", !json(zapFile).site.flatMap((s) => s.alerts).some((a) => a.riskcode === "3"));
  const present = (ids) => ids.filter((p) => alerts.includes(p));
  put("OWASP ZAP baseline", "PT-TR-71", present(["10038", "10020", "10021", "10035", "10063"]).length === 0, `alertas presentes: ${present(["10038", "10020", "10021", "10035", "10063"]).join(", ") || "ninguna"}`);
  put("OWASP ZAP baseline", "PT-TR-72", present(["10036", "10037"]).length === 0, `alertas presentes: ${present(["10036", "10037"]).join(", ") || "ninguna"}`);
  return results;
}

const before = load(path.join(BEFORE, "raw"), path.join(BEFORE, "k6"), path.join(BEFORE, "zap/zap-baseline.json"));
const after = load(AFTER, path.join(AFTER, "k6"), path.join(AFTER, "zap/zap-baseline.json"));

const totals = {};
const differences = [];
for (const [id, now] of after) {
  const t = (totals[now.tool] ??= { pruebas: 0, pasaron: 0, fallaron: 0, pasaron2110: 0 });
  t.pruebas++;
  now.ok ? t.pasaron++ : t.fallaron++;
  const prev = before.get(id);
  if (prev?.ok) t.pasaron2110++;
  if (!prev || prev.ok !== now.ok) differences.push({ id, tool: now.tool, antes: prev ? (prev.ok ? "pasó" : "falló") : "no existía", ahora: now.ok ? "pasó" : "falló", detalle: now.detail });
}
const missing = [...before.keys()].filter((id) => !after.has(id));
const out = { totals, differences: differences.sort((a, b) => a.id.localeCompare(b.id, "en", { numeric: true })), faltantes: missing, metricas: Object.fromEntries([...after].filter(([, v]) => v.tool === "k6").map(([id, v]) => [id, { hoy: v.detail, "21/10": before.get(id)?.detail }])) };
writeFileSync(path.join(AFTER, "comparacion.json"), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
