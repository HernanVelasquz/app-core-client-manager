import { describe, expect, it } from "vitest";
import { IamProfileMapper, type IamProfileWithRoleRow } from "../mappers/iam-profile.mapper";

  describe("IamProfileMapper", () => {
    it("debería mapear una fila de app_core.iam_profiles al agregado PerfilUsuario", () => {
      const row: IamProfileWithRoleRow = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        role_id: "660e8400-e29b-41d4-a716-446655440001",
        full_name: "Hernán Velásquez",
        email: "hernan@focus.studio",
        avatar_url: null,
        is_active: true,
        iam_roles: {
          id: "660e8400-e29b-41d4-a716-446655440001",
          name: "Administrador",
          iam_role_permissions: [
            { iam_permissions: { code: "ROLE_MANAGE" } },
            { iam_permissions: { code: "USER_MANAGE" } },
          ],
        },
      };

      const profile = IamProfileMapper.toDomain(row);

      expect(profile.toPrimitives()).toEqual({
        id: "550e8400-e29b-41d4-a716-446655440000",
        roleId: "660e8400-e29b-41d4-a716-446655440001",
        roleName: "Administrador",
        fullName: "Hernán Velásquez",
        email: "hernan@focus.studio",
        avatarUrl: null,
        isActive: true,
        permissions: ["ROLE_MANAGE", "USER_MANAGE"],
      });
    });
  });
