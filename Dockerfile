# build.mjs gera a parte estática em dist/ (páginas de conteudo/paginas/*.md,
# 404.html, sitemap de reserva e o cache-busting de CSS/JS: o HTML muda a cada
# deploy, mas /assets/ é cacheado como immutable por 30 dias no nginx, então o
# hash do conteúdo vira query string ?v=<hash> e a URL só muda quando o
# arquivo muda de verdade).
FROM node:22-alpine AS build
WORKDIR /site
COPY build.mjs blog-server.mjs index.html empresas.html ativar.html robots.txt ./
COPY lib ./lib
COPY assets ./assets
COPY conteudo ./conteudo
RUN node build.mjs

# Blog: renderiza /blog/*, a home e o sitemap a partir da API (ver
# blog-server.mjs). docker-compose.prod.yml sobe com target: blog.
FROM node:22-alpine AS blog
WORKDIR /site
COPY --from=build /site ./
USER node
EXPOSE 3002
CMD ["node", "blog-server.mjs"]

# Site (último stage, é o padrão do build): nginx com o estático.
FROM nginxinc/nginx-unprivileged:1.28-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /site/dist/ /usr/share/nginx/html/

EXPOSE 8080
