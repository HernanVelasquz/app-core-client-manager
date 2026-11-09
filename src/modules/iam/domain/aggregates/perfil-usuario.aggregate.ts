import { AggregateRoot } from "@/shared/kernel";
import { InactiveUserProfileError } from "../errors";
import { UserAuthenticatedDomainEvent } from "../events";
import {
  PermissionCode,
  ProfileId,
  RoleId,
  RoleName,
  UserActiveStatus,
  UserAvatarUrl,
  UserEmail,
  UserFullName,
} from "../value-objects";

export type PerfilUsuarioPrimitives = {
  readonly id: string;
  readonly roleId: string;
  readonly roleName: string;
  readonly fullName: string;
  readonly email: string;
  readonly avatarUrl: string | null;
  readonly isActive: boolean;
  readonly permissions: readonly string[];
};

export class PerfilUsuario extends AggregateRoot<PerfilUsuarioPrimitives> {
  public constructor(
    public readonly id: ProfileId,
    public readonly roleId: RoleId,
    public readonly roleName: RoleName,
    public readonly fullName: UserFullName,
    public readonly email: UserEmail,
    public readonly avatarUrl: UserAvatarUrl,
    private readonly activeStatus: UserActiveStatus,
    private readonly permissions: readonly PermissionCode[],
  ) {
    super();
  }

  public static fromPrimitives(plain: PerfilUsuarioPrimitives): PerfilUsuario {
    return new PerfilUsuario(
      new ProfileId(plain.id),
      new RoleId(plain.roleId),
      new RoleName(plain.roleName),
      new UserFullName(plain.fullName),
      new UserEmail(plain.email),
      UserAvatarUrl.fromNullable(plain.avatarUrl),
      new UserActiveStatus(plain.isActive),
      plain.permissions.map((code) => new PermissionCode(code)),
    );
  }

  public isActive(): boolean {
    return this.activeStatus.isActive();
  }

  public ensureCanAuthenticate(): void {
    if (!this.activeStatus.isActive()) {
      throw new InactiveUserProfileError(this.email.value);
    }

    this.record(
      new UserAuthenticatedDomainEvent({
        aggregateId: this.id.value,
        email: this.email.value,
        roleName: this.roleName.value,
      }),
    );
  }

  public hasPermission(permission: PermissionCode): boolean {
    return this.permissions.some((assigned) => assigned.equals(permission));
  }

  public toPrimitives(): PerfilUsuarioPrimitives {
    return {
      id: this.id.value,
      roleId: this.roleId.value,
      roleName: this.roleName.value,
      fullName: this.fullName.value,
      email: this.email.value,
      avatarUrl: this.avatarUrl.toNullable(),
      isActive: this.activeStatus.value,
      permissions: this.permissions.map((permission) => permission.value),
    };
  }
}

