import type { Metadata } from "next";
import { todayInIndia } from "@/lib/schemas";
import { requireOwner } from "@/lib/shop";
import { ImportClient } from "./ImportClient";

export const metadata: Metadata = { title: "Import sales" };

export default async function ImportPage() {
  await requireOwner();
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-900">Import past sales</h1>
        <p className="mt-1 text-slate-600">
          Upload your sales history from a spreadsheet. The more history, the better the demand forecasts will be.
        </p>
      </div>
      <ImportClient today={todayInIndia()} />
    </div>
  );
}
