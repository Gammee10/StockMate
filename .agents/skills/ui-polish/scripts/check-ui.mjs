#!/usr/bin/env node
/**
 * ui-polish checker
 *
 * Finds the most common "AI look" problems in a Next.js + Tailwind + shadcn/ui project.
 * No dependencies. Needs Node 18 or newer.
 *
 * Usage:
 *   node check-ui.mjs                  check app/, src/, components/, pages/
 *   node check-ui.mjs app/dashboard    check one folder or file (you can pass several)
 *   node check-ui.mjs --changed        check only files changed in git (staged, unstaged, new)
 *   node check-ui.mjs --include-ui     also check components/ui (normally skipped)
 *   node check-ui.mjs --skip-setup     do not check that the tokens and components/ui exist
 *   node check-ui.mjs --json           print the result as JSON
 *
 * Exit code: 0 = no FAIL, 1 = at least one FAIL, 2 = setup missing or bad usage.
 *
 * Escape hatch: put the text `ui-check-ignore` in a comment on the same line
 * or on the line above. Put `ui-check-ignore-file` in the first 5 lines to skip a file.
 */
import { existsSync, readdirSync, readFileSync, statSync, writeSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { extname, join, relative, resolve } from "node:path";

const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith("--")));
const targets = argv.filter((a) => !a.startsWith("--") && a !== "-h");
const cwd = process.cwd();

if (flags.has("--help") || argv.includes("-h")) {
  writeSync(
    1,
    [
      "ui-polish checker. Run it from the project root. No dependencies.",
      "",
      "  node check-ui.mjs                  check app/, src/, components/, pages/",
      "  node check-ui.mjs app/dashboard    check one folder or file (you can pass several)",
      "  node check-ui.mjs --changed        check only files changed in git",
      "  node check-ui.mjs --include-ui     also check components/ui",
      "  node check-ui.mjs --skip-setup     do not check that the tokens and components/ui exist",
      "  node check-ui.mjs --json           print the result as JSON",
      "",
      "FAIL = fix it. WARN = look at it.",
      "Silence one finding on purpose: put ui-check-ignore in a comment on that line or the line above.",
      "Exit code: 0 = no FAIL, 1 = at least one FAIL, 2 = setup missing or bad usage.",
      "",
    ].join("\n"),
  );
  process.exit(0);
}

const MAX_PER_FILE = 40;
const MAX_TOTAL = 120;

/* ---------------------------------------------------------------- rules */

const PALETTE =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
const SIDES = "t|b|l|r|s|e|x|y|tl|tr|bl|br";

// css: true  -> the rule also runs on .css files (other files run on .tsx .jsx .mdx)
// skipLine   -> skip the whole line when this matches
// ok(hit)    -> return true to ignore this match
const rules = [
  {
    id: "raw-color",
    level: "fail",
    css: true,
    re: new RegExp(
      `\\b(?:bg|text|border(?:-(?:${SIDES}))?|ring|ring-offset|outline|fill|stroke|from|via|to|decoration|divide|accent|caret|placeholder|shadow)-(?:${PALETTE})-(?:50|[1-9]00|950)(?:\\/\\d{1,3})?\\b`,
      "g"
    ),
    fix: "Use a color token, not a palette color. Surfaces: bg-background, bg-card, bg-muted. Text: text-foreground, text-muted-foreground. Lines: border-border. Main action: bg-primary text-primary-foreground. Status: text-success, text-warning, text-destructive, bg-success/10.",
  },
  {
    id: "bg-white-black",
    level: "fail",
    css: true,
    re: /\b(?:bg|border|ring|divide)-(?:white\b|black\b(?!\/))/g,
    fix: "bg-white and bg-black break dark mode. Use bg-background, bg-card or bg-muted.",
  },
  {
    id: "text-white-black",
    level: "warn",
    css: true,
    re: /\btext-(?:white|black)\b/g,
    fix: "text-white and text-black ignore the theme. Use text-foreground or text-primary-foreground. (It is fine on top of a photo.)",
  },
  {
    // In code, a hex color sits right after a quote, bracket or paren.
    // A space before the "#" means plain text such as "Order #1042", which is not a color.
    id: "hex-color",
    level: "fail",
    re: /(?:^|["'`(\[:,=])(#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4}))(?![\w-])/g,
    skipLine: /\b(?:href|id|htmlFor)=|url\(#/,
    fix: "No hex colors in components. Use a token class. Need a new color? Add a token in globals.css.",
  },
  {
    id: "hex-color",
    level: "fail",
    cssOnly: true,
    re: /(?:^|[\s:,(])(#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4}))(?![\w-])/g,
    skipLine: /url\(#/,
    fix: "No hex colors in components. Use a token class. Need a new color? Add a token in globals.css.",
  },
  {
    id: "hex-color",
    level: "fail",
    css: true,
    re: /\b(?:rgba?|hsla?|oklch|oklab|lab|lch)\((?!\s*var\()/g,
    fix: "No hex colors in components. Use a token class. Need a new color? Add a token in globals.css.",
  },
  {
    id: "gradient",
    level: "fail",
    css: true,
    re: /\b(?:bg-gradient-to-(?:t|tr|r|br|b|bl|l|tl)|bg-linear-(?:to-(?:t|tr|r|br|b|bl|l|tl)|\d+|\[[^\]]*\])|bg-radial\b|bg-conic\b|(?:linear|radial|conic)-gradient\()/g,
    fix: "No gradients. Use a solid token color (bg-primary, bg-muted).",
  },
  {
    id: "gradient-text",
    level: "fail",
    css: true,
    re: /\bbg-clip-text\b/g,
    fix: "No gradient text. Use text-foreground. Show emphasis with size or weight.",
  },
  {
    id: "emoji",
    level: "fail",
    re: /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}\u{2B55}]/gu,
    fix: "No emoji in the UI. Use a lucide-react icon (size-4) or remove it.",
  },
  {
    id: "heavy-shadow",
    level: "fail",
    css: true,
    re: /\b(?:shadow|drop-shadow)-(?:lg|xl|2xl)\b/g,
    fix: "No heavy shadows. Use a border. Popovers and dialogs already get a shadow from components/ui.",
  },
  {
    id: "shadow-md",
    level: "warn",
    css: true,
    re: /\bshadow-(?:md\b|\[)/g,
    fix: "Avoid shadow-md on cards and sections. Use a border. Keep shadows for floating things (menus, popovers).",
  },
  {
    id: "big-radius",
    level: "fail",
    css: true,
    re: new RegExp(`\\brounded(?:-(?:${SIDES}|ss|se|ee|es))?-(?:2xl|3xl)\\b`, "g"),
    fix: "Use rounded-md for controls and rounded-xl for panels (the same as <Card>). rounded-full only for avatars and pills.",
  },
  {
    id: "arbitrary-value",
    level: "warn",
    css: true,
    re: /\b(?:p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml|gap|gap-x|gap-y|space-x|space-y|text|leading|tracking|rounded)-\[[^\]\s]+\]/g,
    ok: (hit) => /var\(|calc\(|%|color:|length:|--|\[#/.test(hit),
    fix: "Use a standard Tailwind step (p-4, gap-6, text-sm, rounded-lg) instead of an arbitrary value.",
  },
  {
    id: "arbitrary-value",
    level: "warn",
    css: true,
    re: /\b(?:w|h|min-w|min-h|max-w|max-h|size)-\[\d+(?:\.\d+)?px\]/g,
    fix: "Use a standard Tailwind step (p-4, gap-6, text-sm, rounded-lg) instead of an arbitrary value.",
  },
  {
    id: "transition-all",
    level: "warn",
    css: true,
    re: /\btransition-all\b/g,
    fix: "Use transition-colors (or transition-opacity).",
  },
  {
    id: "hover-motion",
    level: "warn",
    re: /\b(?:group-)?hover:(?:-?translate-[xy]-|scale-|-?rotate-)/g,
    fix: "No move or scale on hover. Change color only (hover:bg-accent).",
  },
  {
    id: "loud-animation",
    level: "warn",
    re: /\banimate-(?:bounce|ping|pulse)\b/g,
    fix: "No bounce, ping or pulse. For loading, use <Skeleton /> or <Spinner />.",
  },
  {
    id: "font-weight",
    level: "warn",
    re: /\bfont-(?:bold|extrabold|black)\b/g,
    fix: "Use font-medium or font-semibold. Bold weights look heavy.",
  },
  {
    id: "huge-text",
    level: "warn",
    re: /\btext-(?:6xl|7xl|8xl|9xl)\b/g,
    fix: "Too big. Page titles: text-2xl. Landing hero: text-4xl sm:text-5xl at most.",
  },
  {
    id: "raw-element",
    level: "warn",
    re: /<(?:button|input|select|textarea|table)\b/g,
    skipLine: /type=["']hidden["']/,
    fix: "Use the component from components/ui (Button, Input, Select, Textarea, Table). It already has the right style and states.",
  },
  {
    id: "dark-color",
    level: "warn",
    css: true,
    re: /\bdark:(?:bg|text|border|ring|fill|stroke|from|via|to)-/g,
    fix: "Tokens already switch in dark mode. Remove the dark: color class and use a token.",
  },
  {
    id: "inline-color-style",
    level: "warn",
    re: /style=\{\{[^}]*\b(?:color|background|backgroundColor|backgroundImage|borderColor|boxShadow|fill|stroke)\s*:/g,
    fix: "No inline color styles. Use a token class. (For a dynamic chart color, use a CSS variable.)",
  },
  {
    id: "placeholder-text",
    level: "warn",
    re: /\b(?:[Ll]orem [Ii]psum|John Doe|Jane Doe|Acme(?: Inc| Corp)?\b|Your (?:Name|Company|App|Product|Logo)\b|Sample (?:Text|Title)\b|Placeholder (?:Text|Title)\b)/g,
    fix: "Placeholder copy. Write real, specific content for this app.",
  },
  {
    id: "ai-copy",
    level: "warn",
    re: /\b(?:Supercharge|Unlock the power|Seamless(?:ly)?|Elevate your|Revolutioni[sz]e|Cutting-edge|Next-gen(?:eration)?|Game-chang(?:er|ing)|Streamline your|Empower(?:s|ing)? your|All-in-one|Effortless(?:ly)?|Welcome to)\b/gi,
    fix: "Generic marketing words. Say plainly what the thing does, in short words.",
  },
  {
    id: "icon-in-tint",
    level: "warn",
    test: (line) =>
      /\brounded(?:-(?:md|lg|xl|full))?\b/.test(line) &&
      /\b(?:size|h)-(?:8|9|10|11|12)\b/.test(line) &&
      /\bitems-center\b/.test(line) &&
      /\bjustify-center\b/.test(line) &&
      /\bbg-(?:primary|secondary|accent|success|warning|info|destructive)(?:\/\d{1,3})?\b/.test(line),
    fix: "Icon in a tinted box or circle. Remove the background. Use a plain icon with text-muted-foreground.",
  },
  {
    id: "eyebrow-caps",
    level: "warn",
    test: (line) => /\buppercase\b/.test(line) && /\btracking-(?:wide|wider|widest)\b/.test(line),
    fix: "Small ALL-CAPS label with wide letter spacing. This is a common AI look. Use sentence case. Remove the label, or write it as text-sm text-muted-foreground.",
  },
  {
    id: "div-onclick",
    level: "warn",
    re: /<(?:div|span)\b[^>]*\bonClick=/g,
    fix: "A clickable div is not accessible. Use <Button> for actions or <Link> for navigation.",
  },
  {
    id: "outline-none",
    level: "warn",
    css: true,
    re: /\b(?:focus(?:-visible)?:)?outline-none\b/g,
    fix: "Do not remove the focus outline. Components already have a focus ring.",
  },
];

const FILE_RULE_FIX = {
  "centered-layout":
    "Many centered blocks. App UI is left-aligned. Center only auth cards, empty states and one hero heading.",
  "table-columns":
    "Too many table columns show on a phone, so the table gets cramped or scrolls sideways. At most 3 columns fit, and only 2 when the rows have an avatar or an email, because those are wide. Hide the least important columns with `hidden sm:table-cell` (on the TableHead and on each TableCell) and show their value as small muted text under the main cell.",
  "accent-headline":
    "One word of a heading is in the accent color. This is a common AI look. Use one color for the whole heading.",
};

const FIX = { ...FILE_RULE_FIX };
for (const r of rules) FIX[r.id] = r.fix;

/* ---------------------------------------------------------- file search */

// Skipped at any depth.
const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "coverage", ".turbo", ".vercel", ".ui-shots"]);
// Skipped only at the top level of the project (a route can legitimately be called "build" or "out").
const SKIP_TOP_DIRS = new Set(["dist", "build", "out", "public"]);
const SKIP_FILE = /(?:\.test\.|\.spec\.|\.stories\.|\.d\.ts$|^tailwind\.config\.|^next\.config\.|^postcss\.config\.)/;
const TOKEN_FILES = new Set(["globals.css", "global.css", "theme.css", "tokens.css"]);
const EXTS = new Set([".tsx", ".jsx", ".mdx", ".css"]);

const toPosix = (p) => p.split("\\").join("/");

function isUiComponent(p) {
  return /(?:^|\/)components\/ui\//.test(toPosix(p));
}

function wanted(path) {
  const name = path.split(/[\\/]/).pop();
  if (!EXTS.has(extname(path))) return false;
  if (SKIP_FILE.test(name)) return false;
  if (TOKEN_FILES.has(name)) return false;
  if (!flags.has("--include-ui") && isUiComponent(relative(cwd, resolve(path)))) return false;
  return true;
}

function walk(dir, out) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      if (resolve(dir) === cwd && SKIP_TOP_DIRS.has(e.name)) continue;
      walk(join(dir, e.name), out);
    } else if (wanted(join(dir, e.name))) {
      out.add(join(dir, e.name));
    }
  }
}

function changedFiles() {
  let root;
  let status;
  try {
    root = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    status = execFileSync("git", ["status", "--porcelain", "-uall"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    console.error("--changed needs a git repository. Run without --changed instead.");
    process.exit(2);
  }
  const files = new Set();
  for (const line of status.split("\n")) {
    if (!line.trim()) continue;
    let p = line.slice(3);
    if (p.includes(" -> ")) p = p.split(" -> ")[1];
    p = p.replace(/^"|"$/g, "");
    const abs = resolve(root, p);
    if (!existsSync(abs) || !statSync(abs).isFile()) continue;
    const rel = relative(cwd, abs);
    if (rel.startsWith("..")) continue;
    const segs = toPosix(rel).split("/");
    if (segs.some((seg) => SKIP_DIRS.has(seg)) || SKIP_TOP_DIRS.has(segs[0])) continue;
    if (wanted(abs)) files.add(rel);
  }
  return files;
}

function collectFiles() {
  if (flags.has("--changed")) return changedFiles();
  const files = new Set();
  const roots = targets.length ? targets : ["app", "src", "components", "pages"];
  for (const t of roots) {
    const abs = resolve(cwd, t);
    if (!existsSync(abs)) {
      if (targets.length) {
        console.error(`Path not found: ${t}`);
        process.exit(2);
      }
      continue;
    }
    if (statSync(abs).isDirectory()) walk(abs, files);
    else if (wanted(abs)) files.add(abs);
  }
  return files;
}

/* ------------------------------------------------------------- scanning */

function stripComments(text, isCss) {
  // Blank out comments but keep line breaks, so line numbers stay correct.
  let out = text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
  if (!isCss) {
    out = out.replace(/(^|[ \t])\/\/.*$/gm, (m, lead) => lead + " ".repeat(m.length - lead.length));
  }
  return out;
}

const ignoredAt = (rawLines, i) =>
  rawLines[i].includes("ui-check-ignore") || (i > 0 && rawLines[i - 1].includes("ui-check-ignore"));

// Rules that need the whole file, because the thing they look for can span several lines.
// `text` has its comments blanked out but is the same length as the file, so indexes line up.
const HIDDEN_ON_PHONE = /(?<![:\w-])hidden(?![\w-])|\bmax-(?:sm|md):hidden\b/;
const NARROW_COLUMN = /\bw-(?:px|[1-9]|1[0-2])(?![\w.-])/; // w-px to w-12: an icon or actions column
const ACCENT_HEADLINE = /<h[1-3]\b[^>]*>(?:(?!<\/h[1-3]>)[\s\S])*?<(?:span|em|strong|mark|i|b)\b[^>]*\btext-primary(?![\w-])/g;

function fileChecks(text, rawLines, shown, issues) {
  const lineOf = (index) => text.slice(0, index).split("\n").length;
  // `index` is where the problem is reported. `from` is where the element starts.
  // A `ui-check-ignore` comment anywhere from the line above `from` down to the reported line silences it.
  const push = (index, id, hit, from = index) => {
    const before = text.slice(0, index);
    const line = before.split("\n").length;
    for (let i = Math.max(0, lineOf(from) - 2); i < line; i++) {
      if (rawLines[i].includes("ui-check-ignore")) return;
    }
    issues.push({ file: shown, line, col: index - before.lastIndexOf("\n"), level: "warn", id, text: hit });
  };

  const tableStarts = [...text.matchAll(/<Table(?=[\s>])/g)].map((m) => m.index);

  // Too many columns that stay visible on a phone.
  for (const header of text.matchAll(/<TableHeader\b[\s\S]*?<\/TableHeader>/g)) {
    let visible = 0;
    for (const cell of header[0].matchAll(/<TableHead\b([^>]*?)(?:\/>|>([\s\S]*?)<\/TableHead>)/g)) {
      const attrs = cell[1];
      const inner = cell[2] ?? "";
      const label = inner.replace(/<[^>]*>/g, "").trim();
      if (HIDDEN_ON_PHONE.test(attrs)) continue;
      if (NARROW_COLUMN.test(attrs) || /\bsr-only\b/.test(inner) || label === "") continue;
      visible++;
    }
    const table = tableStarts.filter((s) => s < header.index).pop() ?? header.index;
    const end = text.indexOf("</Table>", header.index);
    // An avatar or an email in the rows makes the first column wide, so fewer columns fit on a phone.
    const wide = /<Avatar\b|\.email\b/.test(text.slice(table, end === -1 ? text.length : end));
    if (visible > (wide ? 2 : 3)) {
      const why = wide ? ", but the rows have an avatar or an email, so 2 is the most" : "";
      push(header.index, "table-columns", `${visible} columns show on a phone${why}`, table);
    }
  }

  // One word of a heading in the accent color.
  for (const m of text.matchAll(ACCENT_HEADLINE)) {
    push(m.index + m[0].lastIndexOf("<"), "accent-headline", "accent color on part of a heading", m.index);
  }
}

function scanFile(file, issues) {
  const text = readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  const rawLines = text.split("\n");
  if (rawLines.slice(0, 5).some((l) => l.includes("ui-check-ignore-file"))) return;
  const isCss = extname(file) === ".css";
  const stripped = stripComments(text, isCss);
  const lines = stripped.split("\n");
  const shown = toPosix(relative(cwd, resolve(file)));
  let centered = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    if (ignoredAt(rawLines, i)) continue;

    centered += (line.match(/\btext-center\b/g) || []).length;

    for (const rule of rules) {
      if (isCss && !rule.css && !rule.cssOnly) continue;
      if (rule.cssOnly && !isCss) continue;
      if (rule.skipLine && rule.skipLine.test(line)) continue;
      if (rule.test) {
        if (rule.test(line)) {
          issues.push({ file: shown, line: i + 1, col: 1, level: rule.level, id: rule.id, text: line.trim().slice(0, 70) });
        }
        continue;
      }
      for (const m of line.matchAll(rule.re)) {
        const hit = m[1] ?? m[0];
        if (rule.ok && rule.ok(hit)) continue;
        issues.push({
          file: shown,
          line: i + 1,
          col: m.index + m[0].indexOf(hit) + 1,
          level: rule.level,
          id: rule.id,
          text: hit,
        });
      }
    }
  }

  if (!isCss && centered > 4) {
    issues.push({ file: shown, line: 1, col: 1, level: "warn", id: "centered-layout", text: `text-center used ${centered} times` });
  }
  if (!isCss) fileChecks(stripped, rawLines, shown, issues);
}

/* ---------------------------------------------------------------- setup */

function setupProblems() {
  const problems = [];
  if (!["components/ui", "src/components/ui"].some((d) => existsSync(join(cwd, d)))) {
    problems.push("components/ui/ is missing (shadcn/ui is not set up).");
  }
  const cssCandidates = [
    "app/globals.css", "src/app/globals.css", "styles/globals.css", "src/styles/globals.css", "app/global.css", "src/app/global.css",
  ];
  const css = cssCandidates.find((f) => existsSync(join(cwd, f)));
  if (!css) {
    problems.push("Could not find globals.css.");
  } else {
    const text = readFileSync(join(cwd, css), "utf8");
    if (!/--success\s*:/.test(text) || !/--color-success\s*:/.test(text)) {
      problems.push(`${css} has no --success token (the ui-polish tokens are not installed).`);
    }
  }
  return problems;
}

/* ----------------------------------------------------------------- main */

const problems = flags.has("--skip-setup") ? [] : setupProblems();
const files = [...collectFiles()].sort();
const issues = [];
for (const f of files) scanFile(f, issues);

const fails = issues.filter((i) => i.level === "fail").length;
const warns = issues.length - fails;

if (flags.has("--json")) {
  console.log(JSON.stringify({ files: files.length, setupProblems: problems, fails, warns, issues }, null, 2));
  process.exit(problems.length ? 2 : fails ? 1 : 0);
}

console.log(`ui-polish check: ${files.length} file${files.length === 1 ? "" : "s"} scanned`);

if (problems.length) {
  console.log("\nSETUP NEEDED. Do references/setup.md first:");
  for (const p of problems) console.log(`  - ${p}`);
}

let printed = 0;
const byFile = new Map();
for (const i of issues) {
  if (!byFile.has(i.file)) byFile.set(i.file, []);
  byFile.get(i.file).push(i);
}
for (const [file, list] of byFile) {
  if (printed >= MAX_TOTAL) break;
  list.sort((a, b) => a.line - b.line || a.col - b.col);
  console.log(`\n${file}`);
  for (const i of list.slice(0, MAX_PER_FILE)) {
    if (printed >= MAX_TOTAL) break;
    console.log(`  ${i.line}:${i.col}  ${i.level.toUpperCase().padEnd(4)}  ${i.id.padEnd(18)} ${i.text}`);
    printed++;
  }
  if (list.length > MAX_PER_FILE) console.log(`  ... and ${list.length - MAX_PER_FILE} more in this file`);
}
if (issues.length > printed) console.log(`\n(${issues.length - printed} more issues not shown. Fix these and run again.)`);

if (issues.length) {
  console.log("\nHow to fix:");
  for (const id of [...new Set(issues.map((i) => i.id))]) console.log(`  ${id}: ${FIX[id]}`);
}

console.log("");
if (fails) {
  console.log(`FAIL: ${fails} to fix, ${warns} warning${warns === 1 ? "" : "s"}. Fix every FAIL and run the check again.`);
} else if (warns) {
  console.log(`PASS with ${warns} warning${warns === 1 ? "" : "s"}. Fix them unless you have a clear reason not to.`);
} else if (!problems.length) {
  console.log("PASS: no problems found.");
}

process.exit(problems.length ? 2 : fails ? 1 : 0);
