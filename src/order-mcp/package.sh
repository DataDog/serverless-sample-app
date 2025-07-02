#!/bin/bash
function deploy {
  rm -r ./out/
  TIMESTAMP=$(date +%Y%m%d%H%M%S)

  for filename in ./src/*/adapters/build*.js; do
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
    cp ../../run.sh .
    zip $parentDir.zip index.js run.sh
    echo ""
    cd ../../
  done
}
npm i 
deploy