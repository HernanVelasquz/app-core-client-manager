import { InvalidArgumentError, StringValueObject } from "@/shared/kernel";

const PERMISSION_CODE_PATTERN = /^[A-Z][A-Z0-9_]{1,99}$/;

export enum SystemPermissions {
  RoleManage = "ROLE_MANAGE",
  UserManage = "USER_MANAGE",
  ClientManage = "CLIENT_MANAGE",
  QuoteManage = "QUOTE_MANAGE",
  ProjectCreate = "PROJECT_CREATE",
  ProjectAssignTeam = "PROJECT_ASSIGN_TEAM",
  ProjectViewAll = "PROJECT_VIEW_ALL",
  ProjectViewAssignedOnly = "PROJECT_VIEW_ASSIGNED_ONLY",
  TaskManage = "TASK_MANAGE",
}

export class PermissionCode extends StringValueObject {
  public constructor(value: string) {
    const normalized = typeof value === "string" ? value.trim().toUpperCase() : value;
    super(normalized);
    this.ensureIsValidPermissionCode(normalized);
  }

  private ensureIsValidPermissionCode(value: string): void {
    if (!PERMISSION_CODE_PATTERN.test(value)) {
      throw new InvalidArgumentError(`The permission code <${value}> is invalid`);
    }
  }
}

