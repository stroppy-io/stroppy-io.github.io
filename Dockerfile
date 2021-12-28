FROM jekyll/builder:latest 

ENV SITE_SRC '/home/jekyll'
ENV SITE_HTML '/home/jekyll/html'

COPY source ${SITE_SRC}

RUN mkdir -p ${SITE_SRC} && \
    cd ${SITE_SRC} && \
    bundle install && \
    jekyll build -d ${SITE_HTML}