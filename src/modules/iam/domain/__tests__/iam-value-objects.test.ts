import { describe, expect, it } from "vitest";
import { InvalidArgumentError } from "@/shared/kernel";
import {
  PermissionCode,
  PlainPassword,
  ProfileId,
  RoleId,
  RoleName,
  SystemPermissions,
  UserActiveStatus,
  UserAvatarUrl,
  UserEmail,
  UserFullName,
} from "../value-objects";

describe("IAM Value Objects", () => {
  describe("ProfileId y RoleId", () => {
    it("debería crear un ProfileId válido y comparar igualdad por valor y tipo", () => {
      const rawUuid = "550e8400-e29b-41d4-a716-446655440000";
      const profileIdA = new ProfileId(rawUuid);
      const profileIdB = new ProfileId(rawUuid);
      const roleId = new RoleId(rawUuid);

      expect(profileIdA.value).toBe(rawUuid);
      expect(profileIdA.equals(profileIdB)).toBe(true);
      expect(profileIdA.equals(roleId)).toBe(false);
    });

    it("debería rechazar un UUID con formato inválido", () => {
      expect(() => new ProfileId("not-a-valid-uuid")).toThrow(InvalidArgumentError);
      expect(() => new RoleId("")).toThrow(InvalidArgumentError);
    });
  });

  describe("UserEmail", () => {
    it("debería crear y normalizar un correo electrónico válido", () => {
      const email = new UserEmail("  Hernan@Focus.Studio ");
      expect(email.value).toBe("hernan@focus.studio");
    });

    it("debería rechazar un correo electrónico vacío o con formato inválido", () => {
      expect(() => new UserEmail("")).toThrow(InvalidArgumentError);
      expect(() => new UserEmail("hernan-at-focus.studio")).toThrow(InvalidArgumentError);
      expect(() => new UserEmail("hernan@")).toThrow(InvalidArgumentError);
    });

    it("debería comparar igualdad por valor", () => {
      const first = new UserEmail("hernan@focus.studio");
      const second = new UserEmail("HERNAN@FOCUS.STUDIO");
      expect(first.equals(second)).toBe(true);
    });
  });

  describe("PlainPassword", () => {
    it("debería crear una contraseña válida de al menos 8 caracteres", () => {
      const password = new PlainPassword("FocusStudio2026!");
      expect(password.value).toBe("FocusStudio2026!");
    });

    it("debería rechazar una contraseña vacía o menor a 8 caracteres", () => {
      expect(() => new PlainPassword("")).toThrow(InvalidArgumentError);
      expect(() => new PlainPassword("1234567")).toThrow(InvalidArgumentError);
      expect(() => new PlainPassword("        ")).toThrow(InvalidArgumentError);
    });
  });

  describe("UserFullName y RoleName", () => {
    it("debería crear nombres de usuario y rol válidos", () => {
      const fullName = new UserFullName(" Hernán Velásquez ");
      const roleName = new RoleName(" Administrador ");
      expect(fullName.value).toBe("Hernán Velásquez");
      expect(roleName.value).toBe("Administrador");
    });

    it("debería rechazar nombres vacíos", () => {
      expect(() => new UserFullName("   ")).toThrow(InvalidArgumentError);
      expect(() => new RoleName("")).toThrow(InvalidArgumentError);
    });
  });

  describe("UserAvatarUrl", () => {
    it("debería permitir URLs válidas y valor vacío cuando no tiene avatar", () => {
      const emptyAvatar = UserAvatarUrl.fromNullable(null);
      const httpsAvatar = new UserAvatarUrl("https://cdn.focus.studio/avatars/hernan.png");

      expect(emptyAvatar.hasAvatar()).toBe(false);
      expect(emptyAvatar.toNullable()).toBeNull();
      expect(httpsAvatar.hasAvatar()).toBe(true);
      expect(httpsAvatar.toNullable()).toBe("https://cdn.focus.studio/avatars/hernan.png");
    });

    it("debería rechazar esquemas inválidos en UserAvatarUrl", () => {
      expect(() => new UserAvatarUrl("javascript:alert(1)")).toThrow(InvalidArgumentError);
    });
  });

  describe("UserActiveStatus y PermissionCode", () => {
    it("debería envolver el estado booleano como Value Object", () => {
      const active = UserActiveStatus.active();
      const inactive = UserActiveStatus.inactive();

      expect(active.isActive()).toBe(true);
      expect(inactive.isActive()).toBe(false);
      expect(active.equals(new UserActiveStatus(true))).toBe(true);
      expect(active.equals(inactive)).toBe(false);
    });

    it("debería validar códigos de permiso en mayúsculas", () => {
      const code = new PermissionCode(SystemPermissions.UserManage);
      expect(code.value).toBe("USER_MANAGE");
      expect(() => new PermissionCode("")).toThrow(InvalidArgumentError);
      expect(() => new PermissionCode("123_INVALID")).toThrow(InvalidArgumentError);
    });
  });
});

