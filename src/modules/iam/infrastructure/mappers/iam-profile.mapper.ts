import { PerfilUsuario, type PerfilUsuarioPrimitives } from "@/modules/iam/domain";

export type IamPermissionJoinRow = {
  readonly code: string;
};

export type IamRolePermissionJoinRow = {
  readonly iam_permissions: IamPermissionJoinRow | readonly IamPermissionJoinRow[] | null;
};

export type IamRoleJoinRow = {
  readonly id: string;
  readonly name: string;
  readonly iam_role_permissions?: readonly IamRolePermissionJoinRow[] | null;
};

export type IamProfileWithRoleRow = {
  readonly id: string;
  readonly role_id: string;
  readonly full_name: string;
  readonly email: string;
  readonly avatar_url: string | null;
  readonly is_active: boolean;
  readonly iam_roles: IamRoleJoinRow | readonly IamRoleJoinRow[] | null;
};

export class IamProfileMapper {
  public static toDomain(row: IamProfileWithRoleRow): PerfilUsuario {
    const roleJoin = IamProfileMapper.extractRoleJoin(row.iam_roles);
    const roleName = roleJoin?.name ?? "Desarrollador";
    const permissions = IamProfileMapper.extractPermissionCodes(roleJoin);

    const primitives: PerfilUsuarioPrimitives = {
      id: row.id,
      roleId: row.role_id,
      roleName,
      fullName: row.full_name,
      email: row.email,
      avatarUrl: row.avatar_url,
      isActive: row.is_active,
      permissions,
    };

    return PerfilUsuario.fromPrimitives(primitives);
  }

  private static extractRoleJoin(
    rolesRelation: IamProfileWithRoleRow["iam_roles"],
  ): IamRoleJoinRow | null {
    if (rolesRelation === null) {
      return null;
    }
    if (Array.isArray(rolesRelation)) {
      const firstRole = rolesRelation[0];
      return firstRole !== undefined ? firstRole : null;
    }
    return rolesRelation as IamRoleJoinRow;
  }

  private static extractPermissionCodes(roleJoin: IamRoleJoinRow | null): readonly string[] {
    if (roleJoin === null || !Array.isArray(roleJoin.iam_role_permissions)) {
      return [];
    }

    const codes: string[] = [];
    for (const item of roleJoin.iam_role_permissions) {
      const permRelation = item.iam_permissions;
      if (permRelation === null) {
        continue;
      }
      if (Array.isArray(permRelation)) {
        for (const perm of permRelation) {
          codes.push(perm.code);
        }
      } else {
        codes.push((permRelation as IamPermissionJoinRow).code);
      }
    }
    return codes;
  }
}
