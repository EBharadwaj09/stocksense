// Turns ESLint JSON output into GitHub annotations so failures are readable via the API.
import { readFileSync } from "node:fs";
import { relative } from "node:path";

const results = JSON.parse(readFileSync(process.argv[2], "utf8"));
let errors = 0;
for (const file of results) {
  for (const m of file.messages) {
    const level = m.severity === 2 ? "error" : "warning";
    if (m.severity === 2) errors++;
    const path = relative(process.cwd() + "/../..", file.filePath);
    console.log(`::${level} file=${path},line=${m.line ?? 1},col=${m.column ?? 1}::${(m.ruleId ?? "eslint")}: ${m.message}`);
  }
}
process.exit(errors > 0 ? 1 : 0);
