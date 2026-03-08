#!/bin/bash
set -euo pipefail

function deploy {
  if [ -d "./out" ]; then
    rm -rf ./out/
  fi
  mkdir -p ./out

  for filename in ./src/*/*/build*.js; do
    echo "$filename"
    node "$filename"
  done

  echo "Transpilation complete, generating ZIP files..."
  shopt -s extglob

  for outputFile in ./out/*/index.js; do
    dir="$(dirname "$outputFile")"
    parentDir=${dir%%+(/)}
    parentDir=${parentDir##*/}
    parentDir=${parentDir:-/}
    echo "$parentDir"
    cd "$dir/"
    zip "$parentDir.zip" index.js
    echo ""
    cd ../../
  done
}

if [ "${CI:-}" = "true" ]; then
  npm ci
else
  npm install
fi

deploy
