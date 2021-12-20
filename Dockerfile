FROM jekyll/builder:latest 

ENV SITE_SRC '/srv/jekyll'
ENV SITE_HTML '/srv/jekyll/_site'

COPY site ${SITE_SRC}

#RUN cd ${SITE_SRC} && \
#    bundle install && \
#    jekyll build
CMD sleep infinity