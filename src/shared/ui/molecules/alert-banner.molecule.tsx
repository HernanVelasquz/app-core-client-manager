import type { JSX } from "solid-js";
import { cn } from "../cn";

export type AlertBannerTone = "error" | "info" | "success";

export type AlertBannerProps = {
  readonly message: string;
  readonly tone?: AlertBannerTone;
  readonly class?: string;
};

export const AlertBanner = (props: AlertBannerProps): JSX.Element => (
  <div
    role="alert"
    class={cn(
      "rounded-lg border px-3.5 py-2.5 text-xs font-medium",
      (props.tone ?? "error") === "error" &&
        "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-300",
      props.tone === "info" &&
        "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/50 dark:text-blue-300",
      props.tone === "success" &&
        "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/50 dark:text-emerald-300",
      props.class,
    )}
  >
    {props.message}
  </div>
);

