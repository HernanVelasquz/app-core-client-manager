import { Show, type JSX } from "solid-js";
import { cn } from "../cn";

export type ButtonVariant = "primary" | "secondary" | "ghost";

export type ButtonProps = {
  readonly type?: "button" | "submit" | "reset";
  readonly variant?: ButtonVariant;
  readonly disabled?: boolean;
  readonly isLoading?: boolean;
  readonly fullWidth?: boolean;
  readonly class?: string;
  readonly children: JSX.Element;
  readonly onClick?: () => void;
};

export const Button = (props: ButtonProps): JSX.Element => (
  <button
    type={props.type ?? "button"}
    disabled={props.disabled || props.isLoading}
    onClick={() => props.onClick?.()}
    class={cn(
      "inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors outline-none",
      "focus-visible:ring-3 focus-visible:ring-brand-500/25",
      "disabled:cursor-not-allowed disabled:opacity-60",
      props.fullWidth && "w-full",
      (props.variant ?? "primary") === "primary" &&
        "bg-brand-500 text-white shadow-xs hover:bg-brand-600 active:bg-brand-700",
      props.variant === "secondary" &&
        "border border-border-subtle bg-surface-subtle text-text-primary hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100",
      props.variant === "ghost" &&
        "bg-transparent text-brand-500 hover:text-brand-600 dark:text-brand-200",
      props.class,
    )}
  >
    <Show when={props.isLoading}>
      <span
        aria-hidden="true"
        class="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
      />
    </Show>
    {props.children}
  </button>
);

