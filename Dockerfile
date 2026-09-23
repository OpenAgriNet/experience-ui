# syntax=docker/dockerfile:1

# ---- Build ------------------------------------------------------------------
# Node rather than Bun. The TanStack Router plugin loads src/routes.ts through
# tsx, which is a Node loader, so a Bun builder needed a Node installed beside
# it to work at all — and failed unpredictably when it did not.
FROM node:24-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- Serve ------------------------------------------------------------------
FROM nginx:alpine AS serve

COPY --from=build /app/dist /usr/share/nginx/html
# A template, not a config: the base image's entrypoint runs envsubst over
# /etc/nginx/templates and writes the result into conf.d before nginx starts.
# That is what substitutes BASE_PATH without needing a rebuild per deployment.
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

# Serve from the origin root unless a deployment says otherwise.
ENV BASE_PATH=""

# The configuration a deployment overrides lives in its own directory, mounted
# over by infrastructure. Moved out of the static root so there is exactly one
# copy and no stale second one to shadow it.
RUN mkdir -p /etc/experience-ui \
 && mv /usr/share/nginx/html/config.json /etc/experience-ui/config.json

# Behind another proxy, so an unprivileged port rather than 80.
EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
