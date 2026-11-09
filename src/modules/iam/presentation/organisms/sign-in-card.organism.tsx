import { Show, type JSX } from "solid-js";
import { AlertBanner, Button, Checkbox, FormField } from "@/shared/ui";

export type SignInCardProps = {
  readonly email: string;
  readonly password: string;
  readonly keepSignedIn: boolean;
  readonly isSubmitting: boolean;
  readonly errorMessage: string | null;
  readonly infoMessage: string | null;
  readonly onEmailChange: (value: string) => void;
  readonly onPasswordChange: (value: string) => void;
  readonly onKeepSignedInChange: (checked: boolean) => void;
  readonly onForgotPassword: () => void;
  readonly onSubmit: () => void;
};

export const SignInCard = (props: SignInCardProps): JSX.Element => {
  const handleFormSubmit = (event: SubmitEvent): void => {
    event.preventDefault();
    props.onSubmit();
  };

  return (
    <div class="w-full rounded-2xl border border-border-subtle/90 bg-surface-card p-6 shadow-card dark:border-slate-800 dark:bg-slate-900">
      <form onSubmit={handleFormSubmit} novalidate class="flex flex-col gap-4">
        <Show when={props.errorMessage}>
          {(message) => <AlertBanner tone="error" message={message()} />}
        </Show>

        <Show when={props.infoMessage}>
          {(message) => <AlertBanner tone="info" message={message()} />}
        </Show>

        <FormField
          id="sign-in-email"
          label="Email"
          type="email"
          value={props.email}
          placeholder="hernan@focus.studio"
          autocomplete="email"
          disabled={props.isSubmitting}
          required
          onInput={props.onEmailChange}
        />

        <FormField
          id="sign-in-password"
          label="Password"
          type="password"
          value={props.password}
          placeholder="••••••••••••"
          autocomplete="current-password"
          disabled={props.isSubmitting}
          required
          onInput={props.onPasswordChange}
          rightAction={
            <button
              type="button"
              disabled={props.isSubmitting}
              onClick={() => props.onForgotPassword()}
              class="cursor-pointer text-xs font-medium text-brand-500 transition-colors hover:text-brand-600 focus-visible:underline outline-none disabled:opacity-60"
            >
              Forgot password?
            </button>
          }
        />

        <div class="pt-0.5">
          <Checkbox
            id="keep-signed-in"
            checked={props.keepSignedIn}
            disabled={props.isSubmitting}
            label="Keep me signed in"
            onChange={props.onKeepSignedInChange}
          />
        </div>

        <div class="pt-1">
          <Button
            type="submit"
            variant="primary"
            fullWidth
            isLoading={props.isSubmitting}
          >
            Sign in
          </Button>
        </div>
      </form>
    </div>
  );
};

