#!/usr/bin/env node
/**
 * publish-check — the gate that runs before this repo is pushed.
 *
 * This repo is a SANITIZED DERIVATIVE of a private component bin, not a mirror of it. The
 * private copies carry teardown source attributions ("generalised from <site>"), internal
 * failure-log pointers and wiki links; the public copies must not. That difference is
 * currently maintained by hand and by memory, which works right up until it doesn't — and
 * the failure is irreversible, because a public git history cannot be un-pushed.
 *
 * So stage 1 is a leak gate, and it is the reason this script exists. The rest (typecheck,
 * build, wiring) are ordinary correctness checks that happened to be run by hand.
 *
 *   node scripts/publish-check.mjs             # all stages
 *   node scripts/publish-check.mjs --self-test # prove the leak gate both passes AND fires
 *   node scripts/publish-check.mjs --fast      # skip the production build
 *
 * Stage 5 (headless render) is opt-in: it needs a browser, and a public showcase repo
 * should not carry a 300MB dev dependency for a pre-push check. Enable with:
 *   npm i -D playwright && npx playwright install chromium
 */
import { execSync } from "node:child_process";
import { readFileSync, readdirSync, existsSync, writeFileSync, rmSync, mkdtempSync } from "node:fs";
import { join, basename, relative } from "node:path";
import { tmpdir } from "node:os";

const ROOT = process.cwd();
const args = process.argv.slice(2);
const SELF_TEST = args.includes("--self-test");
const FAST = args.includes("--fast");

const C = { red: "\x1b[31m", green: "\x1b[32m", yellow: "\x1b[33m", dim: "\x1b[2m", bold: "\x1b[1m", off: "\x1b[0m" };
const say = (s = "") => console.log(s);
const fail = (s) => console.log(`${C.red}✕${C.off} ${s}`);
const ok = (s) => console.log(`${C.green}✓${C.off} ${s}`);
const skip = (s) => console.log(`${C.yellow}◦${C.off} ${s}`);

/* ── Stage 1: the leak gate ────────────────────────────────────────────────
   Patterns are derived from what is actually in the private copies, not invented — the
   private bin really does say "generalised from oddlymade.webflow.io" and cite FAILURE_LOG.
   Each rule carries a `why` so a hit explains itself instead of just naming a regex.

   Precision matters more than recall here: a gate that cries wolf gets ignored, and this one
   has to survive being run on every push. Two known false-positive traps are handled:
     - `[[g.coordinates]]` is array indexing, not a wiki link — so wiki links are anchored to
       the vault's actual namespaces rather than matching any `[[...]]`.
     - `gl.compileShader` / `window.devicePixelRatio` / `gsap.context` all look like domains to
       a naive TLD regex — so source sites are matched by name, not by a domain pattern.
   `--self-test` asserts both directions: clean on HEAD, and firing on injected content. */
const LEAK_RULES = [
  { name: "teardown-source", why: "names the site a component was generalised from",
    rx: /\b(oddlymade|trionn)\b/gi },
  { name: "vault-failure-log", why: "points at the private FAILURE_LOG",
    rx: /FAILURE_LOG/g },
  { name: "vault-path", why: "leaks the private vault's folder layout",
    rx: /\b(Second-Brain|0[1-5]-(sources|wiki|library|output|private)|AI Systems)\b/g },
  { name: "vault-tooling", why: "names private skills/pipelines",
    rx: /\b(site-harvest|motion-forensics|graphify|intel-scan|blogwatcher)\b/g },
  { name: "vault-wikilink", why: "an Obsidian wiki link into the private vault",
    rx: /\[\[(concepts|areas|summaries|people|meetings|explorations|feeds|personas|skills)\//g },
  { name: "brand-ip", why: "brand IP that is not part of this public showcase",
    rx: /\b(kAizen|kaizentic)\b|cognitive middleware/gi },
];

// Explicitly KEPT: uiverse.io MIT attributions are a credibility signal, not a leak.
const ALLOW = [/uiverse\.io/i];

function trackedFiles() {
  return execSync("git ls-files", { cwd: ROOT, encoding: "utf8" })
    .split("\n").map((s) => s.trim()).filter(Boolean)
    .filter((f) => /\.(tsx?|jsx?|mjs|css|md|json|html)$/.test(f))
    .filter((f) => !f.startsWith("scripts/publish-check")); // this file describes the patterns
}

function scanText(text, file) {
  const hits = [];
  const lines = text.split(/\r?\n/);
  for (const rule of LEAK_RULES) {
    lines.forEach((line, i) => {
      if (ALLOW.some((a) => a.test(line))) return;
      rule.rx.lastIndex = 0;
      const m = rule.rx.exec(line);
      if (m) hits.push({ file, line: i + 1, rule: rule.name, why: rule.why, text: line.trim().slice(0, 110) });
    });
  }
  return hits;
}

function stageLeakGate() {
  const files = trackedFiles();
  const hits = files.flatMap((f) => scanText(readFileSync(join(ROOT, f), "utf8"), f));
  if (hits.length) {
    fail(`leak gate: ${hits.length} finding(s) across ${new Set(hits.map((h) => h.file)).size} file(s)`);
    for (const h of hits.slice(0, 25)) {
      say(`    ${C.bold}${h.file}:${h.line}${C.off}  [${h.rule}] ${C.dim}${h.why}${C.off}`);
      say(`      ${C.dim}${h.text}${C.off}`);
    }
    if (hits.length > 25) say(`    ${C.dim}…and ${hits.length - 25} more${C.off}`);
    say();
    say(`  ${C.dim}These belong to the private bin. Remove them from the PUBLIC copy — do not${C.off}`);
    say(`  ${C.dim}"fix" them by editing the private one, which is allowed to keep its provenance.${C.off}`);
    return false;
  }
  ok(`leak gate: ${files.length} tracked files clean`);
  return true;
}

/* The gate is only trustworthy if it fires. Inject each pattern into a scratch file and
   assert a hit, then assert the real tree is clean — the negative class, measured. */
function selfTest() {
  say(`${C.bold}Self-test${C.off} — does the gate actually fire?`);
  const samples = {
    "teardown-source": " * Pattern (generalised from oddlymade.webflow.io hero video)",
    "vault-failure-log": " * released 600px early (FAILURE_LOG 2026-07-16).",
    "vault-path": " * see AI Systems/Skills/Coding for the source",
    "vault-tooling": " * generalised by site-harvest step 4",
    "vault-wikilink": " * build-note: [[concepts/water-ripple-type-hero]]",
    "brand-ip": " * kAizen — cognitive middleware",
  };
  let allFired = true;
  for (const [rule, line] of Object.entries(samples)) {
    const hits = scanText(line, "<sample>");
    const fired = hits.some((h) => h.rule === rule);
    if (fired) ok(`  fires on ${rule}`);
    else { fail(`  MISSED ${rule} — the gate would not catch this`); allFired = false; }
  }
  const allowed = scanText(' * adapted from uiverse.io (MIT) — see NOTICE.md', "<sample>");
  if (allowed.length === 0) ok("  allows the uiverse.io MIT attribution (kept by policy)");
  else { fail("  false positive on an allowed attribution"); allFired = false; }
  say();
  const clean = stageLeakGate();
  return allFired && clean;
}

function run(label, cmd) {
  try {
    execSync(cmd, { cwd: ROOT, stdio: "pipe", encoding: "utf8" });
    ok(label);
    return true;
  } catch (e) {
    fail(`${label}\n${C.dim}${(e.stdout || e.message || "").toString().split("\n").slice(-25).join("\n")}${C.off}`);
    return false;
  }
}

/* Stage 4 — wiring. Today's failure mode was bookkeeping, not code: a component can be
   added, typecheck, build, and still be invisible because it never got a barrel export or a
   showcase slot. Both are mechanical, so both are checked. */
function stageWiring() {
  const dir = join(ROOT, "src", "components");
  const comps = readdirSync(dir).filter((f) => f.endsWith(".tsx")).map((f) => basename(f, ".tsx"));
  const barrel = readFileSync(join(ROOT, "src", "index.ts"), "utf8");
  const page = existsSync(join(ROOT, "app", "page.tsx")) ? readFileSync(join(ROOT, "app", "page.tsx"), "utf8") : "";

  const unexported = comps.filter((c) => !new RegExp(`from "\\./components/${c}"`).test(barrel));
  const unshown = comps.filter((c) => !page.includes(`<${c}`));

  let good = true;
  if (unexported.length) { fail(`wiring: not exported from src/index.ts — ${unexported.join(", ")}`); good = false; }
  else ok(`wiring: all ${comps.length} components exported from the barrel`);

  if (unshown.length) {
    skip(`wiring: no showcase slot in app/page.tsx — ${unshown.join(", ")}`);
    say(`    ${C.dim}(not fatal: a component can ship without a demo, but it will be invisible)${C.off}`);
  } else ok(`wiring: all ${comps.length} components have a showcase slot`);
  return good;
}

/* Stage 5 — headless render. Opt-in: needs a browser. Asserts what static checks cannot —
   that the canvas-backed components actually produce a live GL context and that the page has
   no horizontal overflow at a narrow width. */
async function stageRender() {
  let chromium;
  try { ({ chromium } = await import("playwright")); }
  catch {
    skip("render: playwright not installed — skipping (npm i -D playwright && npx playwright install chromium)");
    return true;
  }
  const { spawn } = await import("node:child_process");
  const server = spawn("npx", ["next", "start", "-p", "3399"], { cwd: ROOT, shell: true, stdio: "ignore" });
  const browser = await chromium.launch();
  let good = true;
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    for (let i = 0; i < 40; i++) {
      try { await page.goto("http://127.0.0.1:3399/", { timeout: 2000 }); break; }
      catch { await new Promise((r) => setTimeout(r, 500)); }
    }
    await page.waitForTimeout(2500);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(3000);
    const res = await page.evaluate(() => {
      const cvs = [...document.querySelectorAll("canvas")];
      const bad = cvs.filter((c) => { const gl = c.getContext("webgl2"); return !gl || gl.isContextLost() || gl.getError() !== 0; });
      return { canvases: cvs.length, badContexts: bad.length };
    });
    if (res.canvases === 0) { fail("render: no canvas mounted"); good = false; }
    else if (res.badContexts) { fail(`render: ${res.badContexts}/${res.canvases} canvases have a lost or erroring GL context`); good = false; }
    else ok(`render: ${res.canvases} canvases, all with a live GL context`);

    // Narrow width: the page body must never scroll horizontally.
    await page.setViewportSize({ width: 400, height: 900 });
    await page.waitForTimeout(1200);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (over > 1) { fail(`render: ${over}px of horizontal overflow at 400px width`); good = false; }
    else ok("render: no horizontal overflow at 400px");
  } finally {
    await browser.close();
    server.kill();
  }
  return good;
}

const t0 = Date.now();
say(`${C.bold}publish-check${C.off} ${C.dim}${relative(process.cwd(), ROOT) || "."}${C.off}\n`);

let pass;
if (SELF_TEST) {
  pass = selfTest();
} else {
  const results = [stageLeakGate()];
  results.push(run("typecheck", "npx tsc --noEmit"));
  if (!FAST) results.push(run("build", "npm run build"));
  else skip("build: skipped (--fast)");
  results.push(stageWiring());
  results.push(await stageRender());
  pass = results.every(Boolean);
}

say();
say(pass
  ? `${C.green}${C.bold}PASS${C.off} — safe to push ${C.dim}(${((Date.now() - t0) / 1000).toFixed(1)}s)${C.off}`
  : `${C.red}${C.bold}FAIL${C.off} — do not push ${C.dim}(${((Date.now() - t0) / 1000).toFixed(1)}s)${C.off}`);
process.exit(pass ? 0 : 1);
