import type { JSX } from "solid-js";
import { cn } from "../cn";

export type InputProps = {
  readonly id?: string;
  readonly name?: string;
  readonly type?: "text" | "email" | "password";
  readonly value: string;
  readonly placeholder?: string;
  readonly autocomplete?: string;
  readonly disabled?: boolean;
  readonly required?: boolean;
  readonly hasError?: boolean;
  readonly class?: string;
  readonly onInput: (value: string) => void;
};

export const Input = (props: InputProps): JSX.Element => (
  <input
    id={props.id}
    name={props.name}
    type={props.type ?? "text"}
    value={props.value}
    placeholder={props.placeholder}
    autocomplete={props.autocomplete}
    disabled={props.disabled}
    required={props.required}
    aria-invalid={props.hasError ? "true" : "false"}
    onInput={(event) => props.onInput(event.currentTarget.value)}
    class={cn(
      "w-full rounded-lg border bg-surface-card px-3.5 py-2 text-sm text-text-primary placeholder:text-text-muted transition-all outline-none",
      "focus-visible:border-brand-500 focus-visible:ring-3 focus-visible:ring-brand-500/15",
      "disabled:cursor-not-allowed disabled:bg-surface-subtle disabled:opacity-60",
      "dark:bg-slate-900 dark:text-slate-100",
      props.hasError
        ? "border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/15"
        : "border-border-subtle dark:border-slate-700",
      props.class,
    )}
  />
);

