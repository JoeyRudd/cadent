# Build the Next.js app, then run its standalone output on slim Node with uv for the Garmin sync.

FROM node:24-slim AS builder
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
# sync/ may not exist on every branch; make sure the runtime COPY below always has something to copy.
RUN pnpm build && mkdir -p sync

FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    UV_PYTHON_INSTALL_DIR=/opt/uv-python \
    UV_LINK_MODE=copy
COPY --from=ghcr.io/astral-sh/uv:0.13.0 /uv /uvx /usr/local/bin/
RUN uv python install 3.12 && mkdir -p /app/data && chown node:node /app /app/data

COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/sync ./sync

USER node
# Pre-install the sync script's dependencies so the daily run doesn't download them.
RUN if [ -f sync/pyproject.toml ]; then uv sync --project sync --python 3.12; fi

EXPOSE 3000
CMD ["node", "server.js"]
