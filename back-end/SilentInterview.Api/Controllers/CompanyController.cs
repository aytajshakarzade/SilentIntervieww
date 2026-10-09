using System.Collections.Concurrent;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Asp.Versioning;

using SilentInterview.Api.Controllers.Base;
using SilentInterview.Api.Controllers.Base.Scoping;

using SilentInterview.Application.Common.Models;
using SilentInterview.Application.DTOs.Company;
using SilentInterview.Application.Interfaces;

using SilentInterview.Infrastructure.Persistence;

namespace SilentInterview.Api.Controllers;

/// <summary>
/// Company Management
/// </summary>
[Authorize]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/[controller]")]
public class CompanyController : BaseApiController
{
    private static readonly ConcurrentDictionary<string, (DateTimeOffset Expires, List<object> Items)> CompanyDirectoryCache = new();

    private readonly ICompanyService _companyService;
    private readonly SilentInterviewDbContext _context;
    private readonly IUserScopeResolver _scopeResolver;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IWebHostEnvironment _environment;

    public CompanyController(
        ICompanyService companyService,
        SilentInterviewDbContext context,
        IUserScopeResolver scopeResolver,
        IHttpClientFactory httpClientFactory,
        IWebHostEnvironment environment)
    {
        _companyService = companyService;
        _context = context;
        _scopeResolver = scopeResolver;
        _httpClientFactory = httpClientFactory;
        _environment = environment;
    }

    /// <summary>
    /// Public company directory used only during first-time Google recruiter setup.
    /// Returns minimal active-company data and never exposes private company fields.
    /// </summary>
    [HttpGet("public")]
    [AllowAnonymous]
    public async Task<IActionResult> GetPublic([FromQuery] string? country = null)
    {
        // International directory. We query Wikidata at request time so every supported
        // country can surface current, well-known organizations without shipping a
        // gigantic hard-coded 195-country table. If the public service is unavailable,
        // a small curated fallback keeps onboarding usable.
        if (!string.IsNullOrWhiteSpace(country))
        {
            try
            {
                var code = country.Trim().ToUpperInvariant();
                if (code.Length != 2 || !code.All(char.IsLetter))
                    return Failure("Country code must be a valid ISO-3166 alpha-2 code.", StatusCodes.Status400BadRequest);

                if (CompanyDirectoryCache.TryGetValue(code, out var cached) && cached.Expires > DateTimeOffset.UtcNow)
                    return Success(cached.Items, "International company directory retrieved from cache.");

                var sparql = $@"
SELECT ?company ?companyLabel ?industryLabel ?website ?revenue WHERE {{
  ?country wdt:P297 ""{code}"".
  ?company wdt:P17 ?country;
           wdt:P31/wdt:P279* wd:Q4830453.
  OPTIONAL {{ ?company wdt:P452 ?industry. }}
  OPTIONAL {{ ?company wdt:P856 ?website. }}
  OPTIONAL {{ ?company wdt:P2139 ?revenue. }}
  SERVICE wikibase:label {{ bd:serviceParam wikibase:language ""en"". }}
}}
ORDER BY DESC(COALESCE(?revenue, 0)) ?companyLabel
LIMIT 20";

                var client = _httpClientFactory.CreateClient("Wikidata");
                using var response = await client.GetAsync($"sparql?query={Uri.EscapeDataString(sparql)}&format=json");
                if (response.IsSuccessStatusCode)
                {
                    using var stream = await response.Content.ReadAsStreamAsync();
                    using var doc = await System.Text.Json.JsonDocument.ParseAsync(stream);
                    var rows = new List<object>();
                    if (doc.RootElement.TryGetProperty("results", out var results) && results.TryGetProperty("bindings", out var bindings))
                    {
                        foreach (var row in bindings.EnumerateArray().Take(20))
                        {
                            string Value(string key) => row.TryGetProperty(key, out var prop) && prop.TryGetProperty("value", out var value) ? value.GetString() ?? "" : "";
                            var name = Value("companyLabel");
                            if (string.IsNullOrWhiteSpace(name)) continue;
                            rows.Add(new
                            {
                                id = Guid.Empty,
                                name,
                                industry = Value("industryLabel"),
                                country = code,
                                website = Value("website")
                            });
                        }
                    }
                    if (rows.Count > 0)
                    {
                        CompanyDirectoryCache[code] = (DateTimeOffset.UtcNow.AddHours(12), rows);
                        return Success(rows, "International company directory retrieved successfully.");
                    }
                }
            }
            catch
            {
                // Fall through to curated local data. Public onboarding must not fail
                // simply because a third-party directory is temporarily unavailable.
            }
        }

        var directory = new[]
        {
            new { id = Guid.Empty, name = "SOCAR", industry = "Energy", country = "AZ", website = "https://socar.az" },
            new { id = Guid.Empty, name = "PASHA Holding", industry = "Financial Services", country = "AZ", website = "https://pasha-holding.az" },
            new { id = Guid.Empty, name = "Kapital Bank", industry = "Banking", country = "AZ", website = "https://kapitalbank.az" },
            new { id = Guid.Empty, name = "Azercell", industry = "Telecommunications", country = "AZ", website = "https://azercell.com" },
            new { id = Guid.Empty, name = "Bakcell", industry = "Telecommunications", country = "AZ", website = "https://bakcell.com" },
            new { id = Guid.Empty, name = "PASHA Bank", industry = "Banking", country = "AZ", website = "https://pashabank.az" },
            new { id = Guid.Empty, name = "ABB", industry = "Banking", country = "AZ", website = "https://abb-bank.az" },
            new { id = Guid.Empty, name = "Unibank", industry = "Banking", country = "AZ", website = "https://unibank.az" },
            new { id = Guid.Empty, name = "AccessBank", industry = "Banking", country = "AZ", website = "https://accessbank.az" },
            new { id = Guid.Empty, name = "Azerbaijan Airlines", industry = "Aviation", country = "AZ", website = "https://azal.az" },
            new { id = Guid.Empty, name = "Norm", industry = "Construction Materials", country = "AZ", website = "https://norm.az" },
            new { id = Guid.Empty, name = "Veyseloglu Group", industry = "Retail", country = "AZ", website = "https://veyseloglu.az" },
            new { id = Guid.Empty, name = "Azerbaijan Railways", industry = "Transportation", country = "AZ", website = "https://ady.az" },
            new { id = Guid.Empty, name = "AzerTelecom", industry = "Telecommunications", country = "AZ", website = "https://azertelecom.az" },
            new { id = Guid.Empty, name = "Bakinity Distribution", industry = "Distribution", country = "AZ", website = "https://bakinity.com" },
            new { id = Guid.Empty, name = "Silk Way Group", industry = "Logistics & Aviation", country = "AZ", website = "https://silkwaygroup.com" },
            new { id = Guid.Empty, name = "Gilan Holding", industry = "Diversified", country = "AZ", website = "https://gilanholding.com" },
            new { id = Guid.Empty, name = "AzGranata", industry = "Food & Beverage", country = "AZ", website = "https://azgranata.az" },
            new { id = Guid.Empty, name = "AtaHolding", industry = "Diversified", country = "AZ", website = "https://ataholding.az" },
            new { id = Guid.Empty, name = "Microsoft", industry = "Technology", country = "US", website = "https://microsoft.com" },
            new { id = Guid.Empty, name = "Google", industry = "Technology", country = "US", website = "https://google.com" },
            new { id = Guid.Empty, name = "Amazon", industry = "Technology & E-commerce", country = "US", website = "https://amazon.com" },
            new { id = Guid.Empty, name = "Apple", industry = "Technology", country = "US", website = "https://apple.com" },
            new { id = Guid.Empty, name = "NVIDIA", industry = "Semiconductors & AI", country = "US", website = "https://nvidia.com" },
            new { id = Guid.Empty, name = "OpenAI", industry = "Artificial Intelligence", country = "US", website = "https://openai.com" },
            new { id = Guid.Empty, name = "Stripe", industry = "Fintech", country = "US", website = "https://stripe.com" },
            new { id = Guid.Empty, name = "JPMorgan Chase", industry = "Banking", country = "US", website = "https://jpmorganchase.com" },
            new { id = Guid.Empty, name = "Walmart", industry = "Retail", country = "US", website = "https://walmart.com" },
            new { id = Guid.Empty, name = "Berkshire Hathaway", industry = "Financial Services", country = "US", website = "https://berkshirehathaway.com" },
            new { id = Guid.Empty, name = "Johnson & Johnson", industry = "Healthcare", country = "US", website = "https://jnj.com" },
            new { id = Guid.Empty, name = "Visa", industry = "Fintech", country = "US", website = "https://visa.com" },
            new { id = Guid.Empty, name = "Mastercard", industry = "Fintech", country = "US", website = "https://mastercard.com" },
            new { id = Guid.Empty, name = "Coca-Cola", industry = "Consumer Goods", country = "US", website = "https://coca-cola.com" },
            new { id = Guid.Empty, name = "McDonald's", industry = "Food Service", country = "US", website = "https://mcdonalds.com" },
            new { id = Guid.Empty, name = "Walt Disney", industry = "Entertainment", country = "US", website = "https://disney.com" },
            new { id = Guid.Empty, name = "IBM", industry = "Technology", country = "US", website = "https://ibm.com" },
            new { id = Guid.Empty, name = "Tesla", industry = "Automotive & Technology", country = "US", website = "https://tesla.com" },
            new { id = Guid.Empty, name = "Meta", industry = "Technology", country = "US", website = "https://meta.com" },
            new { id = Guid.Empty, name = "Toyota", industry = "Automotive", country = "JP", website = "https://toyota.com" },
            new { id = Guid.Empty, name = "Sony", industry = "Electronics & Entertainment", country = "JP", website = "https://sony.com" },
            new { id = Guid.Empty, name = "Samsung Electronics", industry = "Electronics", country = "KR", website = "https://samsung.com" },
            new { id = Guid.Empty, name = "SAP", industry = "Enterprise Software", country = "DE", website = "https://sap.com" },
            new { id = Guid.Empty, name = "Siemens", industry = "Industrial Technology", country = "DE", website = "https://siemens.com" },
            new { id = Guid.Empty, name = "BMW", industry = "Automotive", country = "DE", website = "https://bmw.com" },
            new { id = Guid.Empty, name = "Mercedes-Benz", industry = "Automotive", country = "DE", website = "https://mercedes-benz.com" },
            new { id = Guid.Empty, name = "Deutsche Telekom", industry = "Telecommunications", country = "DE", website = "https://telekom.com" },
            new { id = Guid.Empty, name = "Allianz", industry = "Insurance", country = "DE", website = "https://allianz.com" },
            new { id = Guid.Empty, name = "Bosch", industry = "Engineering", country = "DE", website = "https://bosch.com" },
            new { id = Guid.Empty, name = "Volkswagen", industry = "Automotive", country = "DE", website = "https://volkswagen.com" },
            new { id = Guid.Empty, name = "TotalEnergies", industry = "Energy", country = "FR", website = "https://totalenergies.com" },
            new { id = Guid.Empty, name = "LVMH", industry = "Luxury", country = "FR", website = "https://lvmh.com" },
            new { id = Guid.Empty, name = "L'Oréal", industry = "Beauty", country = "FR", website = "https://loreal.com" },
            new { id = Guid.Empty, name = "Airbus", industry = "Aerospace", country = "FR", website = "https://airbus.com" },
            new { id = Guid.Empty, name = "Orange", industry = "Telecommunications", country = "FR", website = "https://orange.com" },
            new { id = Guid.Empty, name = "HSBC", industry = "Banking", country = "GB", website = "https://hsbc.com" },
            new { id = Guid.Empty, name = "Shell", industry = "Energy", country = "GB", website = "https://shell.com" },
            new { id = Guid.Empty, name = "Unilever", industry = "Consumer Goods", country = "GB", website = "https://unilever.com" },
            new { id = Guid.Empty, name = "AstraZeneca", industry = "Pharmaceuticals", country = "GB", website = "https://astrazeneca.com" },
            new { id = Guid.Empty, name = "Barclays", industry = "Banking", country = "GB", website = "https://barclays.com" },
            new { id = Guid.Empty, name = "Toyota", industry = "Automotive", country = "JP", website = "https://toyota.com" },
            new { id = Guid.Empty, name = "Honda", industry = "Automotive", country = "JP", website = "https://honda.com" },
            new { id = Guid.Empty, name = "Mitsubishi", industry = "Conglomerate", country = "JP", website = "https://mitsubishi.com" },
            new { id = Guid.Empty, name = "Hitachi", industry = "Technology", country = "JP", website = "https://hitachi.com" },
            new { id = Guid.Empty, name = "SoftBank", industry = "Technology & Telecom", country = "JP", website = "https://softbank.jp" },
            new { id = Guid.Empty, name = "Hyundai Motor", industry = "Automotive", country = "KR", website = "https://hyundai.com" },
            new { id = Guid.Empty, name = "LG Electronics", industry = "Electronics", country = "KR", website = "https://lg.com" },
            new { id = Guid.Empty, name = "SK Group", industry = "Conglomerate", country = "KR", website = "https://sk.com" },
            new { id = Guid.Empty, name = "Tencent", industry = "Technology", country = "CN", website = "https://tencent.com" },
            new { id = Guid.Empty, name = "Alibaba", industry = "Technology & E-commerce", country = "CN", website = "https://alibabagroup.com" },
            new { id = Guid.Empty, name = "Huawei", industry = "Telecommunications", country = "CN", website = "https://huawei.com" },
            new { id = Guid.Empty, name = "ICBC", industry = "Banking", country = "CN", website = "https://icbc-ltd.com" },
            new { id = Guid.Empty, name = "Tata Group", industry = "Conglomerate", country = "IN", website = "https://tata.com" },
            new { id = Guid.Empty, name = "Reliance Industries", industry = "Conglomerate", country = "IN", website = "https://ril.com" },
            new { id = Guid.Empty, name = "Infosys", industry = "IT Services", country = "IN", website = "https://infosys.com" },
            new { id = Guid.Empty, name = "HDFC Bank", industry = "Banking", country = "IN", website = "https://hdfcbank.com" },
            new { id = Guid.Empty, name = "Turkish Airlines", industry = "Aviation", country = "TR", website = "https://turkishairlines.com" },
            new { id = Guid.Empty, name = "Koç Holding", industry = "Conglomerate", country = "TR", website = "https://koc.com.tr" },
            new { id = Guid.Empty, name = "Sabancı Holding", industry = "Conglomerate", country = "TR", website = "https://sabanci.com" },
            new { id = Guid.Empty, name = "Arçelik", industry = "Consumer Electronics", country = "TR", website = "https://arcelik.com" },
            new { id = Guid.Empty, name = "Emirates", industry = "Aviation", country = "AE", website = "https://emirates.com" },
            new { id = Guid.Empty, name = "DP World", industry = "Logistics", country = "AE", website = "https://dpworld.com" },
            new { id = Guid.Empty, name = "Etisalat", industry = "Telecommunications", country = "AE", website = "https://eand.com" },
            new { id = Guid.Empty, name = "ADNOC", industry = "Energy", country = "AE", website = "https://adnoc.ae" },
            new { id = Guid.Empty, name = "Qatar Airways", industry = "Aviation", country = "QA", website = "https://qatarairways.com" },
            new { id = Guid.Empty, name = "QatarEnergy", industry = "Energy", country = "QA", website = "https://qatarenergy.qa" },
            new { id = Guid.Empty, name = "Maersk", industry = "Logistics", country = "DK", website = "https://maersk.com" },
            new { id = Guid.Empty, name = "Novo Nordisk", industry = "Pharmaceuticals", country = "DK", website = "https://novonordisk.com" },
            new { id = Guid.Empty, name = "IKEA", industry = "Retail", country = "SE", website = "https://ikea.com" },
            new { id = Guid.Empty, name = "Ericsson", industry = "Telecommunications", country = "SE", website = "https://ericsson.com" },
            new { id = Guid.Empty, name = "Nestlé", industry = "Food & Beverage", country = "CH", website = "https://nestle.com" },
            new { id = Guid.Empty, name = "UBS", industry = "Banking", country = "CH", website = "https://ubs.com" },
        };
        var filtered = string.IsNullOrWhiteSpace(country)
            ? directory
            : directory.Where(x => string.Equals(x.country, country.Trim(), StringComparison.OrdinalIgnoreCase)).ToArray();
        var fallbackRows = filtered.Cast<object>().ToList();
        if (!string.IsNullOrWhiteSpace(country) && fallbackRows.Count > 0)
            CompanyDirectoryCache[country.Trim().ToUpperInvariant()] = (DateTimeOffset.UtcNow.AddHours(12), fallbackRows);
        return Success(fallbackRows, "International company directory retrieved successfully.");
    }

    /// <summary>
    /// Upload a company logo. Files are stored under wwwroot/uploads/companies and the
    /// resulting public URL is returned so the recruiter can persist it on the company.
    /// </summary>
    [HttpPost("{id:guid}/logo")]
    [Authorize(Roles = "Recruiter")]
    [RequestSizeLimit(2_000_000)]
    public async Task<IActionResult> UploadLogo(Guid id, IFormFile file)
    {
        var scope = await _scopeResolver.GetCompanyScopeAsync(this);
        if (scope.IsError) return scope.Error!;
        if (scope.CompanyId.HasValue && scope.CompanyId.Value != id)
            return Failure("You can only update your own company.", StatusCodes.Status403Forbidden);
        if (file == null || file.Length == 0)
            return Failure("Please choose an image.", StatusCodes.Status400BadRequest);

        var allowed = new[] { "image/png", "image/jpeg", "image/webp" };
        if (!allowed.Contains(file.ContentType, StringComparer.OrdinalIgnoreCase))
            return Failure("Only PNG, JPEG, and WebP images are supported.", StatusCodes.Status400BadRequest);

        // Validate the file signature as well as Content-Type so a renamed executable
        // or HTML payload cannot be stored as a public image.
        await using (var signatureStream = file.OpenReadStream())
        {
            var header = new byte[12];
            var read = await signatureStream.ReadAsync(header.AsMemory(0, header.Length));
            var isPng = read >= 8 && header.AsSpan(0, 8).SequenceEqual(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 });
            var isJpeg = read >= 3 && header.AsSpan(0, 3).SequenceEqual(new byte[] { 255, 216, 255 });
            var isWebp = read >= 12 && header.AsSpan(0, 4).SequenceEqual("RIFF"u8) && header.AsSpan(8, 4).SequenceEqual("WEBP"u8);
            if (!isPng && !isJpeg && !isWebp)
                return Failure("The uploaded file is not a valid image.", StatusCodes.Status400BadRequest);
        }

        var company = await _context.Companies.FindAsync(id);
        if (company == null || company.IsDeleted)
            return Failure("Company not found.", StatusCodes.Status404NotFound);

        var directory = Path.Combine(_environment.WebRootPath ?? Path.Combine(_environment.ContentRootPath, "wwwroot"), "uploads", "companies");
        Directory.CreateDirectory(directory);
        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        var fileName = $"{id:N}-{Guid.NewGuid():N}{extension}";
        var physicalPath = Path.Combine(directory, fileName);
        await using (var stream = System.IO.File.Create(physicalPath))
            await file.CopyToAsync(stream);

        var baseUrl = $"{Request.Scheme}://{Request.Host}";
        company.LogoUrl = $"{baseUrl}/uploads/companies/{fileName}";
        await _context.SaveChangesAsync();
        return Success(new { logoUrl = company.LogoUrl }, "Company logo uploaded successfully.");
    }

    /// <summary>
    /// Get all companies
    /// </summary>
    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll(
        [FromQuery] CompanyQueryParameters parameters)
    {
        var scope = await _scopeResolver.GetCompanyScopeAsync(this);

        if (scope.IsError)
            return scope.Error!;

        var companies =
            await _companyService.GetAllAsync(parameters, scope.CompanyId);

        return Success(companies, "Companies retrieved successfully.");
    }

    /// <summary>
    /// Get company by id
    /// </summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid id)
    {
        var scope = await _scopeResolver.GetCompanyScopeAsync(this);

        if (scope.IsError)
            return scope.Error!;

        var company =
            await _companyService.GetByIdAsync(id, scope.CompanyId);

        if (company == null)
        {
            return Failure(
                "Company not found.",
                StatusCodes.Status404NotFound);
        }

        return Success(company, "Company retrieved successfully.");
    }

    /// <summary>
    /// Create company
    /// </summary>
    [HttpPost]
    [Authorize(Roles = "Recruiter")]
    [ProducesResponseType(StatusCodes.Status201Created)]
    public async Task<IActionResult> Create(
        CreateCompanyRequest request)
    {
        // The recruiter's userId is needed so CreateAsync can update
        // Recruiter.CompanyId to the newly created company — without it
        // the scope resolver keeps returning the old CompanyId and all
        // subsequent Update/Delete/Restore calls return 404.
        if (!Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId))
        {
            return Failure("Authenticated user could not be identified.", StatusCodes.Status401Unauthorized);
        }

        var company =
            await _companyService.CreateAsync(request, userId);

        return Success(
            company,
            "Company created successfully.",
            StatusCodes.Status201Created);
    }

    /// <summary>
    /// Update company
    /// </summary>
    [HttpPut("{id:guid}")]
    [Authorize(Roles = "Recruiter")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(
        Guid id,
        UpdateCompanyRequest request)
    {
        var scope = await _scopeResolver.GetCompanyScopeAsync(this);

        if (scope.IsError)
            return scope.Error!;

        var company =
            await _companyService.UpdateAsync(
                id,
                request,
                scope.CompanyId);

        if (company == null)
        {
            return Failure(
                "Company not found.",
                StatusCodes.Status404NotFound);
        }

        return Success(
            company,
            "Company updated successfully.");
    }

    /// <summary>
    /// Soft delete company
    /// </summary>
    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "Recruiter")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var scope = await _scopeResolver.GetCompanyScopeAsync(this);

        if (scope.IsError)
            return scope.Error!;

        var deleted =
            await _companyService.DeleteAsync(
                id,
                scope.CompanyId);

        if (!deleted)
        {
            return Failure(
                "Company not found.",
                StatusCodes.Status404NotFound);
        }

        return Success(
            true,
            "Company archived successfully.");
    }

    /// <summary>
    /// Restore archived company
    /// </summary>
    [HttpPut("{id:guid}/restore")]
    [Authorize(Roles = "Recruiter")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Restore(Guid id)
    {
        var scope = await _scopeResolver.GetCompanyScopeAsync(this);

        if (scope.IsError)
            return scope.Error!;

        var restored =
            await _companyService.RestoreAsync(
                id,
                scope.CompanyId);

        if (!restored)
        {
            return Failure(
                "Company not found.",
                StatusCodes.Status404NotFound);
        }

        return Success(
            true,
            "Company restored successfully.");
    }
}