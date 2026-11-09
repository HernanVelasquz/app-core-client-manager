export const APP_CORE_SCHEMA = "app_core" as const;

export const APP_CORE_FUNCTIONS = {
  userHasPermission: "user_has_permission",
  isProjectMember: "is_project_member",
  handleUpdatedAt: "handle_updated_at",
  handleNewAuthUser: "handle_new_auth_user",
} as const;

export const IAM_TABLES = {
  permissions: "iam_permissions",
  roles: "iam_roles",
  rolePermissions: "iam_role_permissions",
  profiles: "iam_profiles",
} as const;

export const COMMERCIAL_TABLES = {
  clients: "com_clients",
  quoteTemplates: "com_quote_templates",
  quotes: "com_quotes",
  quoteRequirements: "com_quote_requirements",
  quoteAgreements: "com_quote_agreements",
  quoteAttachments: "com_quote_attachments",
} as const;

export const PROJECT_MANAGEMENT_TABLES = {
  projects: "prj_projects",
  projectMembers: "prj_project_members",
  timelineMilestones: "prj_timeline_milestones",
  projectDocuments: "prj_project_documents",
} as const;

export const WORKBOARD_TABLES = {
  tasks: "wb_tasks",
  taskAttachments: "wb_task_attachments",
} as const;

export const SYSTEM_TABLES = {
  domainEvents: "sys_domain_events",
} as const;
