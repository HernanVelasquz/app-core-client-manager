import { createSignal } from "solid-js";
import {
  RequestPasswordResetCommand,
  SignInWithPasswordCommand,
} from "@/modules/iam/application";
import { useIamAuth } from "@/modules/iam/presentation/state";
import type { SignInViewModel } from "./sign-in.model";

const mapAuthErrorToUserMessage = (error: unknown): string => {
  if (error instanceof Error) {
    if (error.name === "InvalidCredentialsError") {
      return "El correo electrónico o la contraseña son incorrectos.";
    }
    if (error.name === "InactiveUserProfileError") {
      return "Tu perfil de usuario se encuentra inactivo. Contacta al administrador.";
    }
    if (error.name === "ProfileNotFoundError") {
      return "No se encontró un perfil activo asociado a esta cuenta.";
    }
    if (error.name === "InvalidArgumentError") {
      return "Ingresa un correo electrónico válido y una contraseña de al menos 8 caracteres.";
    }
    return error.message;
  }
  return "No fue posible iniciar sesión. Intenta nuevamente.";
};

export const useSignIn = (): SignInViewModel => {
  const auth = useIamAuth();
  const [email, setEmail] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [keepSignedIn, setKeepSignedIn] = createSignal(true);
  const [isSubmitting, setIsSubmitting] = createSignal(false);
  const [errorMessage, setErrorMessage] = createSignal<string | null>(null);
  const [infoMessage, setInfoMessage] = createSignal<string | null>(null);

  const onEmailChange = (value: string): void => {
    setEmail(value);
    if (errorMessage() !== null) {
      setErrorMessage(null);
    }
  };

  const onPasswordChange = (value: string): void => {
    setPassword(value);
    if (errorMessage() !== null) {
      setErrorMessage(null);
    }
  };

  const onSubmit = async (): Promise<void> => {
    setErrorMessage(null);
    setInfoMessage(null);
    setIsSubmitting(true);

    try {
        const command = new SignInWithPasswordCommand({
          email: email(),
          password: password(),
          keepSignedIn: keepSignedIn(),
        });
        const profile = await auth.useCases.signInWithPassword(command);
        auth.setAuthenticatedProfile(profile);
      } catch (error: unknown) {
        setErrorMessage(mapAuthErrorToUserMessage(error));
      } finally {
        setIsSubmitting(false);
      }
    };

    const onForgotPassword = async (): Promise<void> => {
      setErrorMessage(null);
      setInfoMessage(null);

      if (email().trim().length === 0) {
        setErrorMessage("Ingresa tu correo electrónico para recuperar tu contraseña.");
        return;
      }

      setIsSubmitting(true);
      try {
        const command = new RequestPasswordResetCommand({ email: email() });
        await auth.useCases.requestPasswordReset(command);
        setInfoMessage(
          "Si el correo está registrado, recibirás las instrucciones para restablecer tu contraseña.",
        );
      } catch (error: unknown) {
        setErrorMessage(mapAuthErrorToUserMessage(error));
      } finally {
        setIsSubmitting(false);
      }
    };

    return {
      email,
      password,
      keepSignedIn,
      isSubmitting,
      errorMessage,
      infoMessage,
      onEmailChange,
      onPasswordChange,
      onKeepSignedInChange: setKeepSignedIn,
      onForgotPassword,
      onSubmit,
    };
  };
