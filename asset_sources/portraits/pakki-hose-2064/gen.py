import os,json,base64,io,sys,urllib.request,uuid
key=os.environ['OPENAI_API_KEY'];S='/workspace/wt-2064/assets/sprites/characters/pakki'
HOSE=("a real shisha (hookah) hose: a slim elegant mouthpiece handle — a long tapered polished brass/gold metal handle with a dark wood grip section and a small narrow metal mouth tip at the top (NOT a microphone, NOT a ribbed coupling, no black rubber cap) — "
 "connected at its bottom end through a small metal hose connector to a flexible smooth matte navy-blue silicone hose (smooth soft tube, no ribs, no coils, no cable look) that curves down behind/beside his leg like a real hookah hose")
def mp(fields,files):
  b=uuid.uuid4().hex;o=io.BytesIO()
  for k,v in fields.items(): o.write(f'--{b}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode())
  for p in files: o.write(f'--{b}\r\nContent-Disposition: form-data; name="image[]"; filename="{os.path.basename(p)}"\r\nContent-Type: image/png\r\n\r\n'.encode()+open(p,'rb').read()+b'\r\n')
  o.write(f'--{b}--\r\n'.encode());return o.getvalue(),f'multipart/form-data; boundary={b}'
def one(e,tag=''):
  dst=f'raw_{e}{tag}.png'
  refs=[f'{S}/chr_pakki_{e}.png']+([] if e=='normal' else ['placed_normal.png'])
  extra='' if e=='normal' else ' The second image shows the approved new hose design: copy that exact mouthpiece handle and hose design, colors and proportions.'
  p=(f"Edit the first image. It is the same character; keep EVERYTHING identical: face, expression, body, pose, hand positions, bow tie, colors, framing, size, line style, and the same detailed anime game sprite style. "
     f"Change ONLY the object he holds: replace the gold ribbed microphone-like handle and the ribbed coiled navy cable with {HOSE}. He holds the handle in the same hand at the same position and angle, mouth tip pointing up near his face as before.{extra} Transparent background, no text, no border.")
  body,ct=mp({'model':'gpt-image-2.5-sunburst','prompt':p,'size':'1024x1536','quality':'high','background':'transparent','n':'1'},refs)
  rq=urllib.request.Request('https://api.openai.com/v1/images/edits',data=body,headers={'Authorization':'Bearer '+key,'Content-Type':ct})
  try: r=json.load(urllib.request.urlopen(rq,timeout=600))
  except urllib.error.HTTPError as x: return f'ERR {e} {x.code} {x.read()[:300]}'
  open(dst,'wb').write(base64.b64decode(r['data'][0]['b64_json']));return dst
import concurrent.futures as cf
with cf.ThreadPoolExecutor(6) as ex:
  for f in ex.map(lambda a:one(*a.split(':')),sys.argv[1:]): print(f,flush=True)
