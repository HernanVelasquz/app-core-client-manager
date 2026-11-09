import type { Accessor } from "solid-js";

export type SignInViewModel = {
  readonly email: Accessor<string>;
  readonly password: Accessor<string>;
  readonly keepSignedIn: Accessor<boolean>;
  readonly isSubmitting: Accessor<boolean>;
  readonly errorMessage: Accessor<string | null>;
  readonly infoMessage: Accessor<string | null>;
  readonly onEmailChange: (value: string) => void;
  readonly onPasswordChange: (value: string) => void;
  readonly onKeepSignedInChange: (checked: boolean) => void;
  readonly onForgotPassword: () => Promise<void>;
  readonly onSubmit: () => Promise<void>;
};

export type SignInScreenProps = {
  readonly viewModel?: SignInViewModel;
};

