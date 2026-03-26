FROM node:20-bookworm-slim

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

WORKDIR /workspace

# Install only workspace dependencies needed by @2wix/api and its local packages.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/domain-model/package.json packages/domain-model/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
RUN pnpm install --frozen-lockfile --filter @2wix/api...

# Copy sources after dependency layer for better build cache reuse.
COPY apps/api apps/api
COPY packages/domain-model packages/domain-model
COPY packages/shared-types packages/shared-types

WORKDIR /workspace/apps/api
ENV NODE_ENV=production

# Cloud Run sets PORT automatically.
CMD ["pnpm", "exec", "tsx", "src/server.ts"]
