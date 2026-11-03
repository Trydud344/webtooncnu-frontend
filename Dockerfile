FROM node:20.19.6-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_BASE=/
ENV VITE_BASE=${VITE_BASE}
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.30.6-alpine

USER root
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY security-headers.conf proxy-api.conf /etc/nginx/
COPY --from=build /app/dist /usr/share/nginx/html
RUN nginx -t
USER nginx

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD ["/usr/bin/curl", "-fsS", "http://127.0.0.1:8080/"]
