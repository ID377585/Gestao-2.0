export {
  ACCESS_MODULES,
  emptyModulePermissionMap,
  type AccessModule,
  type AccessModuleKey,
  type ModulePermissionMap as UserModulePermissionMap,
} from "@/lib/auth/module-access-config";

export type UserModulePermission = {
  module_key: import("@/lib/auth/module-access-config").AccessModuleKey;
  can_access: boolean;
};
