import http.server,pathlib,json,urllib.parse,time,threading
ROOT=pathlib.Path(__file__).resolve().parent
lock=threading.Lock();log=ROOT/'loopback.jsonl'
class Handler(http.server.BaseHTTPRequestHandler):
 def log_message(self,*a):pass
 def do_GET(self):
  u=urllib.parse.urlsplit(self.path);bits=u.path.split('/');variant=bits[1] if len(bits)>1 else '';rel='/'.join(bits[2:]);status=200;body=b'';mime='application/octet-stream'
  if variant not in ['base','748','757','759'] or '..' in rel.split('/'):
   status=404
  else:
   special={'remake/qa-vn.html':ROOT/'vn-ui-qa/qa-vn.html','remake/qa-vn.mjs':ROOT/'vn-ui-qa/qa-vn.mjs','remake/app.mjs':ROOT/'vn-ui-qa/qa-vn.mjs','remake/qa-holes.html':ROOT/'holes-qa/index.html','remake/qa-holes.mjs':ROOT/'holes-qa/app.mjs','remake/holes-app.mjs':ROOT/'holes-qa/app.mjs'}
   p=special.get(rel)
   if p is None:
    over=ROOT/'overlays'/variant/rel
    p=over if over.is_file() else ROOT/'site'/rel
   if not p.is_file():status=404
   else:
    body=p.read_bytes();mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.woff2':'font/woff2','.ttf':'font/ttf'}.get(p.suffix,mime)
  self.send_response(status);self.send_header('Content-Type',mime);self.send_header('Content-Length',str(len(body)));self.send_header('Cache-Control','no-store');self.send_header('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; media-src 'self'; object-src 'none'");self.end_headers()
  try:self.wfile.write(body)
  except (BrokenPipeError,ConnectionResetError):pass
  with lock:
   with log.open('a') as f:f.write(json.dumps({'at':time.time(),'path':u.path,'status':status,'response_body':len(body),'request_header_bytes':len(str(self.headers).encode()),'scope':'loopback only, no external transfer'})+'\n')
class Server(http.server.ThreadingHTTPServer):
 request_queue_size=128
 daemon_threads=True
server=Server(('127.0.0.1',0),Handler)
(ROOT/'server.json').write_text(json.dumps({'port':server.server_port,'origin':f'http://127.0.0.1:{server.server_port}','pid':__import__('os').getpid()}));print('local QA server',server.server_port,flush=True);server.serve_forever()
