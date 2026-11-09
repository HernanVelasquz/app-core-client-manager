import type {
  PerfilUsuario,
  PerfilUsuarioRepository,
  ProfileId,
  UserEmail,
} from "@/modules/iam/domain";
import {
  APP_CORE_SCHEMA,
  IAM_TABLES,
  type AppCoreSupabaseClient,
} from "@/shared/infrastructure";
import {
  IamProfileMapper,
  type IamProfileWithRoleRow,
} from "../mappers/iam-profile.mapper";
import { AuthInfrastructureError } from "./supabase-auth.service";

const PROFILE_SELECT_QUERY = `
  id,
  role_id,
  full_name,
  email,
  avatar_url,
  is_active,
  iam_roles (
    id,
    name,
    iam_role_permissions (
      iam_permissions (
        code
      )
    )
  )
`;

export class SupabasePerfilUsuarioRepository implements PerfilUsuarioRepository {
  public constructor(private readonly client: AppCoreSupabaseClient) { }

  public async findById(id: ProfileId): Promise<PerfilUsuario | null> {
    const { data, error } = await this.client
      .schema(APP_CORE_SCHEMA)
      .from(IAM_TABLES.profiles)
      .select(PROFILE_SELECT_QUERY)
      .eq("id", id.value)
      .maybeSingle<IamProfileWithRoleRow>();

    if (error !== null) {
      throw new AuthInfrastructureError(
        "Error al consultar el perfil de usuario en app_core.iam_profiles.",
      );
    }

    return data !== null ? IamProfileMapper.toDomain(data) : null;
  }

  public async findByEmail(email: UserEmail): Promise<PerfilUsuario | null> {
    const { data, error } = await this.client
      .schema(APP_CORE_SCHEMA)
      .from(IAM_TABLES.profiles)
      .select(PROFILE_SELECT_QUERY)
      .eq("email", email.value)
      .maybeSingle<IamProfileWithRoleRow>();

    if (error !== null) {
      throw new AuthInfrastructureError(
        "Error al consultar el perfil de usuario por correo en app_core.iam_profiles.",
      );
    }

    return data !== null ? IamProfileMapper.toDomain(data) : null;
  }
}
