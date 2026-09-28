#!/usr/bin/env bash
# Compile bbpPairings (Apache 2.0) dans services/chess-engine/bin pour le développement local.
set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="${BBP_VERSION:-v6.0.0}"
TMP="$(mktemp -d)"
git clone -q --depth 1 --branch "$VERSION" https://github.com/BieremaBoyzProgramming/bbpPairings.git "$TMP/bbp"
make -C "$TMP/bbp" -j"$(nproc 2>/dev/null || echo 2)" >/dev/null
mkdir -p "$DIR/bin"
cp "$TMP/bbp/bbpPairings.exe" "$DIR/bin/bbpPairings"
cp "$TMP/bbp/LICENSE.txt" "$DIR/bin/bbpPairings-LICENSE.txt"
rm -rf "$TMP"
echo "✓ bbpPairings $VERSION → $DIR/bin/bbpPairings"
