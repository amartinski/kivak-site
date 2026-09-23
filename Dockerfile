# build.mjs gera o site final em dist/: blog e páginas de conteudo/*.md,
# sitemap.xml, 404.html e o cache-busting de CSS/JS — o HTML muda a cada
# deploy, mas /assets/ é cacheado como immutable por 30 dias (nginx.conf),
# então o hash do conteúdo vira query string (?v=<hash>) nas tags que
# referenciam o arquivo e a URL só muda quando o conteúdo muda de verdade.
FROM node:22-alpine AS build
WORKDIR /site
COPY build.mjs index.html empresas.html ativar.html robots.txt ./
COPY assets ./assets
COPY conteudo ./conteudo
RUN node build.mjs

FROM nginxinc/nginx-unprivileged:1.28-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /site/dist/ /usr/share/nginx/html/

EXPOSE 8080
