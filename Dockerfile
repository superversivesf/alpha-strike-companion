# Stage 1: build the site data (clone data archive, run pipeline)
FROM python:3.12-slim AS data

RUN apt-get update \
    && apt-get install -y --no-install-recommends git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

RUN git clone --depth 1 https://github.com/treverhw/Alpha-Strike-Tool.git

COPY tools/ tools/

RUN pip install --no-cache-dir pillow \
    && python3 -m unittest tools.test_build_data -v \
    && python3 tools/build_data.py

# Stage 2: serve the built site
FROM nginx:alpine

# Keep the cloned data archive in the image so the source data survives
# even if the upstream repo is taken down (rebuilds from scratch would
# otherwise be impossible). Disable with: --build-arg KEEP_ARCHIVE=0
ARG KEEP_ARCHIVE=1

COPY --from=data /build/Alpha-Strike-Tool /opt/alpha-strike-tool/

COPY site/ /usr/share/nginx/html/
COPY --from=data /build/site/data/ /usr/share/nginx/html/data/

RUN if [ "$KEEP_ARCHIVE" != "1" ]; then rm -rf /opt/alpha-strike-tool; fi
