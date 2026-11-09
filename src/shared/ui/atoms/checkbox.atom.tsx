import type { JSX } from "solid-js";
import { cn } from "../cn";

export type CheckboxProps = {
  readonly id?: string;
  readonly checked: boolean;
  readonly disabled?: boolean;
  readonly label: string;
  readonly class?: string;
  readonly onChange: (checked: boolean) => void;
};

export const Checkbox = (props: CheckboxProps): JSX.Element => (
  <label
    for={props.id}
    class={cn(
      "inline-flex cursor-pointer items-center gap-2 select-none text-xs text-text-secondary dark:text-slate-400",
      props.disabled && "cursor-not-allowed opacity-60",
      props.class,
    )}
  >
    <input
      id={props.id}
      type="checkbox"
      checked={props.checked}
      disabled={props.disabled}
      onChange={(event) => props.onChange(event.currentTarget.checked)}
      class="h-4 w-4 rounded border-border-strong accent-brand-500 focus-visible:ring-2 focus-visible:ring-brand-500/30"
    />
    <span>{props.label}</span>
  </label>
);

