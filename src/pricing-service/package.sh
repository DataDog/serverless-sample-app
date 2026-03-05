#!/bin/bash
function deploy {
  rm -r ./out/
  TIMESTAMP=$(date +%Y%m%d%H%M%S)

  if [ "${WORKSHOP_BUILD}" = "true" ]; then
    echo "Building workshop (broken) version..."
    BUILD_GLOB="./src/*/workshop/build*.js"
  else
    BUILD_GLOB="./src/*/adapters/build*.js"
  fi

  for filename in $BUILD_GLOB; do
    echo $filename
    node $filename
  done

  echo "Transpilation complete, generating ZIP files..."
  shopt -s extglob

  for outputFile in ./out/*/index.js; do
    dir="$(dirname $outputFile)"
    parentDir=${dir%%+(/)}    # trim however many trailing slashes exist
    parentDir=${parentDir##*/}       # remove everything before the last / that still remains
    parentDir=${parentDir:-/}        # correct for dirname=/ case
    echo $parentDir
    cd $dir/
    zip $parentDir.zip index.js
    echo ""
    cd ../../
  done
}
npm ci
deploy


