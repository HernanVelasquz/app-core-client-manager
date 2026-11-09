export type ClassValue = string | undefined | null | false;

export const cn = (...inputs: readonly ClassValue[]): string =>
  inputs
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ");

