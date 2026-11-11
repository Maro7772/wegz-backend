/**
 * Model Proxy for Transparent Multi-Tenancy
 *
 * يسمح لجميع الـ controllers والـ services باستيراد الموديلات
 * بالشكل المعتاد:
 *   import { User } from "../models/User.js";
 *   await User.findOne(...);
 *   await User.create(...);
 *
 * وفي وقت التنفيذ، يتم توجيه الاستعلام تلقائيًا لقاعدة بيانات الـ tenant
 * المحدد في الـ request دون أي تغيير في توقيع الـ API أو الـ response/request.
 */
import mongoose, { Schema, Model, Document } from "mongoose";
import { getActiveTenantModel } from "./tenantContext.js";
import type { TenantModels } from "./tenantModels.js";

export function createModelProxy<T extends Document>(
  modelName: keyof TenantModels,
  schema: Schema<T>,
): Model<T> {
  // إنشاء fallback model على الاتصال الافتراضي (للاختبارات أو أوامر seed خارج request)
  let fallbackModel: Model<T>;
  try {
    fallbackModel = mongoose.model<T>(modelName, schema);
  } catch {
    fallbackModel = mongoose.model<T>(modelName);
  }

  return new Proxy(fallbackModel, {
    get(target, prop, receiver) {
      const active = getActiveTenantModel(modelName) as Model<T> | undefined;
      const effective = active || target;

      // دعم instanceof للتحقق من نوع المستند
      if (prop === Symbol.hasInstance) {
        return (instance: any) =>
          instance instanceof (effective as any) ||
          instance instanceof (target as any);
      }

      const val = Reflect.get(effective, prop, receiver);
      if (typeof val === "function") {
        return val.bind(effective);
      }
      return val;
    },

    apply(target, thisArg, argumentsList) {
      const active = getActiveTenantModel(modelName) as Model<T> | undefined;
      const effective = active || target;
      return Reflect.apply(effective as any, thisArg, argumentsList);
    },

    construct(target, argumentsList, newTarget) {
      // عند استدعاء new Model(...) يتم الإنشاء من موديل الـ tenant الفعلي
      const active = getActiveTenantModel(modelName) as Model<T> | undefined;
      const effective = active || target;
      return Reflect.construct(effective as any, argumentsList, newTarget);
    },
  });
}
