// Genera resultados-calidad.md: toma la plantilla con marcadores {{NOMBRE}} y los reemplaza por tablas
// armadas desde docs/calidad/raw. Uso: node docs/calidad/scripts/tablas.mjs
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const RAW = path.join(ROOT, "docs/calidad/raw");
const TEMPLATE = path.join(ROOT, "docs/calidad/scripts/resultados-calidad.plantilla.md");
const REPORT = path.join(ROOT, "docs/calidad/resultados-calidad.md");
const json = (file) => JSON.parse(readFileSync(path.join(RAW, file), "utf8"));
const git = (...args) => execFileSync("git", args, { cwd: ROOT, encoding: "utf8", maxBuffer: 1 << 28 });
const esc = (s) => String(s ?? "").replace(/\|/g, "\\|");
const n = (x) => x.toLocaleString("es-AR");
const table = (head, rows) => [`| ${head.join(" | ")} |`, `|${head.map(() => "---").join("|")}|`, ...rows.map((r) => `| ${r.map(esc).join(" | ")} |`)].join("\n");
const kb = (bytes) => (bytes / 1024).toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const ad = (s) => (s.add || s.del ? `+${n(s.add)} / −${n(s.del)}` : "—");

const tables = {};

// A1 — commits
const commits = json("commits.json");
const remote = new Set(git("rev-list", "--remotes=origin").trim().split("\n").map((h) => h.slice(0, 7)));
tables.COMMITS = table(
  ["#", "Hash", "Fecha", "Autor (tal como figura)", "Rama de origen (deducida)", "En origin", "Mensaje", "src/", "docs/", "tests/", "raíz"],
  commits.map((c, i) => [
    commits.length - i,
    c.short,
    c.date.replace("T", " ").slice(0, 16),
    c.author,
    c.branch,
    remote.has(c.short) ? "sí" : "**no**",
    (c.merge ? "[merge] " : "") + c.subject.slice(0, 90),
    ad(c.stats.src),
    ad(c.stats.docs),
    ad(c.stats.tests),
    ad(c.stats.raiz),
  ])
);
const sum = (pred = () => true) =>
  ["src", "docs", "tests", "raiz"].map((f) => {
    const cs = commits.filter(pred);
    return ad({ add: cs.reduce((a, c) => a + c.stats[f].add, 0), del: cs.reduce((a, c) => a + c.stats[f].del, 0) });
  });
const nodeModules = git("log", "--all", "--numstat", "--format=", "--", "src/login-controller/node_modules", "src/chat-controller/node_modules")
  .trim()
  .split("\n")
  .filter(Boolean)
  .map((l) => l.split("\t"))
  .filter(([a]) => a !== "-")
  .reduce((acc, [a, d]) => ({ add: acc.add + Number(a), del: acc.del + Number(d) }), { add: 0, del: 0 });
tables.COMMITS_TOTALES = table(
  ["Conjunto", "Commits", "src/", "docs/", "tests/", "raíz"],
  [
    ["Todos (no merge)", commits.filter((c) => !c.merge).length, ...sum((c) => !c.merge)],
    ["Merges", commits.filter((c) => c.merge).length, ...sum((c) => c.merge)],
    ["Total", commits.length, ...sum()],
    ["…de src/: líneas dentro de `node_modules/` versionados", "—", ad(nodeModules), "—", "—", "—"],
  ]
);
const authors = {};
for (const c of commits) {
  const a = (authors[c.author] ??= { commits: 0, merges: 0, first: c.date, last: c.date, add: 0, del: 0 });
  a.commits++;
  if (c.merge) a.merges++;
  if (c.date < a.first) a.first = c.date;
  if (c.date > a.last) a.last = c.date;
  for (const s of Object.values(c.stats)) {
    a.add += s.add;
    a.del += s.del;
  }
}
tables.AUTORES = table(
  ["Autor (tal como figura en git)", "Commits", "de ellos merges", "Primer commit", "Último commit", "Líneas + / −"],
  Object.entries(authors)
    .sort((a, b) => b[1].commits - a[1].commits)
    .map(([name, a]) => [name, a.commits, a.merges, a.first.slice(0, 10), a.last.slice(0, 10), `+${n(a.add)} / −${n(a.del)}`])
);

// A2 — ramas
const ahead = (ref) => git("rev-list", "--left-right", "--count", `origin/main...${ref}`).trim().split(/\s+/);
tables.RAMAS = table(
  ["Ref", "Tipo", "Último commit", "Fecha", "Autor", "Mensaje", "Atrás / adelante de origin/main"],
  json("ramas.json").map((b) => {
    const [behind, front] = ahead(b.ref);
    return [
      b.ref.replace(/^refs\/(heads|remotes)\//, ""),
      b.ref.startsWith("refs/heads") ? "local" : b.ref.startsWith("refs/remotes") ? "remota" : "tag",
      b.sha,
      b.date.replace("T", " ").slice(0, 16),
      b.author,
      b.subject.slice(0, 60),
      `${behind} / ${front}`,
    ];
  })
);

// A3 — pull requests
tables.PRS = table(
  ["#", "Título", "Autor", "Creado (UTC)", "Mergeado (UTC)", "Minutos abierto", "head → base", "Reviews", "reviewDecision", "Commits", "+ / −", "Archivos", "Comentarios"],
  json("pr-list.json").map((p) => [
    p.number,
    p.title,
    p.author.login,
    p.createdAt.replace("T", " ").slice(0, 16),
    p.mergedAt ? p.mergedAt.replace("T", " ").slice(0, 16) : "—",
    p.mergedAt ? ((new Date(p.mergedAt) - new Date(p.createdAt)) / 60000).toLocaleString("es-AR", { maximumFractionDigits: 1 }) : "—",
    `${p.headRefName} → ${p.baseRefName}`,
    p.reviews.length ? p.reviews.map((r) => `${r.author}: ${r.state}`).join(", ") : "ninguna",
    "n/d (requiere GraphQL autenticado)",
    p.commits,
    `+${n(p.additions)} / −${n(p.deletions)}`,
    n(p.changedFiles),
    p.comments + p.reviewComments,
  ])
);

// A4 — documentacion
tables.DOCS = table(
  ["Archivo", "Creado (fecha / commit / autor)", "Commits que lo tocan (todas las ramas)", "Modificaciones", "Última modificación", "Commits en main", "¿Está en main?", "¿Está en tp4?"],
  json("docs.json").map((d) => [
    d.file,
    `${d.createdDate} / ${d.createdCommit} / ${d.createdBy}`,
    d.commits,
    d.modifications,
    d.modifications ? `${d.lastDate} / ${d.lastCommit}` : "—",
    d.commitsMain,
    d.inMain ? "sí" : "no",
    d.inTp4 ? "sí" : "no",
  ])
);

// B1 — regresion
const cmp = json("regresion/comparacion.json");
tables.REGRESION_TOTALES = table(
  ["Herramienta", "Pruebas", "Pasaron en main (27/10)", "Fallaron en main", "Pasaron el 21/10", "Diferencia"],
  Object.entries(cmp.totals).map(([tool, t]) => [tool, t.pruebas, t.pasaron, t.fallaron, t.pasaron2110, t.pasaron - t.pasaron2110 || "0"])
);
tables.REGRESION_DIFERENCIAS = table(
  ["ID", "Herramienta", "21/10 (tp4)", "27/10 (main)", "Detalle de la falla"],
  cmp.differences.map((d) => [d.id, d.tool, d.antes, d.ahora, d.detalle || "ver raw/regresion"])
);
tables.REGRESION_K6 = table(
  ["ID", "21/10 (tp4)", "27/10 main (enchufado)"],
  Object.entries(cmp.metricas).map(([id, m]) => [id, m["21/10"], m.hoy])
);

// B2 — carga inicial
const load = json("carga-inicial/resumen.json");
const loadTable = (set) =>
  table(
    ["Red", "Página", "Caché", "Corridas", "FCP mediana / peor (ms)", "LCP mediana / peor (ms)", "Usable mediana / peor (ms)", "Transferido mediana / peor (KB)", "Pedidos", "Servidos de caché"],
    load[set].filas.map((r) => [
      r.profile === "local" ? "local, sin throttling" : "Slow 4G + CPU 4×",
      r.page === "feed" ? "/feed (con sesión)" : "/ (login)",
      r.cache.replace("cache", "caché"),
      r.corridas,
      `${n(r.fcp.mediana)} / ${n(r.fcp.peor)}`,
      `${n(r.lcp.mediana)} / ${n(r.lcp.peor)}`,
      `${n(r.usable.mediana)} / ${n(r.usable.peor)}`,
      `${kb(r.bytes.mediana)} / ${kb(r.bytes.peor)}`,
      r.requests,
      r.fromCache,
    ])
  );
tables.CARGA_MAIN = loadTable("main (enchufado)");
tables.CARGA_CONTROL = loadTable("control 21/10 (enchufado)");
tables.CARGA_BATERIA = loadTable("main a batería (descartada)");

// B3 — estatico
const ox = ["frontend", "login-controller", "reunion-controller", "chat-controller"].map((m) => {
  const r = json(`estatico/oxlint-${m}.json`);
  const by = {};
  for (const d of r.diagnostics) by[`${d.severity} · ${d.code}`] = [...(by[`${d.severity} · ${d.code}`] ?? []), `${d.filename}:${d.labels?.[0]?.span?.line ?? ""}`];
  return [m, r.number_of_files, r.number_of_rules, r.diagnostics.filter((d) => d.severity === "error").length, r.diagnostics.filter((d) => d.severity === "warning").length, Object.entries(by).map(([k, v]) => `${k} (${v.join(", ")})`).join("; ") || "—"];
});
tables.OXLINT = table(["Paquete (src/)", "Archivos", "Reglas activas", "Errores", "Warnings", "Regla (ubicación)"], ox);
const sc = readFileSync(path.join(RAW, "estatico/staticcheck.json"), "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
const ruff = json("estatico/ruff-scrapper.json");
tables.GO_PY = table(
  ["Herramienta", "Alcance", "Hallazgos", "Severidad", "Regla", "Ubicación", "Mensaje"],
  [
    ["go vet", "cache-controller ./... (6 paquetes)", 0, "—", "—", "—", "—"],
    ...sc.map((f) => ["staticcheck 2025.1.1", "cache-controller ./...", 1, f.severity, f.code, `${f.location.file.replace("/src/", "")}:${f.location.line}`, f.message.trim()]),
    ...ruff.map((f) => [
      "ruff 0.14.1 (reglas por defecto: E4, E7, E9, F)",
      "scrapper (sin tests/)",
      1,
      "error (ruff no gradúa)",
      f.code,
      `${f.filename.split(/scrapper[\\/]/)[1].replace(/\\/g, "/")}:${f.location.row}` + (/[\\/]pb[\\/]/.test(f.filename) ? " (código generado)" : ""),
      f.message,
    ]),
  ]
);

// B4 — vulnerabilidades
const npmRows = [];
const npmTotals = [];
for (const m of ["login-controller", "reunion-controller", "chat-controller", "frontend"]) {
  const all = json(`vulnerabilidades/npm-audit-${m}.json`);
  const prod = json(`vulnerabilidades/npm-audit-${m}-prod.json`);
  const v = all.metadata.vulnerabilities;
  const p = prod.metadata.vulnerabilities;
  npmTotals.push([m, all.metadata.dependencies.total, v.critical, v.high, v.moderate, v.low, v.total, `${p.critical} / ${p.high} / ${p.moderate} / ${p.low} (${p.total})`]);
  for (const [name, x] of Object.entries(all.vulnerabilities)) {
    const advisories = x.via.filter((y) => typeof y === "object");
    npmRows.push([
      m,
      name,
      x.severity,
      x.range,
      x.isDirect ? "directa" : "transitiva",
      prod.vulnerabilities[name] ? "producción" : "solo desarrollo",
      advisories.map((a) => a.url?.split("/").pop()).join(", ") || `vía ${x.via.join(", ")}`,
      advisories.map((a) => a.title).join("; ").slice(0, 120) || "—",
      x.fixAvailable === true ? "sí (npm audit fix)" : x.fixAvailable ? `${x.fixAvailable.name}@${x.fixAvailable.version}` : "no",
    ]);
  }
}
tables.NPM_TOTALES = table(["Paquete", "Dependencias", "Critical", "High", "Moderate", "Low", "Total", "Solo producción C / H / M / L (total)"], npmTotals);
tables.NPM_DETALLE = table(["Paquete", "Dependencia afectada", "Severidad", "Rango vulnerable", "Tipo", "Alcance", "Advisory", "Descripción", "Fix"], npmRows);
const pip = json("vulnerabilidades/pip-audit-scrapper.json");
const ghsa = (id) => {
  try {
    return json(`vulnerabilidades/${id}.json`).severity;
  } catch {
    return "n/d";
  }
};
tables.PIP = table(
  ["Paquete", "Versión", "ID", "Alias", "Severidad (GitHub Advisory)", "Fix", "Descripción"],
  pip.dependencies.flatMap((d) =>
    (d.vulns ?? []).map((v) => [d.name, d.version, v.id, v.aliases.join(", "), ghsa(v.aliases.find((a) => a.startsWith("GHSA"))), v.fix_versions.join(", "), v.description.slice(0, 140)])
  )
);
const gvText = readFileSync(path.join(RAW, "estatico/govulncheck.json"), "utf8");
const gvObjs = [];
for (let i = 0, depth = 0, start = 0; i < gvText.length; i++) {
  if (gvText[i] === "{" && depth++ === 0) start = i;
  else if (gvText[i] === "}" && --depth === 0) gvObjs.push(JSON.parse(gvText.slice(start, i + 1)));
}
const osv = Object.fromEntries(gvObjs.filter((o) => o.osv).map((o) => [o.osv.id, o.osv]));
const gv = {};
for (const f of gvObjs.filter((o) => o.finding).map((o) => o.finding)) {
  const level = f.trace?.[0]?.function ? 3 : f.trace?.[0]?.package ? 2 : 1;
  const e = (gv[f.osv] ??= { level: 0, module: f.trace?.[0]?.module, version: f.trace?.[0]?.version, fixed: f.fixed_version });
  e.level = Math.max(e.level, level);
}
const LEVEL = { 3: "alcanzable (se llama al símbolo)", 2: "paquete importado, símbolo no llamado", 1: "solo en el módulo (no importado)" };
tables.GOVULN = table(
  ["ID", "Alias", "Módulo", "Versión usada", "Corregido en", "Alcance (govulncheck)", "Severidad (GitHub Advisory)", "Resumen"],
  Object.entries(gv)
    .sort((a, b) => b[1].level - a[1].level || a[0].localeCompare(b[0]))
    .map(([id, e]) => {
      const aliases = osv[id]?.aliases ?? [];
      return [id, aliases.join(", "), e.module, e.version, e.fixed, LEVEL[e.level], ghsa(aliases.find((a) => a.startsWith("GHSA"))), (osv[id]?.summary ?? "").slice(0, 100)];
    })
);
tables.GOVULN_TOTALES = table(
  ["Alcance", "Avisos"],
  [3, 2, 1].map((l) => [LEVEL[l], Object.values(gv).filter((e) => e.level === l).length]).concat([["Total", Object.keys(gv).length]])
);

// B5 — higiene
const leaks = json("gitleaks.json");
tables.GITLEAKS = table(
  ["Regla", "Archivo", "Línea", "Commit", "Fecha", "Coincidencia (redactada)", "Entropía"],
  leaks.map((l) => [l.RuleID, l.File, l.StartLine, l.Commit.slice(0, 7), l.Date.slice(0, 10), l.Match, l.Entropy.toLocaleString("es-AR", { maximumFractionDigits: 2 })])
);
const art = json("artefactos-main.json");
tables.ARTEFACTOS = table(
  ["Grupo", "Archivos", "Tamaño (MB)", "% del árbol de main", "Ejemplos"],
  art.grupos.map((g) => [g.grupo, g.archivos, (g.bytes / 1048576).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }), ((100 * g.bytes) / art.total.bytes).toLocaleString("es-AR", { maximumFractionDigits: 1 }) + " %", g.ejemplos.join(", ")])
);

// B6 — defectos.md de la rama del TP4: enlaces relativos a ../testing/ y titulos un nivel mas abajo.
tables.DEFECTOS_MD = git("show", "tp4-plan-pruebas:docs/testing/defectos.md")
  .replace(/\r\n/g, "\n")
  .replace(/\]\((evidencias|reportes)\//g, "](../testing/$1/")
  .replace(/\]\(#/g, "](#")
  .replace(/^(#{1,4}) /gm, "###$1 ")
  .trim();

let report = readFileSync(TEMPLATE, "utf8");
for (const [key, value] of Object.entries(tables)) report = report.replaceAll(`{{${key}}}`, value);
const left = report.match(/\{\{[A-Z_]+\}\}/g);
if (left) throw new Error(`marcadores sin reemplazar: ${left.join(", ")}`);
writeFileSync(REPORT, report);
console.log(`tablas insertadas: ${Object.keys(tables).length}`);
