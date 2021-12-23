FROM jekyll/builder:latest 

ENV SITE_SRC '/srv/jekyll'
ENV SITE_HTML '/srv/jekyll/source/_site'

COPY source ${SITE_SRC}

RUN cd ${SITE_SRC} && \
    bundle install && \
    jekyll build
