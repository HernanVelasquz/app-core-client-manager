import type { JSX } from "solid-js";
import { cn } from "../cn";

export type AppShellTemplateProps = {
  readonly header?: JSX.Element;
  readonly children: JSX.Element;
  readonly class?: string;
};

export const AppShellTemplate = (props: AppShellTemplateProps): JSX.Element => (
    <div
      class={cn(
        "min-h-screen bg-surface-canvas font-sans text-text-primary antialiased dark:bg-slate-950 dark:text-slate-100",
        props.class,
      )}
    >
      {props.header}
      <main>{props.children}</main>
    </div>
    );


