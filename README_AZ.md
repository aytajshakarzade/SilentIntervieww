# SilentInterview — registration + Render PostgreSQL fix

Bu paketdə qeydiyyat səhifəsinin validasiya düzəlişləri, backend-in real xəta mesajlarını göstərməsi və Render PostgreSQL bağlantısının `PGHOST` / `PGDATABASE` / `PGUSER` / `PGPASSWORD` dəyişənlərindən qurulması var.

## Əsas tapıntı

Layihənin `appsettings.json` faylında local development üçün `Host=localhost;Port=5432` yazılıb. Backend əvvəlcə yalnız `ConnectionStrings:DefaultConnection` oxuyurdu və Render-də göstərilən `PGHOST` və digər `PG*` dəyişənlərini connection string-ə çevirmirdi. Ona görə Render-dəki API PostgreSQL-i `127.0.0.1:5432` ünvanında axtara bilərdi.

## Faylları tətbiq etmək

1. ZIP-i aç.
2. ZIP daxilindəki `frontend/` və `back-end/` qovluqlarındakı faylları layihənin müvafiq qovluqlarına köçür və eyni adlı faylları əvəz et.
3. Dəyişiklikləri GitHub `main` branch-ə commit/push et.
4. Render-də backend deploy-un tamamlanmasını gözlə. Frontend faylları dəyişdiyinə görə frontend static site üçün də deploy tamamlanmalıdır.
5. `/register` səhifəsini yenilə və yenidən sına.

## Nə dəyişib?

- `Program.cs`: Render PG* dəyişənlərindən PostgreSQL connection string qurur.
- `errorUtils.js`: `Message`/`message` və `Errors`/`errors` formatlarının ikisini də tanıyır ki, ümumi xəta əvəzinə backend səbəbini göstərə bilsin.
- Qeydiyyat forması və validator: ad/şifrə qaydalarını uyğunlaşdırır.

ZIP-ə heç bir `.env`, parol və ya API secret daxil edilməyib. Render-dəki mövcud `PG*` dəyərlərini dəyişməyə ehtiyac yoxdur; onlar backend kodu tərəfindən istifadə olunacaq.
