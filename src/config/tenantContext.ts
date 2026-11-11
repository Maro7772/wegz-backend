import { AsyncLocalStorage } from "node:async_hooks";
import type { Connection } from "mongoose";
import type { TenantModels } from "./tenantModels.js";
import type { TenantInfo } from "./tenant.js";

export interface TenantContext {
  tenant: TenantInfo;
  connection: Connection;
  models: TenantModels;
}

export const tenantStorage = new AsyncLocalStorage<TenantContext>();

/**
 * يرجع الـ context الحالي للـ request (الـ tenant والـ connection والـ models)
 */
export function getTenantContext(): TenantContext | undefined {
  return tenantStorage.getStore();
}

/**
 * يرجع الموديل المناسب للـ tenant الحالي داخل سياق الـ request
 */
export function getActiveTenantModel<K extends keyof TenantModels>(
  modelName: K,
): TenantModels[K] | undefined {
  const store = tenantStorage.getStore();
  return store?.models?.[modelName];
}
