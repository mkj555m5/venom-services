# 🐍 VENOM SERVICES

منصة خدمات متعددة بأسلوب فينوم (Marvel Venom): أسود عميق `#0A0A0A`، أخضر سام، حواف سائلة، وخط Nosifer المتمازق — جاهزة للنشر على Railway بنقرة واحدة.

---

## 🧩 الخدمات الخمس

| الخدمة | الوصف | التقنية |
|---|---|---|
| **👁️ Venom Leak Check** | كشف تسريبات البريد وكلمات المرور (أخضر=آمن / أحمر=مسرب / أصفر=مشتبه) مع كاش 7 أيام | HIBP API v3 + Pwned Passwords k-anonymity (مجاني لكلمات المرور) |
| **🔍 VenomXNG** | محرك بحث ميتا بواجهة فينوم وشريط بحث يتمدد أثناء الكتابة | DuckDuckGo + Wikipedia (أو SearXNG خارجي عبر `VENOMXNG_URL`) |
| **🦷 Venom MEGA** | تحميل مباشر من روابط MEGA العامة بدون إعلانات (ملفات + مجلدات) | Cloudflare Worker (ملف `services/mega/worker.js` جاهز للنشر) |
| **🖥️ Venom Hosting** | استضافة مشاريع Python/Node.js: مدير ملفات، رفع ZIP بفك تلقائي، كونسول حي بدعم ANSI كامل، مراقبة رام/قرص، حصص صارمة | Bun mini-service + spawns حقيقية + RAM monitor (مستوحى من مفاهيم Gojgui — كود جديد بالكامل) |
| **💬 Venom Chat** | دردشة فورية: غرف عامة، رسائل خاصة، حضور حي، إيموجي، ألوان حسب الدور (أخضر المالك / أزرق المشرف / أبيض المستخدم) | Socket.IO + سجل كامل في قاعدة البيانات |

## 🔐 الحسابات والصلاحيات

- **المالك `RTQ_67`** (كلمة المرور من متغير `OWNER_PASSWORD`): صلاحيات غير محدودة — رام/مساحة/مشاريع ∞، حسابه **ثابت لا يُحذف ولا يُعدّل إلا بنفسه**، لوحة تحكم منفصلة بتصميم أحمر داكن.
- **المشرفون**: يرقّيهم المالك، حصص مخصصة يحددها.
- **المستخدم العادي**: 4GB رام + 50GB مساحة + مشروع واحد.
- المصادقة: JWT (jose) في كوكي httpOnly + bcrypt — مع Rate Limiting على كل الـ APIs وCSP ورؤوس أمان كاملة.

## 🛠️ لوحة المالك

إحصائيات حية (مستخدمون/مشاريع/رسائل/ذاكرة/تشغيل) · إدارة المستخدمين والحصص (وضع -1 = بلا حدود) · تفعيل/تعطيل أي خدمة · سجلات النظام كاملة · مولد شعارات SVG مدمج (3 أنماط، تحميل مباشر) · إعلان عام وعنوان الموقع.

## 🚀 النشر على Railway

1. ارفع المستودع على GitHub وأنشئ مشروعاً جديداً في Railway من المستودع.
2. Railway يكتشف Next.js تلقائياً (NIXPACKS) — `railway.json` جاهز:
   - Build: `bun install && prisma generate && next build`
   - Start: **يشغّل كل شيء بأمر واحد** — الخادم الرئيسي + خدمة الاستضافة + خدمة الدردشة (عبر `src/instrumentation.ts` الذي يولد الخدمات المصغرة كأبناء الخادم).
   - Healthcheck: `/health`
3. أضف **Volume** واربطه على `/data` (لحفظ قاعدة البيانات وملفات مشاريع الاستضافة).
4. **البورت**: أضف متغيراً `PORT` بقيمة مطابقة لـ Target Port في دومين Railway (مثال: إذا رابطك على 8080 → عيّن `PORT=8080`)، أو عيّن Target Port = قيمة `PORT`. إذا لم تعيّن شيئاً يستمع التطبيق على 3000.
5. عيّن متغيرات البيئة (انظر الجدول) — ثم Deploy.

> 🧠 **قاعدة البيانات تتكيف تلقائياً**: `scripts/db-setup.js` يقرأ `DATABASE_URL` عند البناء والإقلاع — لو كان `postgresql://...` يحوّل الـ schema ويعيد توليد Prisma Client تلقائياً، ولو `file:` أو غائب يستخدم SQLite. لا حاجة لتعديل أي ملف يدوياً.

### متغيرات البيئة

| المتغير | إلزامي | الافتراضي | الوظيفة |
|---|---|---|---|
| `DATABASE_URL` | ⬜ | `file:/data/venom.db` | SQLite على Volume، أو ضع رابط PostgreSQL من إضافة Railway — **الـ provider يتبدّل تلقائياً** (يُفضَّل PostgreSQL للإنتاج) |
| `JWT_SECRET` | ✅ | fallback تطويري | سر توقيع الجلسات — **غيّره في الإنتاج** |
| `INTERNAL_TOKEN` | ✅ | `venom-internal` | توكن الاتصال الداخلي بين الخدمات |
| `OWNER_USERNAME` / `OWNER_PASSWORD` | ✅ | `RTQ_67` / `@ROblox2011` | بيانات المالك الثابتة |
| `HIBP_API_KEY` | ⬜ | — | مفتاح haveibeenpwned.com لفحص البريد ($3.5/شهر — فحص كلمات المرور يعمل بدونه) |
| `MEGA_INDEX_URL` أو `CLOUDFLARE_WORKER_URL` | ⬜ | — | رابط عامل Cloudflare بعد نشر `services/mega/worker.js` |
| `VENOMXNG_URL` | ⬜ | — | رابط SearXNG حقيقي (اختياري — انظر docker-compose.yml) |
| `SMTP_URL` | ⬜ | — | لإرسال رموز استعادة كلمة المرور بالبريد (بدونه: الرمز يظهر في سجلات النظام للمالك) |
| `HOSTING_DATA_DIR` | ⬜ | `./hosting_data` | مجلد ملفات مشاريع الاستضافة — وجّهه إلى الـ Volume |
| `LOGO_GENERATOR_API_KEY` | ⬜ | — | لمولد AI خارجي (المولد المدمج SVG يعمل بدونه) |

### نشر عامل MEGA (دقيقتان)

1. افتح [Cloudflare Workers](https://workers.cloudflare.com) → Create Application → Paste Code.
2. الصق محتوى `services/mega/worker.js` → Deploy → انسخ رابط العامل.
3. ضعه في `MEGA_INDEX_URL` على Railway وأعد النشر.

## 🗂️ هيكل المشروع

```
├── src/
│   ├── app/page.tsx              # الواجهة SPA (جميع الصفحات بأسلوب فينوم)
│   ├── app/api/                  # auth · users · config · stats · logs
│   │                             # leak · search · mega · hosting · chat · health · logo
│   ├── components/venom/         # الشعار SVG + الثيم + كل الواجهات
│   ├── instrumentation.ts        # يولد الخدمات المصغرة مع إقلاع الخادم
│   └── lib/                      # auth(jose+bcrypt) · rate-limit · seed · db
├── mini-services/
│   ├── hosting-service/          # منفذ 3031: عمليات + ملفات + كونسول + مراقبة رام
│   └── chat-service/             # منفذ 3003: Socket.IO (غرف/خاص/حضور/حفظ)
├── services/mega/worker.js       # عامل Cloudflare جاهز للصق
├── prisma/schema.prisma          # Users · HostingProjects · ChatMessages · BreachCache · Logs · Config
├── railway.json · docker-compose.yml · Dockerfile
```

## 🧪 الاختبار

```bash
bash scripts/test_venom.sh   # 32+ فحص API: مصادقة، صلاحيات، حصص، تسريبات، بحث، استضافة كاملة، دردشة، أمان
```

## 🔒 الأمان المطبق

HTTPS (Railway) · Rate Limiting · JWT httpOnly SameSite · bcrypt(10) · CSP + X-Frame-Options + nosniff + HSTS · تنقية مدخلات وحماية من Path Traversal في كل مسارات الملفات · فحص ملكية على كل عملية استضافة · توكن داخلي بين الخدمات.
