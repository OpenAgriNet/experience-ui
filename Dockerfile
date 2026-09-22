# Stage 1: Build
FROM oven/bun:1-alpine AS build
WORKDIR /usr/local/app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY ./ ./
RUN bun run build

# Stage 2: Serve
FROM nginx:alpine
WORKDIR /usr/share/nginx/html
COPY --from=build /usr/local/app/dist .
# Add nginx config for SPA routing
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8081
CMD ["nginx", "-g", "daemon off;"]
