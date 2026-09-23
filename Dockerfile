# O HTML muda a cada deploy, mas /assets/ é cacheado como immutable por 30
# dias (nginx.conf) — sem isso, quem já tinha o site aberto (ou a própria
# Cloudflare) continuava servindo o CSS/JS antigo depois de um deploy que
# mudou algum dos dois, mesmo com o HTML novo. O nome do arquivo não muda,
# então o hash do conteúdo vira query string (?v=<hash>) nas tags que
# referenciam o arquivo — a URL só muda quando o conteúdo muda de verdade.
FROM alpine:3.20 AS assets
WORKDIR /site
COPY index.html empresas.html ativar.html ./
COPY assets ./assets
COPY robots.txt sitemap.xml ./
RUN CSSVER=$(sha256sum assets/css/site.css | cut -c1-10) && \
    JSVER=$(sha256sum assets/js/site.js | cut -c1-10) && \
    sed -i "s/__CSSVER__/$CSSVER/g" *.html && \
    sed -i "s/__JSVER__/$JSVER/g" *.html

FROM nginxinc/nginx-unprivileged:1.28-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=assets /site/index.html /site/empresas.html /site/ativar.html /site/robots.txt /site/sitemap.xml /usr/share/nginx/html/
COPY --from=assets /site/assets /usr/share/nginx/html/assets

EXPOSE 8080
