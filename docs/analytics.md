# رویدادهای محصول

کاتالوگ در `lib/experiments.ts` با نام `EVENT_CATALOG` است. ارسال فقط وقتی رضایت تحلیل روشن باشد در آرایه `events` همین مرورگر می‌ماند. متن پاسخ، نام، ایمیل و تلفن داخل ویژگی‌ها نیستند.

| نام | ویژگی مجاز | شاخص |
| --- | --- | --- |
| signup_completed | method | فعال‌سازی |
| onboarding_completed | examType, hasDate | فعال‌سازی |
| placement_test_started | skill | تکمیل |
| placement_test_completed | bandBucket | تکمیل |
| exercise_started | skill, exerciseId | تعامل |
| exercise_completed | skill, exerciseId | تعامل |
| mock_test_completed | scope | تعامل |
| report_exported | format | ارزش |
| feedback_submitted | kind | کیفیت |

`bandBucket` یکی از `under-5`، `5-to-6`، `6-to-7`، `7-plus` است، نه پاسخ خام.

نمودار مدیر از مولد ساختگی `sampleAnalytics` است: ثبت‌نام، شروع و اتمام تعیین سطح، شروع برنامه، تمرین، بازگشت و تمایل به قابلیت پولی. این اعداد را با رویداد مرورگر جمع نکنید.

قیف محصول که در نسخه واقعی باید ساخته شود: ثبت‌نام تا شروع آزمون، اتمام تعیین سطح، تعیین سطح تا شروع برنامه، تکمیل برنامه، بازگشت، خروج از مسیر، و آزمایش A/B. رضایتی که خاموش باشد باید ارسال را متوقف کند، همان کاری که `track` امروز می‌کند.
