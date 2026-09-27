import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const entry = path.join(root, "app/globals.css");
const raw = fs.readFileSync(entry, "utf8");
const withoutComments = raw.replace(/\/\*[\s\S]*?\*\//g, "").trim();
const imports = withoutComments.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
const problems = [];

for (const line of imports) {
  const match = /^@import\s+["'](\.\.\/styles\/[^"']+\.css)["'];$/.exec(line);
  if (!match) {
    problems.push("app/globals.css must contain only relative styles imports: " + line);
    continue;
  }
  if (!fs.existsSync(path.resolve(path.dirname(entry), match[1]))) {
    problems.push("Missing CSS module: " + match[1]);
  }
}

const operations = fs.readFileSync(path.join(root, "lib/ledger-operations.ts"), "utf8");
for (const name of ["react", "next/", "@/hooks/", "@/components/", "@/app/", "@/lib/storage"]) {
  if (operations.split(/\r?\n/).some((line) => /^import\s/.test(line) && line.includes(name))) {
    problems.push("ledger-operations.ts cannot import " + name);
  }
}

if (problems.length) {
  for (const problem of problems) console.error("Architecture violation:", problem);
  process.exitCode = 1;
} else {
  console.log("Architecture check passed:", imports.length, "CSS modules, pure ledger boundary");
}

