export const roles = ["OWNER", "ADMIN", "MEMBER", "VIEWER"] as const;
export type Role = (typeof roles)[number];
export type Permission =
  | "property:read"
  | "property:create"
  | "property:update"
  | "property:publish"
  | "property:archive"
  | "organization:manage"
  | "lead:read"
  | "lead:update"
  | "billing:manage";
const policies: Record<Role, readonly Permission[]> = {
  OWNER: [
    "lead:read",
    "lead:update",
    "property:read",
    "property:create",
    "property:update",
    "property:publish",
    "property:archive",
    "organization:manage",
    "billing:manage",
  ],
  ADMIN: [
    "lead:read",
    "lead:update",
    "property:read",
    "property:create",
    "property:update",
    "property:publish",
    "property:archive",
    "organization:manage",
  ],
  MEMBER: [
    "property:read",
    "property:create",
    "property:update",
    "lead:read",
    "lead:update",
  ],
  VIEWER: ["property:read"],
};
export function can(role: Role, permission: Permission) {
  return policies[role].includes(permission);
}
