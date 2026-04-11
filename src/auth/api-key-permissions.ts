import { Request } from 'express';

export enum AccountApiKeyPermission {
  AUTH_ME_READ = 'auth:me:read',
  ACCOUNT_KEYS_MANAGE = 'auth:apikeys:manage',
  INSTANCES_CREATE = 'instances:create',
  INSTANCES_LIST = 'instances:list',
  INSTANCES_DELETE = 'instances:delete',
  INSTANCES_STATUS_READ = 'instances:status:read',
  CONTACTS_READ = 'instances:contacts:read',
  CHATS_READ = 'instances:chats:read',
  CHATS_WRITE = 'instances:chats:write',
  MESSAGES_SEND = 'instances:messages:send',
  WEBHOOKS_WRITE = 'instances:webhook:write',
  METRICS_READ = 'instances:metrics:read',
  EVENTS_READ = 'instances:events:read',
  INSTANCE_KEYS_MANAGE = 'instances:apikeys:manage',
}

export const ACCOUNT_API_KEY_PERMISSIONS: AccountApiKeyPermission[] =
  Object.values(AccountApiKeyPermission);

export enum AccountApiKeyTemplateId {
  READ_ONLY = 'read_only',
  OPERATOR = 'operator',
  INSTANCE_MANAGER = 'instance_manager',
  ACCOUNT_ADMIN = 'account_admin',
}

export const ACCOUNT_API_KEY_TEMPLATE_IDS: AccountApiKeyTemplateId[] =
  Object.values(AccountApiKeyTemplateId);

export interface AccountApiKeyPermissionTemplate {
  id: AccountApiKeyTemplateId;
  name: string;
  description: string;
  permissions: AccountApiKeyPermission[];
}

const READ_ONLY_PERMISSIONS: AccountApiKeyPermission[] = [
  AccountApiKeyPermission.AUTH_ME_READ,
  AccountApiKeyPermission.INSTANCES_LIST,
  AccountApiKeyPermission.INSTANCES_STATUS_READ,
  AccountApiKeyPermission.CONTACTS_READ,
  AccountApiKeyPermission.CHATS_READ,
  AccountApiKeyPermission.METRICS_READ,
  AccountApiKeyPermission.EVENTS_READ,
];

const OPERATOR_PERMISSIONS: AccountApiKeyPermission[] = [
  ...READ_ONLY_PERMISSIONS,
  AccountApiKeyPermission.CHATS_WRITE,
  AccountApiKeyPermission.MESSAGES_SEND,
  AccountApiKeyPermission.WEBHOOKS_WRITE,
];

const INSTANCE_MANAGER_PERMISSIONS: AccountApiKeyPermission[] = [
  ...OPERATOR_PERMISSIONS,
  AccountApiKeyPermission.INSTANCES_CREATE,
  AccountApiKeyPermission.INSTANCES_DELETE,
  AccountApiKeyPermission.INSTANCE_KEYS_MANAGE,
];

const ACCOUNT_ADMIN_PERMISSIONS: AccountApiKeyPermission[] = [
  ...INSTANCE_MANAGER_PERMISSIONS,
  AccountApiKeyPermission.ACCOUNT_KEYS_MANAGE,
];

const ACCOUNT_API_KEY_PERMISSION_TEMPLATES: AccountApiKeyPermissionTemplate[] = [
  {
    id: AccountApiKeyTemplateId.READ_ONLY,
    name: 'Read-only',
    description:
      'Can read profile, instances, status, contacts, chats, metrics, and events.',
    permissions: READ_ONLY_PERMISSIONS,
  },
  {
    id: AccountApiKeyTemplateId.OPERATOR,
    name: 'Operator',
    description:
      'Read-only plus send messages, mark chats as read, and update webhooks.',
    permissions: OPERATOR_PERMISSIONS,
  },
  {
    id: AccountApiKeyTemplateId.INSTANCE_MANAGER,
    name: 'Instance manager',
    description:
      'Operator plus create/delete instances and manage instance-scoped keys.',
    permissions: INSTANCE_MANAGER_PERMISSIONS,
  },
  {
    id: AccountApiKeyTemplateId.ACCOUNT_ADMIN,
    name: 'Account admin',
    description:
      'Instance manager plus manage account-scoped API keys.',
    permissions: ACCOUNT_ADMIN_PERMISSIONS,
  },
];

export function listAccountApiKeyPermissionTemplates(): AccountApiKeyPermissionTemplate[] {
  return ACCOUNT_API_KEY_PERMISSION_TEMPLATES.map((template) => ({
    ...template,
    permissions: [...template.permissions],
  }));
}

export function resolvePermissionsTemplate(
  templateId: AccountApiKeyTemplateId,
): AccountApiKeyPermission[] | undefined {
  const template = ACCOUNT_API_KEY_PERMISSION_TEMPLATES.find(
    (candidate) => candidate.id === templateId,
  );
  if (!template) {
    return undefined;
  }
  return [...template.permissions];
}

interface RoutePermissionRule {
  method: string;
  pattern: RegExp;
  permission: AccountApiKeyPermission;
}

const ROUTE_PERMISSION_RULES: RoutePermissionRule[] = [
  {
    method: 'GET',
    pattern: /^\/api\/auth\/me$/,
    permission: AccountApiKeyPermission.AUTH_ME_READ,
  },
  {
    method: 'POST',
    pattern: /^\/api\/auth\/apikeys(?:\/[^/]+)?$/,
    permission: AccountApiKeyPermission.ACCOUNT_KEYS_MANAGE,
  },
  {
    method: 'GET',
    pattern: /^\/api\/auth\/apikeys(?:\/[^/]+)?$/,
    permission: AccountApiKeyPermission.ACCOUNT_KEYS_MANAGE,
  },
  {
    method: 'DELETE',
    pattern: /^\/api\/auth\/apikeys(?:\/[^/]+)?$/,
    permission: AccountApiKeyPermission.ACCOUNT_KEYS_MANAGE,
  },
  {
    method: 'POST',
    pattern: /^\/api\/instances\/create$/,
    permission: AccountApiKeyPermission.INSTANCES_CREATE,
  },
  {
    method: 'GET',
    pattern: /^\/api\/instances$/,
    permission: AccountApiKeyPermission.INSTANCES_LIST,
  },
  {
    method: 'DELETE',
    pattern: /^\/api\/instances\/[^/]+$/,
    permission: AccountApiKeyPermission.INSTANCES_DELETE,
  },
  {
    method: 'GET',
    pattern: /^\/api\/instances\/[^/]+\/(status|qr)$/,
    permission: AccountApiKeyPermission.INSTANCES_STATUS_READ,
  },
  {
    method: 'GET',
    pattern: /^\/api\/instances\/[^/]+\/contact\/[^/]+$/,
    permission: AccountApiKeyPermission.CONTACTS_READ,
  },
  {
    method: 'GET',
    pattern: /^\/api\/instances\/[^/]+\/chats$/,
    permission: AccountApiKeyPermission.CHATS_READ,
  },
  {
    method: 'GET',
    pattern: /^\/api\/instances\/[^/]+\/chats\/[^/]+\/messages$/,
    permission: AccountApiKeyPermission.CHATS_READ,
  },
  {
    method: 'POST',
    pattern: /^\/api\/instances\/[^/]+\/chats\/[^/]+\/read$/,
    permission: AccountApiKeyPermission.CHATS_WRITE,
  },
  {
    method: 'POST',
    pattern: /^\/api\/instances\/[^/]+\/messages$/,
    permission: AccountApiKeyPermission.MESSAGES_SEND,
  },
  {
    method: 'PATCH',
    pattern: /^\/api\/instances\/[^/]+\/webhook$/,
    permission: AccountApiKeyPermission.WEBHOOKS_WRITE,
  },
  {
    method: 'GET',
    pattern: /^\/api\/instances\/[^/]+\/metrics$/,
    permission: AccountApiKeyPermission.METRICS_READ,
  },
  {
    method: 'GET',
    pattern: /^\/api\/instances\/[^/]+\/events$/,
    permission: AccountApiKeyPermission.EVENTS_READ,
  },
  {
    method: 'POST',
    pattern: /^\/api\/instances\/[^/]+\/apikeys(?:\/[^/]+)?$/,
    permission: AccountApiKeyPermission.INSTANCE_KEYS_MANAGE,
  },
  {
    method: 'GET',
    pattern: /^\/api\/instances\/[^/]+\/apikeys(?:\/[^/]+)?$/,
    permission: AccountApiKeyPermission.INSTANCE_KEYS_MANAGE,
  },
  {
    method: 'DELETE',
    pattern: /^\/api\/instances\/[^/]+\/apikeys(?:\/[^/]+)?$/,
    permission: AccountApiKeyPermission.INSTANCE_KEYS_MANAGE,
  },
];

function normalizePath(rawPath: string): string {
  const noQuery = rawPath.split('?')[0] || '/';
  if (noQuery.length > 1 && noQuery.endsWith('/')) {
    return noQuery.slice(0, -1);
  }
  return noQuery;
}

export function resolveAccountPermissionForRequest(
  req: Request,
): AccountApiKeyPermission | undefined {
  const method = req.method.toUpperCase();
  const path = normalizePath(req.path || req.originalUrl || '/');

  const rule = ROUTE_PERMISSION_RULES.find(
    (candidate) =>
      candidate.method === method && candidate.pattern.test(path),
  );

  return rule?.permission;
}
