import { Show, type JSX } from "solid-js";
import {
  IamAuthProvider,
  SignInScreen,
  useIamAuth,
} from "@/modules/iam/presentation";
import { AppShellTemplate, BrandMark, Button } from "@/shared/ui";
import { createAppContainer } from "./container";

const appContainer = createAppContainer();

const AuthenticatedWorkspace = (): JSX.Element => {
  const auth = useIamAuth();

  const handleSignOut = async (): Promise<void> => {
    await auth.useCases.signOutUser();
    auth.setAuthenticatedProfile(null);
  };

  return (
    <Show when={auth.currentProfile()} fallback={<SignInScreen />}>
      {(profile) => (
        <AppShellTemplate
          header={
            <header class="flex items-center justify-between border-b border-border-subtle bg-surface-card px-6 py-3.5">
              <div class="flex items-center gap-3">
                <BrandMark class="h-8 w-8 rounded-lg" />
                <div>
                  <span class="text-sm font-semibold text-text-primary">
                    Focus Studio
                  </span>
                  <span class="ml-2 rounded-md bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-600">
                    {profile().roleName}
                  </span>
                </div>
              </div>
              <div class="flex items-center gap-4">
                <div class="text-right">
                  <p class="text-xs font-medium text-text-primary">
                    {profile().fullName}
                  </p>
                  <p class="text-xs text-text-secondary">{profile().email}</p>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => {
                    void handleSignOut();
                  }}
                >
                  Sign out
                </Button>
              </div>
            </header>
          }
        >
          <section class="mx-auto max-w-5xl px-6 py-10">
            <h1 class="text-xl font-semibold text-text-primary">
              Bienvenido, {profile().fullName}
            </h1>
            <p class="mt-1 text-sm text-text-secondary">
              Sesión iniciada correctamente como {profile().roleName} ({profile().email}).
            </p>
          </section>
        </AppShellTemplate>
      )}
    </Show>
  );
};

export const App = (): JSX.Element => (
  <IamAuthProvider useCases={appContainer.iam}>
    <AuthenticatedWorkspace />
  </IamAuthProvider>
);
