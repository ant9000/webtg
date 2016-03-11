#!/bin/bash

me=$BASH_SOURCE
while [ -L "$me" ]; do me=$(file -- "$me"|cut -f2 -d\`|cut -f1 -d\'); done
#'
BASE="`cd -P -- "$(dirname -- "$me")" && pwd -P`"
cd "$BASE/tg"

TELEGRAM_HOME="$BASE" bin/telegram-cli $*
