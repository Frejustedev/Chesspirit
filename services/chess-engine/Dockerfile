# Service échecs Chesspirit — image de production (Render, Railway ou Fly.io).
FROM python:3.12-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends g++ make git ca-certificates && rm -rf /var/lib/apt/lists/*
# bbpPairings : moteur d'appariement suisse homologué par la FIDE (licence Apache 2.0).
ARG BBP_VERSION=v6.0.0
RUN git clone --depth 1 --branch ${BBP_VERSION} https://github.com/BieremaBoyzProgramming/bbpPairings.git /src/bbp \
  && make -C /src/bbp -j"$(nproc)" && cp /src/bbp/bbpPairings.exe /usr/local/bin/bbpPairings

FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 BBP_PAIRINGS_BIN=/usr/local/bin/bbpPairings
COPY --from=build /usr/local/bin/bbpPairings /usr/local/bin/bbpPairings
WORKDIR /app
# Dépendances exactement celles de uv.lock (même liste qu'en développement et en test).
COPY pyproject.toml uv.lock ./
RUN pip install --no-cache-dir uv \
  && uv export --frozen --no-dev --no-emit-project --no-hashes -o requirements.txt \
  && pip install --no-cache-dir -r requirements.txt \
  && pip uninstall -y uv && rm requirements.txt
COPY app ./app
RUN useradd --create-home engine
USER engine
EXPOSE 8000
HEALTHCHECK CMD python -c "import urllib.request;urllib.request.urlopen('http://127.0.0.1:8000/health')"
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
