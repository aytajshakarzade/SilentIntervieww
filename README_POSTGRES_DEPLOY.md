# SilentInterview — PostgreSQL / Render deployment

The backend has been converted from SQL Server/EF Core SqlServer to PostgreSQL/Npgsql.

## What changed

- Replaced `Microsoft.EntityFrameworkCore.SqlServer` with `Npgsql.EntityFrameworkCore.PostgreSQL` 9.0.4.
- Replaced `UseSqlServer` with `UseNpgsql`.
- Replaced SQL Server-specific `nvarchar(max)` model types with PostgreSQL `text`.
- Removed the SQL Server-specific startup schema-repair SQL.
- Removed the old SQL Server migrations, which cannot be applied directly to PostgreSQL.
- On an empty PostgreSQL database, startup uses EF Core `EnsureCreatedAsync()` and then runs the existing seeder.
- Local Docker Compose now includes PostgreSQL 17.
- Render Free's `inotify` workaround remains enabled with `DOTNET_USE_POLLING_FILE_WATCHER=1`.

## Render PostgreSQL setup

1. Create a PostgreSQL database in Render.
2. Copy its **Internal Database URL** / connection details.
3. In the `Silent-Interview` web service, add:

   `ConnectionStrings__DefaultConnection`

   with a standard Npgsql connection string such as:

   `Host=...;Port=5432;Database=...;Username=...;Password=...;SSL Mode=Require;`

4. Keep `JWT_KEY` and the other application secrets already configured on the API.
5. Redeploy the API.
6. Check `/health/live` first, then `/health/ready` after the database connection is configured.

## Important: existing SQL Server data

This repository conversion changes the application/database provider, but it does **not** copy the rows from the existing local `SilentInterview_DB` SQL Server database. The old SQL Server database should be kept until its data is exported/imported and verified.

For a brand-new Render PostgreSQL database, the API creates the schema automatically from the current EF Core model.
