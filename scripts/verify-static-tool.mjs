import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { elementIds } from "./html-elements.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const toolPath = "tools/ai-visibility-scorecard/index.html";
const proPath = "assets/pro/scorecard-pro.js";
const canonical = "https://nymrel.com/tools/ai-visibility-scorecard";
const failures = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

function filesUnder(path) {
  const absolute = join(root, path);
  return readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const child = join(absolute, entry.name);
    if (entry.isDirectory()) return filesUnder(relative(root, child));
    return [relative(root, child).replaceAll("\\", "/")];
  });
}

const requiredFiles = [
  "favicon.svg",
  "LICENSE",
  "README.md",
  "assets/checkout-config.js",
  "assets/site.css",
  "assets/site.js",
  "assets/fonts/fonts.css",
  "assets/pro/pro-runtime.js",
  proPath,
  toolPath,
];
for (const path of requiredFiles) {
  check(existsSync(join(root, path)), "missing required file: " + path);
}

const html = read(toolPath);
const proSource = read(proPath);
const readme = read("README.md");
const security = read("SECURITY.md");
const contributing = read("CONTRIBUTING.md");
const combinedCopy = [html, proSource, readme, security, contributing].join("\n");
const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1] ?? "";

check(/<html\b[^>]*\blang="en"/i.test(html), "document must declare lang=en");
check(head.length > 0, "document must contain a head element");
check((head.match(/<title\b/gi) ?? []).length === 1, "document head must contain exactly one title");
check((html.match(/<h1\b/gi) ?? []).length === 1, "document must contain exactly one h1");
check((html.match(/<main\b/gi) ?? []).length === 1, "document must contain exactly one main landmark");
check(/<meta\s+name="description"\s+content="[^"]+"/i.test(html), "meta description is required");
check(
  html.includes('<link rel="canonical" href="' + canonical + '">'),
  "canonical must be " + canonical,
);
check(/Nymrel(?:'s|’s) heuristic, not a provider metric/i.test(html), "page must label the score as Nymrel's heuristic, not a provider metric");
check(/Nymrel(?:'s|’s) editorial heuristic, not a provider metric/i.test(proSource), "Pro report must label the score as Nymrel's editorial heuristic, not a provider metric");
check(/readiness checklist, not a measurement/i.test(readme), "README must describe the result as a checklist rather than a provider measurement");
check(/does not guarantee crawling, indexing, ranking, citation, recommendation, or traffic/i.test(html), "page must disclose the primary outcome boundary");
check(/does not guarantee crawling, indexing, ranking, citation, recommendation, traffic, conversion/i.test(proSource), "Pro report must disclose provider and business outcome boundaries");
check(/Vercel Web Analytics/i.test(html), "page privacy copy must disclose hosted Vercel Web Analytics");
check(/Vercel Web Analytics/i.test(readme), "README privacy copy must disclose hosted Vercel Web Analytics");
check(/Vercel Web Analytics/i.test(security), "security boundary must disclose hosted Vercel Web Analytics");
check(/local storage/i.test(html + "\n" + readme + "\n" + security), "local persistence must be documented");
check(!/the tool makes no server calls/i.test(html + "\n" + readme), "privacy copy must not deny all server requests");
check(!/never sent to a server/i.test(html + "\n" + readme), "privacy copy must not make an absolute transport claim");

const gradeLabels = ["Needs foundations", "Developing", "Prepared", "Strong foundation"];
for (const label of gradeLabels) {
  check(html.includes(label), "page is missing grade label: " + label);
  check(proSource.includes(label), "Pro report is missing grade label: " + label);
}
for (const label of ["Invisible", "Faint", "Findable", "Cited authority"]) {
  check(!new RegExp('label:\\s*["\\\']' + label + '["\\\']', "i").test(combinedCopy), "retired outcome-style grade remains: " + label);
}

const prohibitedClaims = [
  /checks that decide whether/i,
  /AI crawlers read this first/i,
  /file AI assistants look for/i,
  /format it trusts/i,
  /read back almost word-for-word/i,
  /rank lower\.\s*Speed is visibility/i,
  /proves your profiles/i,
  /confident enough to recommend/i,
  /set up to be found, read, and cited/i,
  /nothing was uploaded anywhere/i,
];
for (const pattern of prohibitedClaims) {
  check(!pattern.test(combinedCopy), "unsupported or absolute claim remains: " + pattern);
}

const checkRows = [...html.matchAll(
  /<label\s+class="check-row"\s+data-sec="(\d+)"\s+data-w="([\d.]+)"\s+data-fix="([^"]*)">[\s\S]*?<input\s+type="checkbox"\s+data-id="([^"]+)">[\s\S]*?<\/label>/gi,
)].map((match) => ({
  section: Number(match[1]),
  weight: Number(match[2]),
  fix: match[3],
  id: match[4],
}));
check(checkRows.length === 20, "scorecard must expose exactly 20 checks; found " + checkRows.length);
const checkIds = checkRows.map((row) => row.id);
check(new Set(checkIds).size === 20, "scorecard check identifiers must be unique");
check(Math.abs(checkRows.reduce((sum, row) => sum + row.weight, 0) - 102) < 0.001, "raw editorial weights must total 102");
for (let section = 0; section < 5; section += 1) {
  check(checkRows.filter((row) => row.section === section).length === 4, "section " + section + " must contain four checks");
}
const sectionNames = [
  "Access & discovery",
  "Machine-readable context",
  "Content clarity",
  "Technical delivery",
  "Identity & corroboration",
];
for (const name of sectionNames) {
  check(html.includes(name.replaceAll("&", "&amp;")) || html.includes(name), "page is missing section: " + name);
  check(proSource.includes(name), "Pro report is missing section: " + name);
}

const ids = elementIds(html);
const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
check(duplicateIds.length === 0, "duplicate element ids: " + duplicateIds.join(", "));

const jsonLdBlocks = [...head.matchAll(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/gi)];
check(jsonLdBlocks.length >= 1, "at least one JSON-LD block is required");
for (const [index, block] of jsonLdBlocks.entries()) {
  try {
    JSON.parse(block[1]);
  } catch (error) {
    failures.push("JSON-LD block " + (index + 1) + " is invalid: " + error.message);
  }
}

const inlineScripts = [...html.matchAll(
  /<script(?![^>]*\bsrc=)(?![^>]*application\/ld\+json)[^>]*>([\s\S]*?)<\/script>/gi,
)];
for (const [index, script] of inlineScripts.entries()) {
  try {
    new vm.Script(script[1], { filename: toolPath + ":inline-" + (index + 1) });
  } catch (error) {
    failures.push("inline script " + (index + 1) + " has invalid syntax: " + error.message);
  }
}

const javascriptFiles = filesUnder("assets").filter((path) => path.endsWith(".js"));
for (const path of javascriptFiles) {
  try {
    new vm.Script(read(path), { filename: path });
  } catch (error) {
    failures.push(path + " has invalid syntax: " + error.message);
  }
}

const searchAgentsMatch = proSource.match(/var SEARCH_AGENTS = \[([\s\S]*?)\];/);
const searchAgents = searchAgentsMatch
  ? [...searchAgentsMatch[1].matchAll(/"([^"]+)"/g)].map((match) => match[1])
  : [];
check(
  JSON.stringify(searchAgents) === JSON.stringify(["OAI-SearchBot", "Claude-SearchBot", "PerplexityBot"]),
  "generated search/index allowlist must contain only the three documented search agents",
);
const robotsSource = proSource.slice(proSource.indexOf("function aiRobotsBlock"), proSource.indexOf("function pad"));
check(!/GPTBot|Google-Extended|ClaudeBot|Claude-User|Perplexity-User/.test(robotsSource), "generated search/index allowlist must not mix training or user-triggered fetchers");
check((proSource.match(/\.replace\(\/<\/g,/g) ?? []).length >= 4, "all four React JSON-LD examples must guard literal < characters");
check(proSource.includes(String.raw`'\\\\u003c'`), "React JSON-LD examples must emit the literal \\u003c escape");
check(!/__html:\s*JSON\.stringify\([^)]+\)\s*}}/.test(proSource), "unguarded JSON.stringify remains in a dangerouslySetInnerHTML example");
check(/wp_json_encode\([^\n]+JSON_HEX_TAG/.test(proSource), "WordPress JSON-LD example must use JSON_HEX_TAG");

const hostile = "</script><img src=x onerror=alert(1)>";
const exampleIds = new Set(["sitemap", "ssr", "org", "meta", "canonical", "mobile", "speed", "contact", "about", "plain"]);
const sections = sectionNames.map((name) => ({ name, checked: 0, count: 0, raw: 0, max: 0 }));
const passed = [];
const missing = [];
for (const [index, row] of checkRows.entries()) {
  const item = {
    id: row.id,
    weight: row.weight,
    section: index === 0 ? sectionNames[row.section] + hostile : sectionNames[row.section],
    sectionIndex: row.section,
    fix: index === 0 ? row.fix + hostile : row.fix,
    order: index,
  };
  sections[row.section].count += 1;
  sections[row.section].max += row.weight;
  if (exampleIds.has(row.id)) {
    sections[row.section].checked += 1;
    sections[row.section].raw += row.weight;
    passed.push(item);
  } else {
    missing.push(item);
  }
}
const checkedRaw = passed.reduce((sum, item) => sum + item.weight, 0);
const snapshot = {
  score: Math.round((checkedRaw / 102) * 100),
  checkedCount: passed.length,
  total: checkRows.length,
  maxRaw: 102,
  sections,
  missing,
  passed,
};

let registeredProProduct;
const proContext = {
  document: {
    getElementById(id) {
      return id === "proScorecardPlatform" ? { value: "next" } : null;
    },
  },
  window: {
    JBScorecard: {
      SECTION_NAMES: sectionNames,
      gradeFor(score) {
        if (score < 40) return { label: "Needs foundations" };
        if (score < 65) return { label: "Developing" };
        if (score < 85) return { label: "Prepared" };
        return { label: "Strong foundation" };
      },
      snapshot() {
        return snapshot;
      },
    },
    JB: {
      pro: {
        escapeHtml(value) {
          return String(value)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#39;");
        },
        reportHtml(options) {
          return String(options.body ?? "");
        },
        icsFile() {
          return "BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n";
        },
        register(id, product) {
          registeredProProduct = { id, product };
        },
      },
    },
  },
};
try {
  vm.runInNewContext(proSource, proContext, { filename: proPath });
  check(registeredProProduct?.id === "scorecard-pro", "Pro product must register as scorecard-pro");
  const built = registeredProProduct?.product.build();
  check(built?.files.length === 4, "Pro build must create exactly four artifacts");
  const names = built?.files.map((file) => file.name).sort() ?? [];
  check(
    JSON.stringify(names) === JSON.stringify(["README.txt", "baseline.json", "pro-report.html", "recheck.ics"]),
    "Pro artifact names must remain stable",
  );
  const report = built?.files.find((file) => file.name === "pro-report.html")?.text ?? "";
  const baselineText = built?.files.find((file) => file.name === "baseline.json")?.text ?? "";
  check(!report.includes(hostile), "Pro report must not contain raw hostile HTML from a snapshot");
  check(report.includes("&lt;/script&gt;"), "Pro report must HTML-escape hostile snapshot text");
  check(/Nymrel's editorial heuristic, not a provider metric/i.test(report), "generated Pro report must carry the methodology boundary");
  const baseline = JSON.parse(baselineText);
  check(baseline.score === 49, "Pro baseline must preserve the deterministic example score of 49");
  check(baseline.grade === "Developing", "Pro baseline must preserve the Developing grade");
  check(baseline.total === 20 && baseline.checks.length === 20, "Pro baseline must preserve all twenty checks");
} catch (error) {
  failures.push("Pro artifact semantic probe failed: " + error.message);
}

const assetReferences = [...html.matchAll(/<(?:script|link)\b[^>]*(?:src|href)="(\/[^"]+)"[^>]*>/gi)]
  .map((match) => match[1].split(/[?#]/, 1)[0]);
for (const reference of assetReferences) {
  if (reference === "/_vercel/insights/script.js") continue;
  check(existsSync(join(root, reference.replace(/^\//, ""))), "missing local asset referenced by HTML: " + reference);
}

for (const path of filesUnder("assets").filter((candidate) => candidate.endsWith(".css"))) {
  const css = read(path);
  for (const match of css.matchAll(/url\(["']?([^)"']+)["']?\)/gi)) {
    const reference = match[1].trim().split(/[?#]/, 1)[0];
    if (/^(?:data:|https?:|%23|#)/i.test(reference)) continue;
    const target = reference.startsWith("/")
      ? resolve(root, reference.replace(/^\//, ""))
      : resolve(dirname(join(root, path)), reference);
    check(target.startsWith(root), "CSS asset escapes repository root in " + path + ": " + reference);
    check(existsSync(target), "missing local asset referenced by " + path + ": " + reference);
  }
}

check(!/buy\.stripe\.com/i.test(read("assets/checkout-config.js")), "public checkout template must not embed live payment links");

const workflowFiles = filesUnder(".github/workflows").filter((path) => /\.ya?ml$/i.test(path));
for (const path of workflowFiles) {
  const workflow = read(path);
  for (const use of workflow.matchAll(/^\s*uses:\s*([^\s#]+)/gm)) {
    check(/@[0-9a-f]{40}$/i.test(use[1]), "workflow action must use an immutable SHA in " + path + ": " + use[1]);
  }
}

const textFiles = [toolPath, "README.md", "SECURITY.md", "CONTRIBUTING.md", ...javascriptFiles];
const secretPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bgh[pousr]_[A-Za-z0-9]{30,}\b/,
  /\bsk_(?:live|test)_[A-Za-z0-9]{16,}\b/,
  /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/,
];
for (const path of textFiles) {
  const content = read(path);
  for (const pattern of secretPatterns) {
    check(!pattern.test(content), "possible secret in " + path + ": " + pattern);
  }
}

for (const path of requiredFiles) {
  const absolute = join(root, path);
  check(!existsSync(absolute) || statSync(absolute).isFile(), "required path is not a regular file: " + path);
}

if (failures.length > 0) {
  console.error(JSON.stringify({ ok: false, failures }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  tool: "ai-visibility-scorecard",
  canonical,
  required_files: requiredFiles.length,
  checks: checkRows.length,
  raw_weight: checkRows.reduce((sum, row) => sum + row.weight, 0),
  javascript_files: javascriptFiles.length,
  inline_scripts: inlineScripts.length,
  json_ld_blocks: jsonLdBlocks.length,
  asset_references: assetReferences.length,
  pro_artifacts: 4,
  html_sha256: createHash("sha256").update(html).digest("hex"),
}, null, 2));
