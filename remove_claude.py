import re

def callback(message, metadata):
    return re.sub(
        br'(?im)^Co-Authored-By:\s*Claude.*\r?\n?',
        b'',
        message
    ).rstrip(b"\r\n") + b"\n"