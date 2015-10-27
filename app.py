#!/usr/bin/env python
# -*- coding: utf-8 -*-

from cli.logconfig import logging
import sys
import os
import mimetypes
import threading
import json
import gevent
import bottle
from bottle.ext.websocket import GeventWebSocketServer
from bottle.ext.websocket import websocket
from geventwebsocket import WebSocketError
from beaker.middleware import SessionMiddleware
from cli.config import Config, NoSectionError, NoOptionError
from cli.mail import Mailer
from DictObject import DictObject

from pytg import Telegram
from pytg.receiver import Receiver
from pytg.utils import coroutine
from pytg.exceptions import ConnectionError

# fix broken code "len(value) > 1" should be "len(value) > 0"
import pytg.result_parser
from pytg.exceptions import IllegalResponseException
def patched_something(value):
    if not (value and len(value) > 0):
        raise IllegalResponseException("Should return something.")
    return value
pytg.result_parser.something = patched_something
# end fix

def here(path):
    global __file__
    return os.path.abspath(os.path.join(os.path.dirname(__file__), path))
STATIC = here('static')
VIEWS  = here('views')
DOWNLOADS = here('.telegram-cli/downloads')

cfg = Config(here('configuration.ini'))
try:
    admin_username = cfg.get('webpage', 'username')
    admin_password = cfg.get('webpage', 'password')
    if not admin_username:
        raise NoOptionError('username', 'webpage')
    if not admin_password:
        raise NoOptionError('password', 'webpage')
    if admin_password == "admin":
        print "WARNING: please change the default web page credentials."
except Exception, e:
    print """
ERROR: %s
Check file "configuration.ini" and make sure the webpage
configuration is correct.
    """ % e
    sys.exit(1)

try:
    mailer = None
    email_to = cfg.get('email', 'to')
    if email_to:
        email_from = cfg.get('email', 'from')
        email_server = cfg.get('email', 'server')
        if not email_from:
            raise NoOptionError('from', 'email')
        if not email_server:
            raise NoOptionError('server', 'email')
        mailer = Mailer(email_from, email_server)
    else:
        print "WARNING: no email destination - smtp forwarding disabled."
except Exception, e:
    print """
ERROR: %s
Check file "configuration.ini" and make sure the email
configuration is correct.
    """ % e
    sys.exit(2)


mimetypes.init()
logger = logging.getLogger()


os.environ['TELEGRAM_HOME'] = here('')
tg = Telegram(
    telegram=here('tg/bin/telegram-cli'),
    pubkey_file=here('tg/tg-server.pub'),
    custom_cli_args=['-d', '-L', here('logs/telegram.log'),'-N'],
)

def download_media(sender, msg_id, media_type):
    if media_type not in [ 'audio', 'document', 'photo', 'video' ]:
        return {}
    logger.info('download_media(%s, %s)', msg_id, media_type)
    cmds = [ ('url', 'load_file' ) ]
    if media_type in ['document', 'file']:
        cmds.insert(0, ('thumb', 'load_file_thumb'))
    data = {}
    for field, command in cmds:
        response = None
        try:
            response = getattr(sender,command)(msg_id)
        except Exception, e:
            logger.exception('%s', e)
        if response and not response.get('error'):
            filepath = response.get('result')
            try:
                filepath = filepath[filepath.index('/downloads/'):]
            except ValueError:
                filepath = ''
            if filepath:
                data[field] = filepath
    return data

def telegram():
    @coroutine
    def message_listener(sender):
        try:
            while True:
                msg = (yield) # it waits until the generator has a has message here.
                msg.event = 'telegram.' + msg.get('event','message')
                if msg.event == 'telegram.message' and msg.get('media',''):
                    media = download_media(sender, msg.id, msg.media.type)
                    msg.media.update(media)
                logger.info(msg)
                for ws in web_clients.keys():
                    try:
                        ws.send(json.dumps(msg))
                    except WebSocketError:
                        if ws in web_clients:
                            del web_clients[ws]
        except Exception, e:
            logger.exception('message_listener: %s', e)

    while True:
        try:
            tg.receiver.start()
            tg.receiver.message(message_listener(tg.sender))
            logger.error("telegram: connection lost.")
            tg.receiver.stop()
        except Exception, e:
            logger.exception('telegram: %s', e)
        tg.receiver = Receiver()


session_opts = {
    'session.cookie_expires': True,
    'session.auto': True,
}
app = SessionMiddleware(bottle.app(), session_opts)
web_clients = {}


@bottle.route('/')
def index():
    session = bottle.request.environ.get('beaker.session')
    username = session.get('username', None)
    if username is None and bottle.request.remote_addr != '127.0.0.1':
        bottle.redirect('/login')
    return bottle.static_file('index.tpl', root=VIEWS)


@bottle.route('/login')
@bottle.post('/login')
@bottle.view('login')
def login():
    data = {
        'error': None
    }
    if bottle.request.method == 'POST':
        username = bottle.request.forms.get('username')
        password = bottle.request.forms.get('password')
        if username != '' and \
                username == admin_username and \
                password == admin_password:
            session = bottle.request.environ.get('beaker.session')
            session['username'] = username
            bottle.redirect('/')
        else:
            data['error'] = 'Wrong username or password.'
    return data


@bottle.route('/logout')
def logout():
    session = bottle.request.environ.get('beaker.session')
    session.delete()
    bottle.redirect('/')


@bottle.route('/static/<filename:path>')
def send_static(filename=''):
    if not filename:
        filename = 'index.html'
    return bottle.static_file(filename, root=STATIC)


@bottle.route('/downloads/<filename:path>')
def send_static(filename):
    session = bottle.request.environ.get('beaker.session', {})
    username = session.get('username', 'anonymous')
    if username == 'anonymous' and \
            bottle.request.remote_addr != '127.0.0.1':
        bottle.abort(401, 'Unauthorized.')
    if filename.endswith('.webp'):
        m = 'image/webp'
    else:
        m = mimetypes.guess_type(filename)[0]
    if not m:
        m = 'application/octet-stream'
    logger.info('%s: %s', filename, m)
    return bottle.static_file(filename, root=DOWNLOADS, mimetype=m)


@bottle.route('/websocket', apply=[websocket])
def handle_websocket(ws):
    if not ws:
        bottle.abort(400, 'Expected WebSocket request.')

    logger.debug(ws)

    session = bottle.request.environ.get('beaker.session', {})
    username = session.get('username', 'anonymous')

    response = {
        'event':  "session.state",
        'result': "FAIL",
        'status': "not authenticated",
    }
    if username != 'anonymous' or \
            bottle.request.remote_addr == '127.0.0.1':
        web_clients[ws] = username
        response = {
            'event':    "session.state",
            'result':   "SUCCESS",
            'status':   "connected",
            'username': username,
        }
    ws.send(json.dumps(response))

    if response["result"] == "FAIL":
        bottle.abort(401, 'Unauthorized.')

    while True:
        try:
            msg = ws.receive()
            if msg is None:
                continue

            logger.debug('%s@%s %s', username, bottle.request.remote_addr, msg)

            data = DictObject()
            try:
                data = DictObject(json.loads(msg))
            except Exception, e:
                logger.exception('message is not valid json data: %s', e)
                continue
            logger.debug('<%s', data)

            response = DictObject()

            channel, command = data.event.split('.',1)
            if channel == 'session':
                if command == 'state':
                    response.result   = "SUCCESS"
                    response.status   = "connected"
                    response.username = username
                else:
                    logger.error("unknown command '%s'", command)
            elif channel == 'telegram':
                cmd = getattr(tg.sender,command, None)
                if cmd:
                    try:
                        response = cmd(*data.get('args',[]))
                        logger.debug('>%s', response)
                        if type(response) != DictObject:
                            response = DictObject({ 'contents': response })

                        if command == 'dialog_list':
                            for c in response['contents']:
                                last_message = tg.sender.history('%s#%s' % (c.type, c.id), 1)
                                if len(last_message):
                                    c.last_timestamp = last_message[0].date
                        elif command == 'history':
                            for msg in response['contents']:
                                if msg.get('media',''):
                                    media = download_media(tg.sender, msg.id, msg.media.type)
                                    msg.media.update(media)
                    except Exception, e:
                        logger.exception('%s', e)
                else:
                    logger.error("unknown command '%s'", command)
            else:
                logger.error("unknown channel '%s'", channel)

            if response:
                response.event = data.event
                if data.get('args'):
                    response.args = data.args
                if data.get('extra'):
                    response.extra = data.extra
                ws.send(json.dumps(response))

        except WebSocketError:
            if ws in web_clients:
                del web_clients[ws]
            break


def webui():
    bottle.run(
        app=app,
        host='0.0.0.0',
        port=8080,
        server=GeventWebSocketServer,
    )

threading.Thread(name="webui",    target=webui,    args=()).start()
threading.Thread(name="telegram", target=telegram, args=()).start()
