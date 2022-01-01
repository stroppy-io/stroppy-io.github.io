FROM jekyll/builder:latest 

ENV SITE_SRC '/home/jekyll'
ENV SITE_HTML '/home/jekyll/html'

COPY source ${SITE_SRC}

RUN apk add imagemagick

RUN mkdir -p ${SITE_SRC} && \
    cd ${SITE_SRC} && \
    bundle install && \
    jekyll build -d ${SITE_HTML} && \
#workaround
    sed -i "s/\/assets\/js\/search-data.json/\/ru\/assets\/js\/search-data.json/g" /home/jekyll/html/ru/assets/js/just-the-docs.js