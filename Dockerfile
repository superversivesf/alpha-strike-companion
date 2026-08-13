# Stage 1: build the site data (clone pinned data archive, run pipeline)
FROM python:3.12-slim@sha256:229a2c5bfa27522db7815ea81f9bed70af17ccb9de9fc7ad142b1877b5830d36 AS data

RUN apt-get update \
    && apt-get install -y --no-install-recommends git \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --uid 1000 builder

WORKDIR /build
RUN chown builder:builder /build

# Pin the upstream data archive to a known-good commit (bump deliberately:
#   git ls-remote https://github.com/treverhw/Alpha-Strike-Tool.git HEAD
# then update the SHA below). --depth 1 keeps the clone small.
USER builder
RUN git clone --depth 1 https://github.com/treverhw/Alpha-Strike-Tool.git \
    && git -C Alpha-Strike-Tool fetch --depth 1 origin 6c588fb261cf3bbddd515d09e3d58870d34c3fcf \
    && git -C Alpha-Strike-Tool checkout --detach FETCH_HEAD

COPY tools/ tools/

RUN pip install --no-cache-dir pillow==12.2.0 \
    && python3 -m unittest tools.test_build_data -v \
    && python3 tools/build_data.py

# Stage 2: serve the built site
FROM nginx:alpine@sha256:4a73073bd557c65b759505da037898b61f1be6cbcc3c2c3aeac22d2a470c1752

# The pinned data archive is kept in the image so the source data survives
# even if the upstream repo is taken down (rebuilds from scratch would
# otherwise be impossible).
COPY --from=data /build/Alpha-Strike-Tool /opt/alpha-strike-tool/

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY site/ /usr/share/nginx/html/
COPY --from=data /build/site/data/ /usr/share/nginx/html/data/
