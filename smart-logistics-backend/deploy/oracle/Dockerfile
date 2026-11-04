FROM mcr.microsoft.com/dotnet/sdk:8.0 AS dotnet-build
WORKDIR /src
COPY src/SmartLogistics.sln ./src/SmartLogistics.sln
COPY src/SmartLogistics.Common/SmartLogistics.Common.csproj ./src/SmartLogistics.Common/
COPY src/SmartLogistics.Gateway/SmartLogistics.Gateway.csproj ./src/SmartLogistics.Gateway/
COPY src/SmartLogistics.OperationsService/SmartLogistics.OperationsService.csproj ./src/SmartLogistics.OperationsService/
COPY src/SmartLogistics.SupplyChainService/SmartLogistics.SupplyChainService.csproj ./src/SmartLogistics.SupplyChainService/
COPY src/SmartLogistics.SupplyChainService.Tests/SmartLogistics.SupplyChainService.Tests.csproj ./src/SmartLogistics.SupplyChainService.Tests/
RUN dotnet restore src/SmartLogistics.sln
COPY src ./src
RUN dotnet publish src/SmartLogistics.Gateway/SmartLogistics.Gateway.csproj --no-restore -c Release -o /publish/gateway /p:UseAppHost=false \
    && dotnet publish src/SmartLogistics.OperationsService/SmartLogistics.OperationsService.csproj --no-restore -c Release -o /publish/operations /p:UseAppHost=false \
    && dotnet publish src/SmartLogistics.SupplyChainService/SmartLogistics.SupplyChainService.csproj --no-restore -c Release -o /publish/supply-chain /p:UseAppHost=false

FROM node:22-bookworm-slim AS node-build
WORKDIR /src/server
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
COPY server/package.json server/pnpm-lock.yaml server/.npmrc server/tsconfig.json server/drizzle.config.ts ./
RUN pnpm install --frozen-lockfile
COPY server/src ./src
COPY server/migrations ./migrations
RUN pnpm build && pnpm prune --prod

FROM mcr.microsoft.com/dotnet/aspnet:8.0-noble@sha256:d0a0fa004862a9cca83208800f706dcc2523c4db29f09d501395f80969e03070 AS runtime

USER root
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl supervisor \
    && rm -rf /var/lib/apt/lists/*

# Copy the Node 22 runtime from the official image. The application dependencies
# are JavaScript-only; the copied binary and runtime must be tested together.
COPY --from=node-build /usr/local/bin/node /usr/local/bin/node

WORKDIR /app
COPY --from=dotnet-build --chown=app:app /publish/gateway ./gateway
COPY --from=dotnet-build --chown=app:app /publish/operations ./operations
COPY --from=dotnet-build --chown=app:app /publish/supply-chain ./supply-chain
COPY --from=node-build --chown=app:app /src/server/package.json ./node-api/package.json
COPY --from=node-build --chown=app:app /src/server/node_modules ./node-api/node_modules
COPY --from=node-build --chown=app:app /src/server/dist ./node-api/dist
COPY --from=node-build --chown=app:app /src/server/migrations ./node-api/migrations
COPY --chown=app:app deploy/oracle/supervisord.conf /app/supervisord.conf
COPY --chown=app:app deploy/oracle/entrypoint.sh /app/entrypoint
RUN chmod 0555 /app/entrypoint

ARG APP_REVISION=unknown
LABEL org.opencontainers.image.revision=$APP_REVISION org.opencontainers.image.title="Smart Logistics backend"
ENV APP_REVISION=$APP_REVISION

ENV NODE_ENV=production \
    ASPNETCORE_ENVIRONMENT=Production \
    DOTNET_ENVIRONMENT=Production \
    PORT=10000 \
    NODE_API_URL=http://127.0.0.1:10001 \
    OPERATIONS_SERVICE_URL=http://127.0.0.1:10002 \
    SUPPLY_CHAIN_SERVICE_URL=http://127.0.0.1:10003

EXPOSE 10000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl --fail --silent http://127.0.0.1:${PORT}/ready >/dev/null || exit 1

USER app
ENTRYPOINT ["/app/entrypoint"]
