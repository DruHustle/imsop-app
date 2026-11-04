FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
ENV ASPNETCORE_HTTP_PORTS=10000
EXPOSE 10000

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ["src/SmartLogistics.SupplyChainService/SmartLogistics.SupplyChainService.csproj", "src/SmartLogistics.SupplyChainService/"]
COPY ["src/SmartLogistics.Common/SmartLogistics.Common.csproj", "src/SmartLogistics.Common/"]
RUN dotnet restore "src/SmartLogistics.SupplyChainService/SmartLogistics.SupplyChainService.csproj"
COPY . .
WORKDIR "/src/src/SmartLogistics.SupplyChainService"
RUN dotnet build "SmartLogistics.SupplyChainService.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "SmartLogistics.SupplyChainService.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM base AS final
ARG APP_REVISION=unknown
LABEL org.opencontainers.image.revision=$APP_REVISION org.opencontainers.image.title="Smart Logistics backend"
ENV APP_REVISION=$APP_REVISION

WORKDIR /app
COPY --from=publish /app/publish .
USER app
ENTRYPOINT ["dotnet", "SmartLogistics.SupplyChainService.dll"]
