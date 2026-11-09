import {
  createContext,
  createSignal,
  useContext,
  type Accessor,
  type JSX,
} from "solid-js";
import type {
  RequestPasswordResetCommand,
  SignInWithPasswordCommand,
} from "@/modules/iam/application";
import type { PerfilUsuarioPrimitives } from "@/modules/iam/domain";

export type IamUseCasesContract = {
  readonly signInWithPassword: (
    command: SignInWithPasswordCommand,
  ) => Promise<PerfilUsuarioPrimitives>;
  readonly getCurrentSessionProfile: () => Promise<PerfilUsuarioPrimitives | null>;
  readonly signOutUser: () => Promise<void>;
  readonly requestPasswordReset: (command: RequestPasswordResetCommand) => Promise<void>;
};

export type IamAuthContextValue = {
  readonly useCases: IamUseCasesContract;
  readonly currentProfile: Accessor<PerfilUsuarioPrimitives | null>;
  readonly setAuthenticatedProfile: (profile: PerfilUsuarioPrimitives | null) => void;
};

const IamAuthContext = createContext<IamAuthContextValue>();

export type IamAuthProviderProps = {
  readonly useCases: IamUseCasesContract;
  readonly initialProfile?: PerfilUsuarioPrimitives | null;
  readonly children: JSX.Element;
};

export const IamAuthProvider = (props: IamAuthProviderProps): JSX.Element => {
  const [currentProfile, setCurrentProfile] = createSignal<PerfilUsuarioPrimitives | null>(
    props.initialProfile ?? null,
  );

  return (
    <IamAuthContext.Provider
      value={{
        useCases: props.useCases,
        currentProfile,
        setAuthenticatedProfile: setCurrentProfile,
      }}
    >
      {props.children}
    </IamAuthContext.Provider>
  );
};

export const useIamAuth = (): IamAuthContextValue => {
  const context = useContext(IamAuthContext);
  if (context === undefined) {
    throw new Error("useIamAuth must be used within an IamAuthProvider");
  }
  return context;
};

export const useIamUseCases = (): IamUseCasesContract => useIamAuth().useCases;

