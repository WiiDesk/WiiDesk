#!/usr/bin/env python3
"""WiiDesk polkit authentication agent.

Registers as the polkit agent of the current login session but shows nothing itself.
Every request is passed to WiiDesk as one JSON object per line on stdout, WiiDesk shows
a Wii-style password dialog and answers with JSON lines on stdin.

Agent -> WiiDesk:
  {"type": "begin",  "id": 1, "message": "...", "action_id": "...", "user": "root"}
  {"type": "prompt", "id": 1, "text": "Password:", "echo": false}
  {"type": "info" | "error", "id": 1, "text": "..."}
  {"type": "done",   "id": 1, "ok": true}
  {"type": "fatal",  "text": "..."}            (registration failed, agent exits)

WiiDesk -> agent:
  {"type": "response", "id": 1, "text": "the password"}
  {"type": "cancel",   "id": 1}

The actual password check is done by libpolkit-agent and its helper program, so this works
with whatever PAM setup the system has.
"""

import json
import os
import pwd
import sys

import gi

gi.require_version('Polkit', '1.0')
gi.require_version('PolkitAgent', '1.0')
from gi.repository import GLib, Gio, Polkit, PolkitAgent  # noqa: E402

OBJECT_PATH = '/org/wiidesk/PolicyKit1/AuthenticationAgent'
RETRY_TEXT = "Sorry, that didn't work. Please try again."


def send(message):
    sys.stdout.write(json.dumps(message) + '\n')
    sys.stdout.flush()


def pick_identity(identities):
    """Authenticate as the current user if allowed, otherwise as the first user offered."""
    users = [i for i in identities if isinstance(i, Polkit.UnixUser)]
    for identity in users:
        if identity.get_uid() == os.getuid():
            return identity
    return users[0] if users else None


class Request:
    def __init__(self, rid, cookie, identity, task):
        self.id = rid
        self.cookie = cookie
        self.identity = identity
        self.task = task
        self.session = None
        self.finished = False


class WiiListener(PolkitAgent.Listener):
    def __init__(self):
        super().__init__()
        self.requests = {}
        self.next_id = 1

    # Called by libpolkit-agent when polkitd needs an authentication
    def do_initiate_authentication(self, action_id, message, icon_name, details, cookie,
                                   identities, cancellable, callback, user_data=None):
        task = Gio.Task.new(self, cancellable, callback, user_data)
        identity = pick_identity(identities)
        if identity is None:
            task.return_error(self.error(Polkit.Error.FAILED, 'no usable identity'))
            return

        req = Request(self.next_id, cookie, identity, task)
        self.next_id += 1
        self.requests[req.id] = req

        user = pwd.getpwuid(identity.get_uid()).pw_name
        send({'type': 'begin', 'id': req.id, 'message': message,
              'action_id': action_id, 'user': user})

        if cancellable is not None:
            cancellable.connect(lambda *_: self.cancel(req.id, notify=True))

        self.start_session(req)

    def do_initiate_authentication_finish(self, result):
        return result.propagate_boolean()

    @staticmethod
    def error(code, text):
        return GLib.Error.new_literal(GLib.quark_from_string('polkit-error-quark'), text, int(code))

    def start_session(self, req):
        session = PolkitAgent.Session.new(req.identity, req.cookie)
        req.session = session
        session.connect('request', self.on_request, req)
        session.connect('show-info', lambda s, text: send({'type': 'info', 'id': req.id, 'text': text}))
        session.connect('show-error', lambda s, text: send({'type': 'error', 'id': req.id, 'text': text}))
        session.connect('completed', self.on_completed, req)
        session.initiate()

    def on_request(self, session, prompt, echo_on, req):
        if session is req.session and not req.finished:
            send({'type': 'prompt', 'id': req.id, 'text': prompt, 'echo': bool(echo_on)})

    def on_completed(self, session, gained_authorization, req):
        if session is not req.session or req.finished:
            return
        if gained_authorization:
            self.finish(req, True)
        else:
            # Wrong password: tell the user and ask again with a fresh session
            send({'type': 'error', 'id': req.id, 'text': RETRY_TEXT})
            self.start_session(req)

    def respond(self, rid, text):
        req = self.requests.get(rid)
        if req and req.session and not req.finished:
            req.session.response(text)

    def cancel(self, rid, notify=False):
        req = self.requests.get(rid)
        if not req or req.finished:
            return
        # Cancelling makes the session emit "completed" itself, which must not start a retry
        req.finished = True
        if req.session:
            req.session.cancel()
        self.finish(req, False, cancelled=True, notify=notify)

    def finish(self, req, ok, cancelled=False, notify=False):
        req.finished = True
        self.requests.pop(req.id, None)
        send({'type': 'cancel' if notify else 'done', 'id': req.id, 'ok': ok})
        if cancelled:
            req.task.return_error(self.error(Polkit.Error.CANCELLED, 'cancelled'))
        else:
            req.task.return_boolean(True)


def main():
    listener = WiiListener()

    # Register for the login session; fall back to the session id from the environment
    try:
        subject = Polkit.UnixSession.new_for_process_sync(os.getpid(), None)
    except GLib.Error:
        session_id = os.environ.get('XDG_SESSION_ID')
        if not session_id:
            send({'type': 'fatal', 'text': 'not running inside a login session'})
            return 1
        subject = Polkit.UnixSession.new(session_id)

    try:
        handle = listener.register(PolkitAgent.RegisterFlags.NONE, subject, OBJECT_PATH, None)
    except GLib.Error as err:
        send({'type': 'fatal', 'text': 'could not register: ' + err.message})
        return 1

    loop = GLib.MainLoop()
    buffer = b''

    # Commands from WiiDesk arrive on stdin; end of input means WiiDesk is gone
    def on_stdin(fd, condition):
        nonlocal buffer
        if condition & GLib.IO_IN:
            data = os.read(fd, 4096)
            if not data:
                loop.quit()
                return False
            buffer += data
            while b'\n' in buffer:
                line, buffer = buffer.split(b'\n', 1)
                try:
                    command = json.loads(line)
                except ValueError:
                    continue
                if command.get('type') == 'response':
                    listener.respond(command.get('id'), str(command.get('text', '')))
                elif command.get('type') == 'cancel':
                    listener.cancel(command.get('id'))
            return True
        loop.quit()
        return False

    GLib.io_add_watch(sys.stdin.fileno(), GLib.PRIORITY_DEFAULT,
                      GLib.IO_IN | GLib.IO_HUP | GLib.IO_ERR, on_stdin)
    send({'type': 'ready'})
    loop.run()
    del handle
    return 0


if __name__ == '__main__':
    sys.exit(main())
