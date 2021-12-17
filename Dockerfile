FROM jekyll/builder:latest 

ENV SITE_SRC '/srv/jekyll'
ENV SITE_HTML '/srv/jekyll/_site'

COPY _config.yml ${SITE_SRC}
COPY docs ${SITE_SRC}
COPY reports ${SITE_SRC}
COPY 404.html ${SITE_SRC}
COPY Gemfile ${SITE_SRC}
COPY Gemfile.lock ${SITE_SRC}
COPY index.markdown ${SITE_SRC}

RUN cd ${SITE_SRC} && \
    bundle install && \
    jekyll build 
