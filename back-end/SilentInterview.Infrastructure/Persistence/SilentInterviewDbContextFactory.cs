using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;

namespace SilentInterview.Infrastructure.Persistence;

public class SilentInterviewDbContextFactory
    : IDesignTimeDbContextFactory<SilentInterviewDbContext>
{
    public SilentInterviewDbContext CreateDbContext(string[] args)
    {
        var basePath = Path.Combine(
            Directory.GetCurrentDirectory(),
            "..",
            "SilentInterview.Api");

        var configuration = new ConfigurationBuilder()
            .SetBasePath(basePath)
            .AddJsonFile("appsettings.json", optional: false)
            .Build();

        var optionsBuilder =
            new DbContextOptionsBuilder<SilentInterviewDbContext>();

        optionsBuilder.UseNpgsql(
            configuration.GetConnectionString("DefaultConnection"));

        return new SilentInterviewDbContext(optionsBuilder.Options);
    }
}