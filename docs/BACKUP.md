# پشتیبان پایگاه Bandora

سوپابیس در طرح رایگان پشتیبان قابل‌دانلود و PITR ندارد. تنها نسخه‌ی زنده، همین پایگاه است. پشتیبان روی کامپیوتر رها گرفته می‌شود، نه در GitHub Actions، چون مخزن عمومی است. فایل dump هرگز وارد git نمی‌شود.

اسکیماهای داخل dump: `public` و `liara_archive`. اسکیمای آرشیو فقط خوانده می‌شود و این اسکریپت آن را تغییر نمی‌دهد.

## نصب ابزار

1. PostgreSQL client tools نسخه‌ی ۱۷، یا همان نسخه‌ی اصلی که `select version();` در SQL Editor سوپابیس نشان می‌دهد، را نصب کن. `pg_dump` و `pg_restore` لازم‌اند.
2. پوشه‌ی `bin` را به PATH کاربر اضافه کن.
3. در PowerShell بزن: `pg_dump --version`. باید نسخه‌ی نصب‌شده را چاپ کند و هیچ آدرسی نپرسد.

## فایل محلی

`DATABASE_URL` را اسکریپت از فایل محلی می‌خواند و هرگز آن را چاپ نمی‌کند. آدرس را به آرگومان، Task Scheduler، چت یا docs نده.

`.env` توسعه الان به PGlite اشاره می‌کند و `pg_dump` با آن کار نمی‌کند. برای پشتیبان تولید، یک فایل جدا بساز که فقط همان آدرس Session pooler سوپابیس را داشته باشد (همان مقدار Railway). نام فایل را طوری بگذار که با `.env*` جور باشد تا git آن را نگیرد، مثلاً `.env.backup`:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\backup-db.ps1 -WhatIf -EnvFile .\.env.backup
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\backup-db.ps1 -EnvFile .\.env.backup
```

در Task Scheduler هم همان `-EnvFile` را به آرگومان اضافه کن. خود فایل را در تسک کپی نکن.

اگر آدرس `sslmode=no-verify` داشته باشد، اسکریپت برای libpq آن را به `require` نگاشت می‌کند (TLS روشن، بدون بررسی گواهی). تأیید گواهی قدم جداگانه‌ای است و این اسکریپت گواهی را چاپ نمی‌کند.

## اجرای آزمایشی و اجرای واقعی

از ریشه‌ی مخزن:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\backup-db.ps1 -WhatIf
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\backup-db.ps1
```

`-WhatIf` وصل نمی‌شود. فقط مسیر پوشه، نام فایل، اسکیماها، نسخه‌ی `pg_dump` و در صورت نیاز نام dumpهای قدیمی را چاپ می‌کند.

اجرای واقعی این فایل را می‌سازد:

`C:\Users\mjh\BandoraBackups\db-yyyy-MM-dd-HHmm.dump`

ساعت، ساعت محلی ویندوز است. فقط ۸ فایل آخر می‌ماند. یک خط در `C:\Users\mjh\BandoraBackups\backup.log` نوشته می‌شود: تاریخ، ok یا fail، نام فایل و اندازه. آدرس پایگاه در لاگ نیست.

## Task Scheduler، هر یکشنبه ساعت ۱۰ به وقت تهران

1. Task Scheduler را باز کن و Create Task (نه Basic Task) را بزن.
2. نام: `Bandora DB backup`.
3. گزینه‌ی Run whether user is logged on or not را بگذار و رمز ویندوز خودت را بده. Highest privileges لازم نیست.
4. Trigger: Weekly، Sunday، ساعت 10:00. اگر منطقه‌ی زمانی ویندوز Asia/Tehran است، همین ساعت یعنی ۱۰ صبح تهران.
5. Action: Start a program.
   - Program: `powershell.exe`
   - Arguments: `-NoProfile -ExecutionPolicy Bypass -File C:\Users\mjh\Projects\IELTS\scripts\backup-db.ps1 -EnvFile C:\Users\mjh\Projects\IELTS\.env.backup`
6. در شرط‌ها، Start the task only if the computer is on AC power را بردار اگر لپ‌تاپ اغلب روی باتری است.
7. یک بار با Run تسک را اجرا کن و در `BandoraBackups` اندازهٔ فایل را ببین. باید بزرگ‌تر از صفر باشد.

## بازگردانی

تاریخ آخرین تست بازگردانی: ۲۰۲۶-۱۱-۱۷. سرور محلی PostgreSQL 17 در `C:\Program Files\PostgreSQL\17` است، سرویس `postgresql-x64-17`، و `listen_addresses` روی `localhost` است. رمز محلی فقط در `.env.backup` با نام `LOCAL_PG_PASSWORD` است.

اسکریپت آدرس تولید را نمی‌خواند. هر بار پایگاه `bandora_restore_test` را روی `127.0.0.1` حذف و از نو می‌سازد. dump را به سوپابیس برنگردان.

نتیجهٔ بازگردانی `db-2026-11-17-2215.dump`: ۷۲ جدول در `public`، ۱۱ جدول در `liara_archive`، و هیچ جدول `public` بدون RLS. شمارش ردیف با پایگاه زنده یکی بود: `users` ۰، `subscriptions` ۰، `payment_attempts` ۰، `content_items` ۰، `schema_migrations` ۱۳، `liara_archive.users` ۳.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\restore-test.ps1 -WhatIf -EnvFile .\.env.backup
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\restore-test.ps1 -EnvFile .\.env.backup
```

خروجی، تعداد ردیف `users`، `subscriptions`، `payment_attempts`، `content_items`، `schema_migrations` و `liara_archive.users` است. همین شمارش را در SQL Editor سوپابیس بگیر و مقایسه کن. dump را به سوپابیس برنگردان.

## فایل‌های صوتی

خود فایل‌ها داخل dump نیستند. `super_admin` از خانهٔ پنل مدیریت دکمهٔ «دانلود پشتیبان صوت» را می‌زند. فهرست JSON دانلود می‌شود و هر فایلی که روی دیسک باشد از همان صفحه قابل دریافت است. نقش‌های دیگر این مسیر را ندارند. نسخهٔ گرفته‌شده را بیرون از Railway نگه دار، نه در git.
