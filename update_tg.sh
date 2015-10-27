#!/bin/bash
set -e

me=$BASH_SOURCE
while [ -L "$me" ]; do me=$(file -- "$me"|cut -f2 -d\`|cut -f1 -d\'); done
#'
BASE="`cd -P -- "$(dirname -- "$me")" && pwd -P`"
cd "$BASE/tg"
last_commit=`git rev-parse HEAD`
git pull
if [ "$last_commit" != "`git rev-parse HEAD`" ]; then
  make clean
  ./configure && make
else
  echo "No need to recompile."
fi
