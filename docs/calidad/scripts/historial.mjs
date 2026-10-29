// Extrae del repositorio los datos de configuracion del TP6-TP9 (commits, ramas y documentacion).
// Uso: node docs/calidad/scripts/historial.mjs  ->  docs/calidad/raw/{commits,ramas,docs}.json
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const RAW = path.join(ROOT, "docs/calidad/raw");
const git = (...args) => execFileSync("git", args, { cwd: ROOT, encoding: "utf8", maxBuffer: 1 << 28 });

const FOLDERS = ["src", "docs", "tests"];
const folderOf = (file) => {
  const top = file.split("/")[0];
  return FOLDERS.includes(top) && file.includes("/") ? top : "raiz";
};

// Rama de origen: name-rev elige la rama mas cercana que contiene al commit; en merges de PR se usa el mensaje.
const refs = ["--refs=refs/heads/*", "--refs=refs/remotes/origin/*", "--exclude=refs/remotes/origin/HEAD"];
const SEP = "\x1e";
const log = git("log", "--all", "--date=iso-strict", "--numstat", `--format=${SEP}%h%x09%H%x09%ad%x09%an%x09%P%x09%s`);
const commits = [];
for (const block of log.split(SEP).slice(1)) {
  const [header, ...lines] = block.split("\n");
  const [short, full, date, author, parents, subject] = header.split("\t");
  const stats = Object.fromEntries([...FOLDERS, "raiz"].map((f) => [f, { add: 0, del: 0, files: 0 }]));
  let binary = 0;
  for (const line of lines.filter(Boolean)) {
    const [add, del, ...rest] = line.split("\t");
    let file = rest.join("\t");
    // Renombres: "dir/{viejo => nuevo}/x" o "viejo => nuevo"
    file = file.replace(/\{[^}]* => ([^}]*)\}/, "$1").replace(/^.* => /, "").replace(/\/\//g, "/");
    const s = stats[folderOf(file)];
    s.files++;
    if (add === "-") binary++;
    else {
      s.add += Number(add);
      s.del += Number(del);
    }
  }
  commits.push({ short, full, date, author, merge: parents.split(" ").length > 1, subject, stats, binary });
}

const names = git("name-rev", "--name-only", ...refs, ...commits.map((c) => c.full)).trim().split("\n");
commits.forEach((c, i) => {
  const pr = /^Merge pull request #(\d+) from [^/]+\/(\S+)/.exec(c.subject);
  c.branch = pr ? `${pr[2]} (PR #${pr[1]})` : names[i].replace(/^remotes\/origin\//, "origin/").replace(/[~^].*$/, "");
});

const branches = git(
  "for-each-ref",
  "--format=%(refname)%09%(objectname:short)%09%(committerdate:iso-strict)%09%(authorname)%09%(subject)",
  "refs/heads",
  "refs/remotes",
  "refs/tags"
)
  .trim()
  .split("\n")
  .filter((l) => !l.startsWith("refs/remotes/origin/HEAD"))
  .map((l) => {
    const [ref, sha, date, author, subject] = l.split("\t");
    return { ref, sha, date, author, subject };
  });

// Documentacion: todo .md versionado en cualquier ref (incluye README, AGENTES y minutas).
const mdFiles = [...new Set(git("log", "--all", "--format=", "--name-only", "--diff-filter=AMRD").split("\n"))]
  .filter((f) => /\.md$/i.test(f) && !f.includes("node_modules/"))
  .sort();
const inMain = new Set(git("ls-tree", "-r", "--name-only", "origin/main").split("\n"));
const inTp4 = new Set(git("ls-tree", "-r", "--name-only", "tp4-plan-pruebas").split("\n"));
const docs = mdFiles.map((file) => {
  const history = git("log", "--all", "--format=%h%x09%ad%x09%an%x09%s", "--date=short", "--", file)
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((l) => l.split("\t"));
  const created = history.at(-1);
  const last = history[0];
  return {
    file,
    createdCommit: created[0],
    createdDate: created[1],
    createdBy: created[2],
    commits: history.length,
    modifications: history.length - 1,
    lastCommit: last[0],
    lastDate: last[1],
    lastBy: last[2],
    inMain: inMain.has(file),
    inTp4: inTp4.has(file),
  };
});

writeFileSync(path.join(RAW, "commits.json"), JSON.stringify(commits, null, 1));
writeFileSync(path.join(RAW, "ramas.json"), JSON.stringify(branches, null, 1));
writeFileSync(path.join(RAW, "docs.json"), JSON.stringify(docs, null, 1));
console.log(`${commits.length} commits, ${branches.length} refs, ${docs.length} archivos .md`);
