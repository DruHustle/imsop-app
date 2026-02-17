FROM node:22-alpine AS build

WORKDIR /app

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

COPY package.json pnpm-lock.yaml tsconfig.json tsconfig.node.json vite.config.mts components.json ./
COPY client ./client
COPY shared ./shared
COPY patches ./patches

RUN pnpm install --frozen-lockfile

ARG VITE_BASE_PATH=/
ARG VITE_API_URL=http://localhost:3001
ARG VITE_GOOGLE_MAPS_API_KEY=

ENV VITE_BASE_PATH=$VITE_BASE_PATH
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_GOOGLE_MAPS_API_KEY=$VITE_GOOGLE_MAPS_API_KEY

RUN pnpm build

FROM nginx:1.27-alpine AS runtime

COPY client/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
