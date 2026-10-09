using FluentValidation;
using FluentValidation.AspNetCore;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using Serilog;
using SilentInterview.Api.Controllers.Base.Scoping;
using SilentInterview.Api.Middleware;
using SilentInterview.Application.Common.Interfaces;
using SilentInterview.Application.Settings;
using SilentInterview.Application.Validators.Auth;
using SilentInterview.Infrastructure.AI;
using SilentInterview.Application.Interfaces;
using SilentInterview.Infrastructure.DependencyInjection;
using System.Text;
using Asp.Versioning;
using Microsoft.EntityFrameworkCore;
using SilentInterview.Infrastructure.Persistence;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;
using DotNetEnv;

//
// Render Free container-də inotify/file-watcher limitini keçməmək üçün
// ASP.NET Core configuration fayllarını polling ilə izləyir.
//
Environment.SetEnvironmentVariable(
    "DOTNET_USE_POLLING_FILE_WATCHER",
    "1"
);

var builder = WebApplication.CreateBuilder(args);

//
// ======================================================
// Local .env
// ======================================================
//

var environmentFile = Path.Combine(
    builder.Environment.ContentRootPath,
    "..",
    ".env"
);

if (File.Exists(environmentFile))
{
    Env.Load(environmentFile);
    builder.Configuration.AddEnvironmentVariables();
}

//
// ======================================================
// PostgreSQL
// ======================================================
//

// Render exposes its managed PostgreSQL credentials as PG* environment variables.
// appsettings.json contains a local-development fallback (Host=localhost), so
// explicitly build the production connection string from PG* when PGHOST exists.
var connectionString =
    builder.Configuration.GetConnectionString("DefaultConnection");

var pgHost = builder.Configuration["PGHOST"]?.Trim();
if (!string.IsNullOrWhiteSpace(pgHost))
{
    var pgDatabase = builder.Configuration["PGDATABASE"]?.Trim();
    var pgUser = builder.Configuration["PGUSER"]?.Trim();
    var pgPassword = builder.Configuration["PGPASSWORD"];
    var pgPortValue = builder.Configuration["PGPORT"];

    if (string.IsNullOrWhiteSpace(pgDatabase) ||
        string.IsNullOrWhiteSpace(pgUser) ||
        string.IsNullOrWhiteSpace(pgPassword))
    {
        throw new InvalidOperationException(
            "PGHOST is set, but one or more required PostgreSQL variables are missing: PGDATABASE, PGUSER, PGPASSWORD."
        );
    }

    var pgPort = int.TryParse(pgPortValue, out var parsedPort) ? parsedPort : 5432;
    var postgresBuilder = new Npgsql.NpgsqlConnectionStringBuilder
    {
        Host = pgHost,
        Port = pgPort,
        Database = pgDatabase,
        Username = pgUser,
        Password = pgPassword
    };
    connectionString = postgresBuilder.ConnectionString;
    builder.Configuration["ConnectionStrings:DefaultConnection"] = connectionString;
}

if (string.IsNullOrWhiteSpace(connectionString))
{
    throw new InvalidOperationException(
        "Configure ConnectionStrings:DefaultConnection or the PGHOST, PGDATABASE, PGUSER and PGPASSWORD environment variables for PostgreSQL."
    );
}

//
// ======================================================
// JWT
// ======================================================
//

var jwtKey =
    builder.Configuration["Jwt:Key"]
    ?? builder.Configuration["JWT_KEY"]
    ?? Environment.GetEnvironmentVariable("JWT_KEY")
    ?? Environment.GetEnvironmentVariable("Jwt__Key");

if (string.IsNullOrWhiteSpace(jwtKey) || jwtKey.Length < 32)
{
    throw new InvalidOperationException(
        "Jwt:Key must be configured with at least 32 characters. Set JWT_KEY in the API environment."
    );
}

builder.Configuration["Jwt:Key"] = jwtKey;

//
// ======================================================
// Google OAuth
// ======================================================
//

var googleClientId = new[]
{
    builder.Configuration["Google:ClientId"],
    builder.Configuration["Google__ClientId"],
    builder.Configuration["VITE_GOOGLE_CLIENT_ID"],
    Environment.GetEnvironmentVariable("Google__ClientId"),
    Environment.GetEnvironmentVariable("GOOGLE_CLIENT_ID"),
    Environment.GetEnvironmentVariable("VITE_GOOGLE_CLIENT_ID")
}
.Where(v => !string.IsNullOrWhiteSpace(v))
.Select(v => v!.Trim())
.FirstOrDefault(v =>
    !v.Equals(
        "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com",
        StringComparison.OrdinalIgnoreCase
    )
);

if (!string.IsNullOrWhiteSpace(googleClientId))
{
    builder.Configuration["Google:ClientId"] = googleClientId;
}

//
// ======================================================
// CORS
// ======================================================
//
// Production frontend:
// https://silent-interview-7db6.vercel.app
//
// We keep configured origins, but always include the
// real production frontend origin so a missing/wrong
// FRONTEND_ORIGIN cannot break production CORS.
//

var configuredOrigins =
    builder.Configuration
        .GetSection("Cors:AllowedOrigins")
        .Get<string[]>() ?? [];

var configuredFrontendOrigin =
    builder.Configuration["FRONTEND_ORIGIN"];

var allowedOrigins = new HashSet<string>(
    StringComparer.OrdinalIgnoreCase
);

foreach (var origin in configuredOrigins)
{
    if (string.IsNullOrWhiteSpace(origin))
        continue;

    var normalizedOrigin =
        origin.Trim().TrimEnd('/');

    if (Uri.TryCreate(
            normalizedOrigin,
            UriKind.Absolute,
            out var parsedOrigin)
        && (parsedOrigin.Scheme == Uri.UriSchemeHttp
            || parsedOrigin.Scheme == Uri.UriSchemeHttps)
        && string.IsNullOrWhiteSpace(parsedOrigin.AbsolutePath.Trim('/')))
    {
        allowedOrigins.Add(normalizedOrigin);
    }
}

if (!string.IsNullOrWhiteSpace(configuredFrontendOrigin))
{
    var normalizedFrontendOrigin =
        configuredFrontendOrigin.Trim().TrimEnd('/');

    if (Uri.TryCreate(
            normalizedFrontendOrigin,
            UriKind.Absolute,
            out var parsedFrontendOrigin)
        && (parsedFrontendOrigin.Scheme == Uri.UriSchemeHttp
            || parsedFrontendOrigin.Scheme == Uri.UriSchemeHttps)
        && string.IsNullOrWhiteSpace(
            parsedFrontendOrigin.AbsolutePath.Trim('/')))
    {
        allowedOrigins.Add(normalizedFrontendOrigin);
    }
}

// REQUIRED production origin
allowedOrigins.Add(
    "https://silent-interview-7db6.vercel.app"
);

// Local development support
if (builder.Environment.IsDevelopment())
{
    allowedOrigins.Add("http://localhost:3000");
    allowedOrigins.Add("http://localhost:5173");
}

if (!builder.Environment.IsDevelopment() &&
    allowedOrigins.Count == 0)
{
    throw new InvalidOperationException(
        "At least one CORS allowed origin must be configured outside development."
    );
}

//
// ======================================================
// Serilog
// ======================================================
//

builder.Host.UseSerilog((context, configuration) =>
{
    configuration.ReadFrom.Configuration(
        context.Configuration
    );
});

//
// ======================================================
// Controllers
// ======================================================
//

builder.Services.AddControllers();
builder.Services.AddHealthChecks();

//
// ======================================================
// API Versioning
// ======================================================
//

builder.Services
    .AddApiVersioning(options =>
    {
        options.DefaultApiVersion =
            new ApiVersion(1, 0);

        options.AssumeDefaultVersionWhenUnspecified =
            true;

        options.ReportApiVersions =
            true;

        options.ApiVersionReader =
            new UrlSegmentApiVersionReader();
    })
    .AddMvc()
    .AddApiExplorer(options =>
    {
        options.GroupNameFormat = "'v'VVV";
        options.SubstituteApiVersionInUrl = true;
    });

//
// ======================================================
// HTTP Clients
// ======================================================
//

builder.Services.AddHttpClient(
    "Wikidata",
    client =>
    {
        client.BaseAddress =
            new Uri("https://query.wikidata.org/");

        client.Timeout =
            TimeSpan.FromSeconds(8);

        client.DefaultRequestHeaders.UserAgent.ParseAdd(
            "SilentInterview/1.0 (company-directory)"
        );
    }
);

builder.Services
    .AddHttpClient<IWhisperService, WhisperService>();

builder.Services
    .AddHttpClient<IGrammarCheckService, GrammarCheckService>();

builder.Services
    .AddHttpClient<IOpenRouterService, GroqService>();

//
// ======================================================
// FluentValidation
// ======================================================
//

builder.Services
    .AddFluentValidationAutoValidation();

builder.Services
    .AddFluentValidationClientsideAdapters();

builder.Services
    .AddValidatorsFromAssemblyContaining<
        RegisterRequestValidator
    >();

//
// ======================================================
// JWT Settings
// ======================================================
//

builder.Services.Configure<JwtSettings>(
    builder.Configuration.GetSection(
        JwtSettings.SectionName
    )
);

builder.Services.Configure<InterviewReportSettings>(
    builder.Configuration.GetSection(
        InterviewReportSettings.SectionName
    )
);

builder.Services.Configure<OpenRouterSettings>(
    builder.Configuration.GetSection(
        OpenRouterSettings.SectionName
    )
);

//
// ======================================================
// Infrastructure
// ======================================================
//

builder.Services.AddInfrastructure(
    builder.Configuration
);

//
// ======================================================
// API Scoping
// ======================================================
//

builder.Services.AddScoped<IUserScopeResolver, UserScopeResolver>();

builder.Services.AddScoped<
    IInterviewSessionAccessGuard,
    InterviewSessionAccessGuard
>();

//
// ======================================================
// Authentication
// ======================================================
//

builder.Services
    .AddAuthentication(
        JwtBearerDefaults.AuthenticationScheme
    )
    .AddJwtBearer(options =>
    {
        options.RequireHttpsMetadata =
            !builder.Environment.IsDevelopment();

        options.TokenValidationParameters =
            new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidateAudience = true,
                ValidateLifetime = true,
                ValidateIssuerSigningKey = true,

                ClockSkew = TimeSpan.Zero,

                ValidIssuer =
                    builder.Configuration["Jwt:Issuer"],

                ValidAudience =
                    builder.Configuration["Jwt:Audience"],

                IssuerSigningKey =
                    new SymmetricSecurityKey(
                        Encoding.UTF8.GetBytes(jwtKey)
                    )
            };

        options.Events =
            new JwtBearerEvents
            {
                OnTokenValidated = async context =>
                {
                    var userIdValue =
                        context.Principal?
                            .FindFirst(
                                System.Security.Claims.ClaimTypes
                                    .NameIdentifier
                            )
                            ?.Value;

                    if (!Guid.TryParse(
                            userIdValue,
                            out var userId))
                    {
                        context.Fail(
                            "Invalid user identity."
                        );

                        return;
                    }

                    var db =
                        context.HttpContext
                            .RequestServices
                            .GetRequiredService<
                                SilentInterviewDbContext
                            >();

                    var user =
                        await db.Users
                            .IgnoreQueryFilters()
                            .AsNoTracking()
                            .FirstOrDefaultAsync(
                                x => x.Id == userId
                            );

                    if (user is null ||
                        user.IsDeleted ||
                        !user.IsActive)
                    {
                        context.Fail(
                            "Account is suspended or unavailable."
                        );
                    }
                }
            };
    });

//
// ======================================================
// Authorization
// ======================================================
//

builder.Services.AddAuthorization(
    options =>
    {
        options.FallbackPolicy =
            new Microsoft.AspNetCore.Authorization
                .AuthorizationPolicyBuilder()
                .RequireAuthenticatedUser()
                .Build();
    }
);

//
// ======================================================
// CORS
// ======================================================
//

builder.Services.AddCors(options =>
{
    options.AddPolicy(
        "ReactPolicy",
        policy =>
        {
            policy
                .WithOrigins(
                    allowedOrigins.ToArray()
                )
                .AllowAnyHeader()
                .AllowAnyMethod()
                .AllowCredentials();
        }
    );
});

//
// ======================================================
// Rate Limiting
// ======================================================
//

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode =
        StatusCodes.Status429TooManyRequests;

    options.AddFixedWindowLimiter(
        "authentication",
        limiterOptions =>
        {
            limiterOptions.PermitLimit = 10;

            limiterOptions.Window =
                TimeSpan.FromMinutes(1);

            limiterOptions.QueueLimit = 0;

            limiterOptions.AutoReplenishment =
                true;
        }
    );
});

//
// ======================================================
// Swagger
// ======================================================
//

builder.Services.AddEndpointsApiExplorer();

builder.Services.AddSwaggerGen(
    options =>
    {
        options.SwaggerDoc(
            "v1",
            new OpenApiInfo
            {
                Title = "SilentInterview API",
                Version = "v1",
                Description =
                    "Enterprise Recruitment Platform API"
            }
        );

        options.AddSecurityDefinition(
            "Bearer",
            new OpenApiSecurityScheme
            {
                Name = "Authorization",
                Type = SecuritySchemeType.Http,
                Scheme = "Bearer",
                BearerFormat = "JWT",
                In = ParameterLocation.Header,
                Description =
                    "Enter: Bearer {token}"
            }
        );

        options.AddSecurityRequirement(
            new OpenApiSecurityRequirement
            {
                {
                    new OpenApiSecurityScheme
                    {
                        Reference =
                            new OpenApiReference
                            {
                                Id = "Bearer",
                                Type =
                                    ReferenceType.SecurityScheme
                            }
                    },
                    Array.Empty<string>()
                }
            }
        );
    }
);

var app = builder.Build();

//
// ======================================================
// Container Liveness
// ======================================================
//

app.Use(
    async (context, next) =>
    {
        if (context.Request.Path.Equals(
                "/health/live",
                StringComparison.OrdinalIgnoreCase))
        {
            context.Response.StatusCode =
                StatusCodes.Status200OK;

            context.Response.ContentType =
                "application/json";

            await context.Response.WriteAsync(
                "{\"status\":\"ok\"}"
            );

            return;
        }

        await next();
    }
);

//
// Static files
//

app.UseStaticFiles();

//
// ======================================================
// Database Initialization
// ======================================================
//

async Task InitializeDatabaseAsync()
{
    try
    {
        using var scope =
            app.Services.CreateScope();

        var db =
            scope.ServiceProvider
                .GetRequiredService<
                    SilentInterviewDbContext
                >();

        db.Database.SetCommandTimeout(
            TimeSpan.FromSeconds(30)
        );

        await db.Database.EnsureCreatedAsync();

        await DbSeeder.SeedAsync(db);

        Log.Information(
            "PostgreSQL database schema creation and seed completed successfully."
        );
    }
    catch (Exception ex)
    {
        Log.Error(
            ex,
            "PostgreSQL database initialization failed. The API remains available; fix the PostgreSQL connection and retry the container."
        );
    }
}

app.Lifetime.ApplicationStarted.Register(
    () =>
    {
        _ = InitializeDatabaseAsync();
    }
);

//
// ======================================================
// Swagger
// ======================================================
//

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

//
// ======================================================
// HTTPS
// ======================================================
//

var httpsPortConfigured =
    !string.IsNullOrEmpty(
        builder.Configuration["HTTPS_PORT"]
    )
    ||
    !string.IsNullOrEmpty(
        Environment.GetEnvironmentVariable(
            "ASPNETCORE_HTTPS_PORT"
        )
    )
    ||
    (
        Environment.GetEnvironmentVariable(
            "ASPNETCORE_URLS"
        )
        ?.Contains(
            "https://",
            StringComparison.OrdinalIgnoreCase
        )
        ?? false
    );

if (!app.Environment.IsDevelopment() &&
    httpsPortConfigured)
{
    app.UseHsts();
}

//
// ======================================================
// Serilog request logging
// ======================================================
//

app.UseSerilogRequestLogging();

//
// ======================================================
// Security Headers
// ======================================================
//

app.Use(
    async (context, next) =>
    {
        context.Response.Headers[
            "X-Content-Type-Options"
        ] = "nosniff";

        context.Response.Headers[
            "X-Frame-Options"
        ] = "DENY";

        context.Response.Headers[
            "Referrer-Policy"
        ] = "strict-origin-when-cross-origin";

        context.Response.Headers[
            "Permissions-Policy"
        ] =
            "camera=(self), microphone=(self), geolocation=()";

        await next();
    }
);

//
// ======================================================
// Global Exception Middleware
// ======================================================
//

app.UseGlobalException();

//
// ======================================================
// Health endpoints
// ======================================================
//

app.MapGet(
        "/health/live",
        () => Results.Ok(
            new { status = "ok" }
        )
    )
    .AllowAnonymous();

//
// ======================================================
// CORS
// ======================================================
//
// IMPORTANT:
// CORS is deliberately before:
//
// - HTTPS redirection
// - Rate limiter
// - Authentication
// - Authorization
// - Controllers
//
// This allows OPTIONS preflight requests to receive
// Access-Control-Allow-Origin correctly.
//

app.UseCors("ReactPolicy");

//
// ======================================================
// HTTPS Redirection
// ======================================================
//

if (!app.Environment.IsDevelopment() &&
    httpsPortConfigured)
{
    app.UseHttpsRedirection();
}

//
// ======================================================
// Rate Limiting
// ======================================================
//

app.UseRateLimiter();

//
// ======================================================
// Authentication
// ======================================================
//

app.UseAuthentication();

//
// ======================================================
// Authorization
// ======================================================
//

app.UseAuthorization();

//
// ======================================================
// Controllers
// ======================================================
//

app.MapControllers();

//
// ======================================================
// Ready Health Check
// ======================================================
//

app.MapGet(
        "/health/ready",
        async (
            SilentInterviewDbContext db
        ) =>
        {
            try
            {
                await db.Database.CanConnectAsync();

                return Results.Ok(
                    new
                    {
                        status = "ready",
                        database = "ok"
                    }
                );
            }
            catch
            {
                return Results.StatusCode(
                    StatusCodes
                        .Status503ServiceUnavailable
                );
            }
        }
    )
    .AllowAnonymous();

app.MapHealthChecks(
        "/health"
    )
    .AllowAnonymous();

//
// ======================================================
// Run
// ======================================================
//

try
{
    Log.Information(
        "Starting SilentInterview API"
    );

    app.Run();
}
catch (Exception ex)
{
    Log.Fatal(
        ex,
        "Application terminated unexpectedly"
    );
}
finally
{
    Log.CloseAndFlush();
}
