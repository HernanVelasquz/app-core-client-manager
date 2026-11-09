import { Show, type JSX } from "solid-js";
import { BrandMark } from "@/shared/ui";

export type AuthScreenTemplateProps = {
  readonly title: string;
  readonly subtitle: string;
  readonly children: JSX.Element;
  readonly footer?: JSX.Element;
};

export const AuthScreenTemplate = (props: AuthScreenTemplateProps): JSX.Element => (
  <div class="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-surface-canvas px-4 py-12 dark:bg-slate-950">
    {/* Difuminados radiales ambientales inspirados en el diseño de Focus Studio */}
    <div
      aria-hidden="true"
      class="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-brand-100/70 blur-3xl dark:bg-brand-700/15"
    />
    <div
      aria-hidden="true"
      class="pointer-events-none absolute -right-32 -bottom-32 h-96 w-96 rounded-full bg-brand-100/60 blur-3xl dark:bg-brand-600/15"
    />

    <div class="relative z-10 flex w-full max-w-sm flex-col items-center">
      <header class="mb-6 flex flex-col items-center text-center">
        <BrandMark class="mb-3.5" />
        <h1 class="text-lg font-semibold tracking-tight text-text-primary dark:text-slate-100">
          {props.title}
        </h1>
        <p class="mt-1 text-xs text-text-secondary dark:text-slate-400">
          {props.subtitle}
        </p>
      </header>

      <div class="w-full">{props.children}</div>

      <Show when={props.footer}>
        {(footerContent) => (
          <footer class="mt-5 text-center text-xs text-text-secondary dark:text-slate-400">
            {footerContent()}
          </footer>
        )}
      </Show>
    </div>
  </div>
);

