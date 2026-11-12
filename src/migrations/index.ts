import type { TenantMigration } from "./types.js";
import { migration001 } from "./001_initial_schema.js";
import { migration002 } from "./002_add_theme_modes_and_indexes.js";

/**
 * سجل الميجريشنز لجميع الـ tenant schemas.
 * أضف أي ميجريشن جديد هنا في نهاية المصفوفة ليتم تطبيقه تلقائيًا على التعديلات الجديدة فقط.
 */
export const allTenantMigrations: TenantMigration[] = [
  migration001,
  migration002,
];

export * from "./types.js";
