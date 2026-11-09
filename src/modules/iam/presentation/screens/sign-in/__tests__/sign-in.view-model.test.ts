import { createRoot } from "solid-js";
import { describe, expect, it } from "vitest";
import { InvalidCredentialsError, type PerfilUsuarioPrimitives } from "@/modules/iam/domain";
import {
  IamAuthProvider,
  useIamAuth,
  type IamUseCasesContract,
} from "@/modules/iam/presentation/state";
import { useSignIn } from "../sign-in.view-model";

const sampleProfile: PerfilUsuarioPrimitives = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  roleId: "660e8400-e29b-41d4-a716-446655440001",
  roleName: "Administrador",
  fullName: "Hernán Velásquez",
  email: "hernan@focus.studio",
  avatarUrl: null,
  isActive: true,
  permissions: ["ROLE_MANAGE", "USER_MANAGE"],
};

describe("useSignIn ViewModel", () => {
  it("debería actualizar el estado autenticado cuando signInWithPassword tiene éxito", async () => {
    const fakeUseCases: IamUseCasesContract = {
      signInWithPassword: async () => sampleProfile,
      getCurrentSessionProfile: async () => null,
      signOutUser: async () => {},
      requestPasswordReset: async () => {},
    };

    await createRoot(async (dispose) => {
      let vmResult: ReturnType<typeof useSignIn> | undefined;
      let authResult: ReturnType<typeof useIamAuth> | undefined;

      const Harness = () =>
        IamAuthProvider({
          useCases: fakeUseCases,
          get children() {
            authResult = useIamAuth();
            vmResult = useSignIn();
            return null;
          },
        });

      Harness();

      vmResult?.onEmailChange("hernan@focus.studio");
      vmResult?.onPasswordChange("FocusStudio2026!");
      await vmResult?.onSubmit();

      expect(vmResult?.errorMessage()).toBeNull();
      expect(authResult?.currentProfile()).toEqual(sampleProfile);
      dispose();
    });
  });

  it("debería exponer un mensaje comprensible cuando las credenciales son inválidas", async () => {
    const fakeUseCases: IamUseCasesContract = {
      signInWithPassword: async () => {
        throw new InvalidCredentialsError();
      },
      getCurrentSessionProfile: async () => null,
      signOutUser: async () => {},
      requestPasswordReset: async () => {},
    };

    await createRoot(async (dispose) => {
      let vmResult: ReturnType<typeof useSignIn> | undefined;

      const Harness = () =>
        IamAuthProvider({
          useCases: fakeUseCases,
          get children() {
            vmResult = useSignIn();
            return null;
          },
        });

      Harness();

      vmResult?.onEmailChange("hernan@focus.studio");
      vmResult?.onPasswordChange("WrongPass123!");
      await vmResult?.onSubmit();

      expect(vmResult?.errorMessage()).toBe(
        "El correo electrónico o la contraseña son incorrectos.",
      );
      dispose();
    });
  });
});

