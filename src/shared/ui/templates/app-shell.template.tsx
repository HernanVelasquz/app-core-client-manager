import type { JSX } from "solid-js";

export type AppShellTemplateProps = {
  readonly header?: JSX.Element;
  readonly children: JSX.Element;
};

export const AppShellTemplate = (props: AppShellTemplateProps): JSX.Element => (
  <div class="app-shell">
    {props.header}
    <main>{props.children}</main>
  </div>
);

