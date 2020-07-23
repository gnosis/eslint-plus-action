#!/bin/bash

echo "ENTRY"

# Removes confusing pushd / popd logging to output
pushd () {
    local CPWD;
    CPWD="$(pwd)"
    command pushd "$@" > /dev/null
    echo "[pushd] [${CPWD}] -> [$(pwd)]"
}

popd () {
    local CPWD
    CPWD="$(pwd)"
    command popd "$@" > /dev/null
    echo "[popd] [${CPWD}] -> [$(pwd)]"
}

set -e

if [ ! -d "./node_modules" ] || [ "$2" = 'true' ] ; then
    if [ -f yarn.lock ]; then 
        echo "Yarn Action Install"
        mkdir .yarncache
        NODE_ENV=production yarn install --frozen-lockfile --cache-folder ./.yarncache
    fi
fi

pushd /action

# if [ -f yarn.lock ]; then 
#   echo "Yarn Action Install"
#   yarn cache clean
#   mkdir .yarncache
#   NODE_ENV=production yarn install --frozen-lockfile --cache-folder ./.yarncache
#   rm -rf .yarncache
# fi

[ -f package-lock.json ] && NODE_ENV=production npm install 
popd


echo "Execute From Directory: $(pwd)"

NODE_PATH=node_modules GITHUB_TOKEN="${GITHUB_TOKEN:-${1:-.}}" SOURCE_ROOT=${2:-.} node /action/lib/run.js

rm -rf node_modules # cleanup to prevent some weird permission errors later on 
rm -rf yarn.lock
rm -rf .yarncache
yarn cache clean