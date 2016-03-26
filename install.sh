#!/bin/bash
set -e

me=$BASH_SOURCE
while [ -L "$me" ]; do me=$(file -- "$me"|cut -f2 -d\`|cut -f1 -d\'); done
#'
BASE="`cd -P -- "$(dirname -- "$me")" && pwd -P`"
cd "$BASE"

sudo apt-get install \
    build-essential make libreadline-dev libconfig-dev libssl-dev \
    lua5.2 liblua5.2-dev libevent-dev libjansson-dev python-dev \
    python-virtualenv libffi-dev
virtualenv env
. env/bin/activate
pip install -U pip
pip install Beaker bottle-beaker bottle-cork==0.11.1 bottle-websocket pyOpenSSL
pip install DictObject
pip install git+https://github.com/luckydonald/pytg.git@v0.4.5
cd tg
./configure && make && TELEGRAM_HOME="$BASE" bin/telegram-cli

cat<<MSG
############################
Setup completed. To run the app, use

   cd $BASE
   . env/bin/activate
   ./app.py

MSG
