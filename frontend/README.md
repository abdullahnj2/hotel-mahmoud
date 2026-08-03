# واجهة فندق نجم الشرق (Frontend)

مشروع React (Vite) يتصل مباشرة بالـ API المنشور على:
```
https://hotel-mahmoud.abdullah-alnajim.workers.dev
```
(الرابط موجود في `src/api.js` — لو تغيّر رابط الـ Worker لاحقًا، عدّله من هناك فقط)

## النشر على Cloudflare Pages

**الطريقة الموصى بها: عبر GitHub**

1. أنشئ مستودع GitHub جديد (مثلاً `hotel-mahmoud-frontend`)
2. ارفع كل ملفات هذا المشروع مع الحفاظ على هيكل المجلدات (`src/` يبقى مجلد فرعي)
3. من لوحة Cloudflare → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
4. اختر المستودع، واستخدم الإعدادات التالية:
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
5. اضغط **Save and Deploy**

بعد النشر، Cloudflare بيعطيك رابط مباشر مثل:
```
https://hotel-mahmoud-frontend.pages.dev
```
هذا هو رابط الموقع الكامل (واجهة النزيل + لوحة التحكم) اللي تفتحه بالمتصفح.

## ملاحظة مهمة
تأكد إن الـ Worker (`hotel-mahmoud`) شغال ومتاح، لأن الواجهة بالكامل تعتمد عليه لجلب الغرف والحجوزات — لا يوجد أي بيانات محلية في هذا المشروع.
