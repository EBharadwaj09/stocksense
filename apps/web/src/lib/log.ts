type Level = "info" | "warn" | "error";

/** Structured JSON logs, readable in Vercel's log viewer and easy to search. */
export function log(level: Level, event: string, fields: Record<string, unknown> = {}) {
  const line = JSON.stringify({ level, event, time: new Date().toISOString(), ...fields });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}
