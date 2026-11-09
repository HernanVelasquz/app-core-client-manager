import { describe, expect, it } from "vitest";
import { PerfilUsuario } from "../aggregates";
import { InactiveUserProfileError } from "../errors";
import { UserAuthenticatedDomainEvent } from "../events";
import {
  PermissionCode,
  ProfileId,
  RoleId,
  RoleName,
  SystemPermissions,
  UserActiveStatus,
  UserAvatarUrl,
  UserEmail,
  UserFullName,
} from "../value-objects";

describe("PerfilUsuario AggregateRoot", () => {
  const samplePrimitives = {
    id: "550e8400-e29b-41d4-a716-446655440000",
    roleId: "660e8400-e29b-41d4-a716-446655440001",
    roleName: "Administrador",
    fullName: "Hernán Velásquez",
    email: "hernan@focus.studio",
    avatarUrl: "https://cdn.focus.studio/avatars/hernan.png",
    isActive: true,
    permissions: ["ROLE_MANAGE", "USER_MANAGE", "PROJECT_VIEW_ALL"],
  } as const;

  it("debería reconstruir el agregado desde primitivos usando Value Objects en todas sus propiedades", () => {
    const profile = PerfilUsuario.fromPrimitives(samplePrimitives);

    expect(profile.id).toBeInstanceOf(ProfileId);
    expect(profile.roleId).toBeInstanceOf(RoleId);
    expect(profile.roleName).toBeInstanceOf(RoleName);
    expect(profile.fullName).toBeInstanceOf(UserFullName);
    expect(profile.email).toBeInstanceOf(UserEmail);
    expect(profile.avatarUrl).toBeInstanceOf(UserAvatarUrl);
    expect(profile.isActive()).toBe(true);
    expect(profile.toPrimitives()).toEqual(samplePrimitives);
  });

  it("debería verificar permisos mediante el Value Object PermissionCode", () => {
    const profile = PerfilUsuario.fromPrimitives(samplePrimitives);

    expect(profile.hasPermission(new PermissionCode(SystemPermissions.UserManage))).toBe(true);
    expect(profile.hasPermission(new PermissionCode(SystemPermissions.TaskManage))).toBe(false);
  });

  it("debería registrar UserAuthenticatedDomainEvent cuando un perfil activo se autentica", () => {
    const profile = PerfilUsuario.fromPrimitives(samplePrimitives);

    profile.ensureCanAuthenticate();
    const events = profile.pullDomainEvents();

    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(UserAuthenticatedDomainEvent);
    expect(events[0]?.eventName).toBe("iam.user_authenticated");
    expect(events[0]?.aggregateId).toBe(samplePrimitives.id);
  });

  it("debería lanzar InactiveUserProfileError si el perfil tiene UserActiveStatus inactivo", () => {
    const inactiveProfile = new PerfilUsuario(
      new ProfileId(samplePrimitives.id),
      new RoleId(samplePrimitives.roleId),
      new RoleName(samplePrimitives.roleName),
      new UserFullName(samplePrimitives.fullName),
      new UserEmail(samplePrimitives.email),
      UserAvatarUrl.empty(),
      UserActiveStatus.inactive(),
      [],
    );

    expect(() => inactiveProfile.ensureCanAuthenticate()).toThrow(InactiveUserProfileError);
    expect(inactiveProfile.pullDomainEvents()).toHaveLength(0);
  });
});

