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

# Where the app will be mounted, baked into the bundle. "/" is the origin root.
# An image built with a sub-path serves only from that path, so build one per
# path if a deployment needs more than one:
#
#   docker build --build-arg VITE_BASE_PATH=/experience/ .
#
# Leading and trailing slashes both matter.
ARG VITE_BASE_PATH=/
ENV VITE_BASE_PATH=$VITE_BASE_PATH

RUN npm run build

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
