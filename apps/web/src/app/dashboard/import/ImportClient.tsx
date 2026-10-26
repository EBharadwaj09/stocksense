"use client";

import { useState } from "react";
import { FormAlert } from "@/components/FormAlert";
import { chunk, IMPORT_CHUNK_SIZE, parseSalesCsv, TEMPLATE_CSV, type ParsedImport, type RowError } from "@/lib/import";
import { finishImport, importSalesChunk } from "../actions";

type Phase =
  | { kind: "idle" }
  | { kind: "checked"; fileName: string; parsed: Extract<ParsedImport, { ok: true }> }
  | { kind: "importing"; done: number; total: number }
  | { kind: "finished"; inserted: number; createdProducts: number; errors: RowError[]; seconds: number }
  | { kind: "failed"; message: string };

const MAX_FILE_BYTES = 10 * 1024 * 1024;

function downloadCsv(name: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function errorsCsv(errors: RowError[]): string {
  return ["row,problem", ...errors.map((e) => `${e.row},"${e.error.replace(/"/g, '""')}"`)].join("\n");
}

export function ImportClient({ today }: { today: string }) {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [createMissing, setCreateMissing] = useState(true);

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setPhase({ kind: "failed", message: "That file is larger than 10 MB. Split it into smaller files." });
      return;
    }
    const parsed = parseSalesCsv(await file.text(), today);
    if (!parsed.ok) setPhase({ kind: "failed", message: parsed.message });
    else setPhase({ kind: "checked", fileName: file.name, parsed });
  }

  async function runImport(parsed: Extract<ParsedImport, { ok: true }>) {
    const started = performance.now();
    const batches = chunk(parsed.rows, IMPORT_CHUNK_SIZE);
    let inserted = 0;
    let createdProducts = 0;
    const errors: RowError[] = [...parsed.errors];

    setPhase({ kind: "importing", done: 0, total: parsed.rows.length });
    for (let i = 0; i < batches.length; i++) {
      let result: Awaited<ReturnType<typeof importSalesChunk>>;
      try {
        result = await importSalesChunk(batches[i], createMissing);
      } catch {
        result = { ok: false as const, message: "Connection problem during import." };
      }
      if (!result.ok) {
        setPhase({
          kind: "failed",
          message: `${result.message} ${inserted.toLocaleString("en-IN")} rows were imported before this happened; the rest were not.`,
        });
        await finishImport();
        return;
      }
      inserted += result.inserted;
      createdProducts += result.createdProducts;
      errors.push(...result.errors);
      setPhase({ kind: "importing", done: Math.min((i + 1) * IMPORT_CHUNK_SIZE, parsed.rows.length), total: parsed.rows.length });
    }
    await finishImport();
    errors.sort((a, b) => a.row - b.row);
    setPhase({ kind: "finished", inserted, createdProducts, errors, seconds: (performance.now() - started) / 1000 });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="font-semibold text-brand-900">1. Prepare your file</h2>
        <p className="mt-1 text-sm text-slate-600">
          A CSV with columns <strong>date</strong>, <strong>quantity</strong>, and <strong>sku</strong> or <strong>product</strong> (price is
          optional). Dates can be 2026-01-31 or 31/01/2026. In Excel or Google Sheets, use <em>File → Download → CSV</em>.
        </p>
        <button
          type="button"
          onClick={() => downloadCsv("stocksense-sales-template.csv", TEMPLATE_CSV)}
          className="mt-3 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50"
        >
          Download template
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="font-semibold text-brand-900">2. Choose the file</h2>
        <label htmlFor="csv-file" className="mt-3 block text-sm font-medium text-slate-800">
          Sales file (.csv, up to 50,000 rows)
        </label>
        <input
          id="csv-file"
          type="file"
          accept=".csv,text/csv"
          disabled={phase.kind === "importing"}
          onChange={(e) => onFile(e.target.files?.[0])}
          className="mt-1 block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:font-medium file:text-brand-900"
        />
      </div>

      <div aria-live="polite">
        {phase.kind === "failed" ? <FormAlert tone="error">{phase.message}</FormAlert> : null}

        {phase.kind === "checked" ? (
          <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="font-semibold text-brand-900">3. Check and import</h2>
            <p className="text-sm text-slate-700">
              <strong>{phase.fileName}</strong>: {phase.parsed.totalRows.toLocaleString("en-IN")} rows —{" "}
              <span className="text-brand-700">{phase.parsed.rows.length.toLocaleString("en-IN")} ready</span>
              {phase.parsed.errors.length > 0 ? (
                <span className="text-red-700">, {phase.parsed.errors.length.toLocaleString("en-IN")} with problems (skipped)</span>
              ) : null}
              .
            </p>
            {phase.parsed.errors.length > 0 ? <ErrorList errors={phase.parsed.errors} /> : null}
            <label className="flex items-start gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={createMissing} onChange={(e) => setCreateMissing(e.target.checked)} className="mt-1" />
              <span>Create products that don&apos;t exist yet (matched by code, or by name when there&apos;s no code)</span>
            </label>
            <p className="text-sm text-slate-600">Imported sales are history for forecasting. They don&apos;t change current stock.</p>
            <button
              type="button"
              disabled={phase.parsed.rows.length === 0}
              onClick={() => runImport(phase.parsed)}
              className="rounded-lg bg-brand-600 px-4 py-2.5 font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              Import {phase.parsed.rows.length.toLocaleString("en-IN")} rows
            </button>
          </div>
        ) : null}

        {phase.kind === "importing" ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <p className="text-sm font-medium text-slate-800">
              Importing… {phase.done.toLocaleString("en-IN")} of {phase.total.toLocaleString("en-IN")}
            </p>
            <progress className="mt-2 w-full" value={phase.done} max={phase.total} />
          </div>
        ) : null}

        {phase.kind === "finished" ? (
          <div className="space-y-3 rounded-xl border border-brand-100 bg-brand-50 p-6">
            <p className="font-semibold text-brand-900">
              Imported {phase.inserted.toLocaleString("en-IN")} sales in {phase.seconds.toFixed(1)} s.
            </p>
            {phase.createdProducts > 0 ? (
              <p className="text-sm text-slate-700">Created {phase.createdProducts} new products. Set their reorder points on the Products page.</p>
            ) : null}
            {phase.errors.length > 0 ? <ErrorList errors={phase.errors} /> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ErrorList({ errors }: { errors: RowError[] }) {
  const shown = errors.slice(0, 20);
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm">
      <p className="font-medium text-red-800">{errors.length.toLocaleString("en-IN")} rows skipped:</p>
      <ul className="mt-2 space-y-1 text-red-800">
        {shown.map((e) => (
          <li key={`${e.row}-${e.error}`}>
            Row {e.row}: {e.error}
          </li>
        ))}
      </ul>
      {errors.length > shown.length ? <p className="mt-2 text-red-800">…and {errors.length - shown.length} more.</p> : null}
      <button
        type="button"
        onClick={() => downloadCsv("import-problems.csv", errorsCsv(errors))}
        className="mt-3 rounded-md border border-red-300 bg-white px-3 py-1.5 font-medium text-red-800 hover:bg-red-100"
      >
        Download full list
      </button>
    </div>
  );
}
