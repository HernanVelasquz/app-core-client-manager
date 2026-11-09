import type { JSX } from "solid-js";
import { cn } from "../cn";

export type LabelProps = {
  readonly for?: string;
  readonly children: JSX.Element;
  readonly class?: string;
};

export const Label = (props: LabelProps): JSX.Element => (
  <label
    for={props.for}
    class={cn(
      "text-xs font-medium tracking-tight text-text-primary dark:text-slate-200",
      props.class,
    )}
  >
    {props.children}
  </label>
);

