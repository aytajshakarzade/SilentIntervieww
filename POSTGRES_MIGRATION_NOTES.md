# SilentInterview PostgreSQL conversion

The backend now uses Npgsql/EF Core PostgreSQL. The previous SQL Server migrations and SQL Server-specific startup repair SQL were removed because they cannot be applied directly to PostgreSQL.

## Deployment

Set `ConnectionStrings__DefaultConnection` on the Render API service to the PostgreSQL connection string supplied by the Render PostgreSQL service. Keep `JWT_KEY` and the other existing secrets.

On an empty PostgreSQL database the API uses `EnsureCreatedAsync()` to create the schema from the current EF Core model and then runs the existing seeder.

## Existing SQL Server data

This code conversion does not copy rows from the old local SQL Server database. Existing SQL Server data must be exported and imported separately into PostgreSQL before production use if those rows need to be preserved. Do not delete the old SQL Server database until that transfer is verified.
