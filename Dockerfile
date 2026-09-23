FROM nginxinc/nginx-unprivileged:1.28-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html empresas.html ativar.html /usr/share/nginx/html/
COPY assets /usr/share/nginx/html/assets

EXPOSE 8080
