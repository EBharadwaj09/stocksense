export function FormAlert({ tone, children }: { tone: "error" | "success"; children: React.ReactNode }) {
  const styles = tone === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-brand-100 bg-brand-50 text-brand-900";
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-lg border px-4 py-3 text-sm ${styles}`}>
      {children}
    </div>
  );
}
