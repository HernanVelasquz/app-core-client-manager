import type { JSX } from "solid-js";
import { SignInCard } from "@/modules/iam/presentation/organisms";
import { AuthScreenTemplate } from "@/modules/iam/presentation/templates";
import type { SignInScreenProps } from "./sign-in.model";
import { useSignIn } from "./sign-in.view-model";

export const SignInScreen = (props: SignInScreenProps): JSX.Element => {
  const vm = props.viewModel ?? useSignIn();

  return (
    <AuthScreenTemplate
      title="Sign in to Focus Studio"
      subtitle="Projects, quotes, and contracts in one place."
    >
      <SignInCard
        email={vm.email()}
        password={vm.password()}
        keepSignedIn={vm.keepSignedIn()}
        isSubmitting={vm.isSubmitting()}
        errorMessage={vm.errorMessage()}
        infoMessage={vm.infoMessage()}
        onEmailChange={vm.onEmailChange}
        onPasswordChange={vm.onPasswordChange}
        onKeepSignedInChange={vm.onKeepSignedInChange}
        onForgotPassword={() => {
          void vm.onForgotPassword();
        }}
        onSubmit={() => {
          void vm.onSubmit();
        }}
      />
    </AuthScreenTemplate>
  );
};

