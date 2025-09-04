#!/usr/bin/env bash
set -euo pipefail

mkdir -p assets

# OpenLayers v9.1.0 (JS + CSS)
curl -L -o assets/ol.js  https://cdn.jsdelivr.net/npm/ol@v9.1.0/dist/ol.js
curl -L -o assets/ol.css https://cdn.jsdelivr.net/npm/ol@v9.1.0/ol.css

echo "Fetched OpenLayers into /assets"