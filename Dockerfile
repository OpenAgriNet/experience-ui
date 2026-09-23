# syntax=docker/dockerfile:1

# ---- Build ------------------------------------------------------------------
# The TanStack Router plugin would regenerate src/routeTree.gen.ts during the
# build, and this image has no Node for it to run under. That file is committed,
# so the build uses the checked-in copy. Keep it committed.
FROM oven/bun:1-alpine AS build

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

# ---- Serve ------------------------------------------------------------------
FROM nginx:alpine AS serve

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# The configuration a deployment overrides lives in its own directory, mounted
# over by infrastructure. Moved out of the static root so there is exactly one
# copy and no stale second one to shadow it.
RUN mkdir -p /etc/experience-ui \
 && mv /usr/share/nginx/html/config.json /etc/experience-ui/config.json

# Behind another proxy, so an unprivileged port rather than 80.
EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
