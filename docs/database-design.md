# طرح پایگاه

PostgreSQL. مهاجرت جلو در `db/migrations/001_initial.sql`. برگشت: حذف جدول‌ها از آخر به اول (`skill_results`, `placement_answers`, `placement_attempts`, `profiles`, `sessions`, `users`).

مالکیت: هر ردیف تلاش و پروفایل به `users.id` وصل است. نشست با `token_hash` است، نه خود توکن. `password_hash` متن ساده نیست و تا وقتی سرویس احراز هویت نوشته شود خالی نمی‌ماند چون جدول هنوز در جایی اعمال نشده.

ایندکس: یکتا بودن ایمیل، نشست کاربر، تلاش‌های اخیر کاربر.

این طرح هنوز به یک پایگاه زنده وصل نیست. `DATABASE_URL` فقط در `.env.example` به‌صورت خالی آمده است. `/api/health` اگر متغیر خالی باشد `database: "not_configured"` برمی‌گرداند و فقط وقتی `node server.js` اجرا شود در دسترس است، نه روی GitHub Pages.
