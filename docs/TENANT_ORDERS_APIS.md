# توثيق الـ APIs الخاصة بطلبات الاشتراك للباقات — Tenant Backend (لوحة العميل/المتجر)

يغطي هذا الملف جميع المسارات (APIs) التي يستخدمها عميل المتجر (Tenant) لاستعراض باقات الاشتراك وطرق الدفع، رفع طلب اشتراك أو تجديد جديد مع الإيصال، واستعراض سجل طلباته السابقة وحالاتها.

---

## 📌 معلومات الربط والسياق (Multi-Tenant Context)

* **Base URL:**
  * محلياً: `http://<subdomain>.localhost:3000` (أو `http://localhost:3000` مع تمرير الهيدر)
  * الإنتاج: `https://<subdomain>.wegz.org` أو `https://api-<subdomain>.wegz.org`
* **تحديد العميل (Tenant Identification):**
  يقوم الـ Backend بالتعرف التلقائي على العميل وربطه بـ `client_id` المسجل في الـ Super Admin عبر إحدى الطرق التالية:
  1. الـ **Subdomain** في الـ Host (مثال: `baraka.wegz.org`).
  2. هيدر مخصص: `X-Tenant-Subdomain: baraka`.
  3. هيدر الـ `Origin` أو `Referer` القادم من فرونت إند المتجر.
* **المصادقة (Authentication):**
  * إذا كان المستخدم مسجلاً دخوله في لوحة المتجر:
    ```http
    Authorization: Bearer <TENANT_ADMIN_JWT_TOKEN>
    ```
  * يربط النظام الطلب تلقائياً بالـ `client_id` الخاص بالمتجر من قاعدة البيانات المركزية لـ Super Admin.

---

# 1) جلب باقات وطرق الدفع المتاحة (Lists)

يُستخدم هذا الـ API لعرض الباقات المتوفرة وطرق الدفع النشطة التي يمكن للعميل الاختيار من بينها عند الاشتراك أو التجديد.

* **المسار (Endpoint):** `GET /api/admin/orders/lists`
* **Method:** `GET`
* **Headers:**
  ```http
  Host: baraka.wegz.org
  Authorization: Bearer <token> (اختياري)
  ```
* **Query Parameters:** لا يوجد.

* **شروط البيانات المرتجعة:**
  * يرجع فقط طرق الدفع والباقات النشطة (`status: "active"`).
  * حقل `final_price` في الباقات يُحسب تلقائياً بالقاعدة:
    $$\text{final\_price} = \text{price} - \text{discount}$$
  * حقل `icon` في طرق الدفع يُرجع كرابط مباشر كامل وقابل للعرض.

* **Response الناجحة (200 OK):**
  ```json
  {
    "success": true,
    "message": "Order form lists retrieved successfully",
    "data": {
      "payment_methods": [
        {
          "id": "67389b0123456789abcdef02",
          "name": "فودافون كاش",
          "icon": "http://baraka.wegz.org/uploads/vodafone-cash.png",
          "description": "يرجى التحويل على رقم 010XXXXXXXX وإرفاق صورة التحويل"
        },
        {
          "id": "67389b0123456789abcdef09",
          "name": "تحويل بنكي (CIB)",
          "icon": "http://baraka.wegz.org/uploads/cib-bank.png",
          "description": "رقم الحساب: 1000XXXXXXXXXX - اسم الحساب: شركة ويجز"
        }
      ],
      "packages": [
        {
          "id": "67389a0123456789abcdef01",
          "name": "الباقة الشهرية الأساسية",
          "price": 300,
          "months": 1,
          "discount": 0,
          "final_price": 300
        },
        {
          "id": "67389a0123456789abcdef05",
          "name": "الباقة السنوية الاحترافية",
          "price": 3600,
          "months": 12,
          "discount": 600,
          "final_price": 3000
        }
      ]
    }
  }
  ```

---

# 2) إنشاء طلب اشتراك جديد مع رفع الإيصال (Make Order)

يقوم العميل باختيار الباقة وطريقة الدفع ورفع صورة أو ملف الـ PDF الخاص بإيصال التحويل البنكي أو المحفظة الإلكترونية.

* **المسار (Endpoint):** `POST /api/admin/orders/make-order`
* **Method:** `POST`
* **Headers:**
  ```http
  Host: baraka.wegz.org
  Content-Type: multipart/form-data
  Authorization: Bearer <token>
  ```

* **Form-Data Body:**
  | الحقل | النوع | إلزامي؟ | الوصف |
  |---|---|---|---|
  | `package_id` | Text | نعم | معرّف الباقة المختارة من قائمة الباقات |
  | `payment_method_id` | Text | نعم | معرّف طريقة الدفع المختارة |
  | `receipt` | File | نعم | ملف الإيصال (صورة jpeg, png, webp, gif, svg أو مستند pdf) بحد أقصى 10MB |

* **منطق المعالجة داخل السيرفر (Backend Logic):**
  1. التحقق من هوية المتجر واستخراج `client_id` من سياق الطلب ومن قاعدة بيانات Super Admin.
  2. التحقق من وجود الباقة المحددة والتأكد من أنها نشطة (`active`).
  3. التحقق من وجود طريقة الدفع والتأكد من أنها نشطة (`active`).
  4. احتساب المبالغ تلقائياً وحمايتها من التلاعب:
     * `price = package.price`
     * `discount = package.discount`
     * `final_price = price - discount`
  5. حفظ ملف الإيصال في مجلد الـ uploads بالسيرفر وتوليد رابط URL كامل له.
  6. إنشاء سجل الطلب بحالة `status: "pending"` في انتظار مراجعة الـ Super Admin.

* **Response الناجحة (201 Created):**
  ```json
  {
    "success": true,
    "message": "Order created successfully and awaiting approval",
    "data": {
      "order": {
        "_id": "67389d0123456789abcdef04",
        "id": "67389d0123456789abcdef04",
        "package_id": {
          "_id": "67389a0123456789abcdef05",
          "name": "الباقة السنوية الاحترافية",
          "price": 3600,
          "months": 12,
          "discount": 600
        },
        "payment_method_id": {
          "_id": "67389b0123456789abcdef02",
          "name": "فودافون كاش",
          "icon": "http://baraka.wegz.org/uploads/vodafone-cash.png",
          "description": "..."
        },
        "client_id": "67389c0123456789abcdef03",
        "price": 3600,
        "discount": 600,
        "final_price": 3000,
        "status": "pending",
        "reject_reason": null,
        "receipt": "http://baraka.wegz.org/uploads/1731763000000-987654321.pdf",
        "createdAt": "2026-11-16T13:20:00.000Z",
        "updatedAt": "2026-11-16T13:20:00.000Z"
      }
    }
  }
  ```

* **أمثلة على الأخطاء (Error Responses):**
  * `400 Bad Request`: عند نسيان إرفاق ملف الإيصال أو إرسال معرف غير صالح للباقة أو طريقة الدفع:
    ```json
    { "success": false, "message": "Receipt file is required" }
    ```
  * `401 Unauthorized`: في حال تعذر تحديد الـ Tenant / Subdomain:
    ```json
    { "success": false, "message": "No tenant context found for this request. Subdomain is required." }
    ```
  * `404 Not Found`: إذا كانت الباقة أو طريقة الدفع محذوفة أو غير مفعلة (`inactive`):
    ```json
    { "success": false, "message": "Package not found or inactive" }
    ```

---

# 3) سجل طلبات المتجر مع الفلترة والصفحات (History Orders)

يعرض هذا الـ API جميع طلبات الاشتراك والتجديد الخاصة بهذا المتجر فقط، لمتابعة حالة الطلبات (قيد الانتظار، مقبولة، أو مرفوضة مع معرفة سبب الرفض).

* **المسار (Endpoint):** `GET /api/admin/orders/history-orders`
* **Method:** `GET`
* **Headers:**
  ```http
  Host: baraka.wegz.org
  Authorization: Bearer <token>
  ```

* **Query Parameters:**
  | البارامتر | النوع | إلزامي؟ | الوصف |
  |---|---|---|---|
  | `status` | String | لا | فلترة بحالة الطلب: `pending` أو `approve` أو `reject` |
  | `page` | Number | لا | رقم الصفحة (افتراضي: `1`) |
  | `limit` | Number | لا | عدد العناصر في الصفحة (افتراضي: `10`، حد أقصى: `100`) |

* **Response الناجحة (200 OK):**
  ```json
  {
    "success": true,
    "message": "Order history retrieved successfully",
    "data": {
      "orders": [
        {
          "_id": "67389d0123456789abcdef04",
          "id": "67389d0123456789abcdef04",
          "package_id": {
            "_id": "67389a0123456789abcdef05",
            "name": "الباقة السنوية الاحترافية",
            "price": 3600,
            "months": 12,
            "discount": 600
          },
          "payment_method_id": {
            "_id": "67389b0123456789abcdef02",
            "name": "فودافون كاش",
            "icon": "http://baraka.wegz.org/uploads/vodafone-cash.png",
            "description": "..."
          },
          "client_id": "67389c0123456789abcdef03",
          "price": 3600,
          "discount": 600,
          "final_price": 3000,
          "status": "approve",
          "reject_reason": null,
          "receipt": "http://baraka.wegz.org/uploads/1731763000000-987654321.pdf",
          "createdAt": "2026-11-16T13:20:00.000Z",
          "updatedAt": "2026-11-16T13:25:00.000Z"
        },
        {
          "_id": "67389d0123456789abcdef00",
          "id": "67389d0123456789abcdef00",
          "package_id": {
            "_id": "67389a0123456789abcdef01",
            "name": "الباقة الشهرية الأساسية",
            "price": 300,
            "months": 1,
            "discount": 0
          },
          "payment_method_id": {
            "_id": "67389b0123456789abcdef02",
            "name": "فودافون كاش",
            "icon": "http://baraka.wegz.org/uploads/vodafone-cash.png"
          },
          "client_id": "67389c0123456789abcdef03",
          "price": 300,
          "discount": 0,
          "final_price": 300,
          "status": "reject",
          "reject_reason": "صورة الإيصال غير واضحة برجاء إعادة الرفع",
          "receipt": "http://baraka.wegz.org/uploads/1731761000000-badreceipt.png",
          "createdAt": "2026-11-15T10:00:00.000Z",
          "updatedAt": "2026-11-15T11:00:00.000Z"
        }
      ],
      "total": 2,
      "page": 1,
      "limit": 10,
      "totalPages": 1
    }
  }
  ```

---

## 💡 نصائح لتكامل الفرونت إند (Frontend Integration Tips)

1. **عرض سبب الرفض:** عندما تكون قيمة `status === "reject"`، يُعرض محتوى `reject_reason` كـ Alert أحمر أو Tooltip يوضح للعميل سبب عدم قبول الإيصال ليتمكن من معالجة المشكلة ورفع طلب جديد.
2. **رابط الإيصال والأيقونات:** جميع حقول `receipt` و `icon` تُعاد جاهزة كروابط URL كاملة ومباشرة، فلا حاجة لتركيب دومين أو مسار يدوي في الفرونت إند.
3. **فورم الطلب:** في شاشة الدفع:
   - يتم طلب `GET /api/admin/orders/lists` أولاً لتعبئة خيارات الباقات وطرق الدفع.
   - عند تأكيد التحويل، يتم إرسال `FormData` تحتوي على `package_id`, `payment_method_id` وملف `receipt` إلى `POST /api/admin/orders/make-order`.
