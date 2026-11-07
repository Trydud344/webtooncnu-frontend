FROM node:20.19.6-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_TURNSTILE_SITEKEY
ENV VITE_TURNSTILE_SITEKEY=$VITE_TURNSTILE_SITEKEY
RUN test -n "$VITE_TURNSTILE_SITEKEY" \
    && test "$VITE_TURNSTILE_SITEKEY" != "1x00000000000000000000AA"
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.30.6-alpine

USER root
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY security-headers.conf proxy-api.conf /etc/nginx/
COPY --from=build /app/dist /usr/share/nginx/html
RUN nginx -t \
    && rm -f /tmp/nginx.pid \
    && chown -R nginx:nginx /tmp
USER nginx

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD ["/usr/bin/curl", "-fsS", "http://127.0.0.1:8080/api/ready"]
