# Build stage
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build

WORKDIR /src

COPY ["SilentInterview.Api/SilentInterview.Api.csproj", "SilentInterview.Api/"]
COPY ["SilentInterview.Application/SilentInterview.Application.csproj", "SilentInterview.Application/"]
COPY ["SilentInterview.Domain/SilentInterview.Domain.csproj", "SilentInterview.Domain/"]
COPY ["SilentInterview.Infrastructure/SilentInterview.Infrastructure.csproj", "SilentInterview.Infrastructure/"]

RUN dotnet restore "SilentInterview.Api/SilentInterview.Api.csproj"

COPY . .

WORKDIR "/src/SilentInterview.Api"

RUN dotnet publish "SilentInterview.Api.csproj" -c Release -o /app/publish

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:9.0

WORKDIR /app

# Install curl for the Docker healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/publish .

EXPOSE 8080


ENV ASPNETCORE_URLS=http://+:8080

ENTRYPOINT ["dotnet", "SilentInterview.Api.dll"]
