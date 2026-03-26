FROM node:20-bookworm-slim

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

WORKDIR /workspace

# Install only workspace dependencies needed by @2wix/api and its local packages.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/commercial-engine/package.json packages/commercial-engine/package.json
COPY packages/domain-model/package.json packages/domain-model/package.json
COPY packages/export-engine/package.json packages/export-engine/package.json
COPY packages/panel-engine/package.json packages/panel-engine/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY packages/spec-engine/package.json packages/spec-engine/package.json
RUN pnpm install --frozen-lockfile --filter @2wix/api...

# Copy sources after dependency layer for better build cache reuse.
COPY apps/api apps/api
COPY packages/commercial-engine packages/commercial-engine
COPY packages/domain-model packages/domain-model
COPY packages/export-engine packages/export-engine
COPY packages/panel-engine packages/panel-engine
COPY packages/shared-types packages/shared-types
COPY packages/spec-engine packages/spec-engine

WORKDIR /workspace/apps/api
ENV NODE_ENV=production

# Cloud Run sets PORT automatically.
CMD ["pnpm", "exec", "tsx", "src/server.ts"]
