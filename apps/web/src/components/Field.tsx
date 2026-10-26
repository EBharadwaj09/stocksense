type FieldProps = {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  defaultValue?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  placeholder?: string;
  inputMode?: "text" | "decimal" | "numeric" | "email";
  max?: string;
};

const inputClass =
  "mt-1 block w-full rounded-lg border bg-white px-3 py-2.5 text-base shadow-sm outline-none focus:border-brand-600";

function describedBy(id: string, hint?: string, error?: string) {
  return [hint && !error ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
}

function Messages({ id, hint, error }: { id: string; hint?: string; error?: string }) {
  return (
    <>
      {hint && !error ? (
        <p id={`${id}-hint`} className="mt-1 text-sm text-slate-600">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </>
  );
}

/** Labelled input with an accessible error message wired via aria-describedby. */
export function Field({
  label,
  name,
  type = "text",
  autoComplete,
  defaultValue,
  error,
  hint,
  required = true,
  placeholder,
  inputMode,
  max,
}: FieldProps) {
  const id = `field-${name}`;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-800">
        {label}
        {!required ? <span className="font-normal text-slate-500"> (optional)</span> : null}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        required={required}
        placeholder={placeholder}
        inputMode={inputMode}
        max={max}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={`${inputClass} ${error ? "border-red-600" : "border-slate-300"}`}
      />
      <Messages id={id} hint={hint} error={error} />
    </div>
  );
}

type SelectProps = {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  defaultValue?: string;
  error?: string;
  hint?: string;
  placeholder?: string;
};

export function SelectField({ label, name, options, defaultValue, error, hint, placeholder }: SelectProps) {
  const id = `field-${name}`;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-800">
        {label}
      </label>
      <select
        id={id}
        name={name}
        defaultValue={defaultValue ?? ""}
        required
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={`${inputClass} ${error ? "border-red-600" : "border-slate-300"}`}
      >
        {placeholder ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <Messages id={id} hint={hint} error={error} />
    </div>
  );
}
