# 表情差分の作り直し・追加（#2058）。参照は各キャラの採用済み chr_<id>_normal.png のみ
import os,json,base64,io,sys,urllib.request,uuid,concurrent.futures as cf
R=os.environ.get('SPRITES','assets/sprites/characters'); OUT=os.environ.get('OUT','/workspace/gen2058')
key=os.environ['OPENAI_API_KEY']
EXP={'smile':'a gentle natural smile, relaxed shoulders','serious':'a serious, focused expression, slightly furrowed brows, mouth closed','surprise':'a surprised expression, eyes wide, mouth slightly open, small recoil of the shoulders','smug':'a confident smug half-smile, one eyebrow slightly raised, chin a little up','sad':'a quietly sad expression, downcast eyes, slight frown, shoulders lowered, eyes open (not sleepy, no yawn, no Zz)','excited':'an excited, bright open-mouthed grin, energetic, one hand slightly raised'}
EXTRA={'maezono':'Keep the same youthful round face shape and the same age as the reference; do not make the face thinner, bonier or older.',
 'uranaishi':'Keep the face fully visible and well lit (no shadow over the face), keep the headband and the tarot cards exactly as in the reference.',
 'rin':'Keep the mouth closed, no raised finger.' }
JOBS=[a.split(':') for a in sys.argv[1:]]
def mp(fields,files):
  b=uuid.uuid4().hex;out=io.BytesIO()
  for k,v in fields.items(): out.write(f'--{b}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode())
  for p in files: out.write(f'--{b}\r\nContent-Disposition: form-data; name="image[]"; filename="{os.path.basename(p)}"\r\nContent-Type: image/png\r\n\r\n'.encode()+open(p,'rb').read()+b'\r\n')
  out.write(f'--{b}--\r\n'.encode());return out.getvalue(),f'multipart/form-data; boundary={b}'
def one(c,e,tag=''):
  dst=f'{OUT}/raw_{c}_{e}{tag}.png'
  if os.path.exists(dst): return dst
  ref=f'{R}/{c}/chr_{c}_normal.png'
  prompt=(f"Expression variant of the SAME character in the attached image. Keep identical face, hairstyle, colors, outfit, accessories, body proportions, full-body framing and the same high-resolution fine pixel-art-like detailed anime game sprite style. Change only the facial expression to {EXP[e]}, with a small matching change in head/arm pose. {EXTRA.get(c,'') if (c,e)!=('rin','smug') else ''} Full body, transparent background, no text, no border.")
  body,ct=mp({'model':'gpt-image-2.5-sunburst','prompt':prompt,'size':'1024x1536','quality':'high','background':'transparent','n':'1'},[ref])
  rq=urllib.request.Request('https://api.openai.com/v1/images/edits',data=body,headers={'Authorization':'Bearer '+key,'Content-Type':ct})
  try: res=json.load(urllib.request.urlopen(rq,timeout=600))
  except urllib.error.HTTPError as x: return f'ERR {c} {e} {x.code} {x.read()[:300]}'
  open(dst,'wb').write(base64.b64decode(res['data'][0]['b64_json']));return dst
with cf.ThreadPoolExecutor(5) as ex:
  for f in ex.map(lambda a:one(*a),JOBS): print(f,flush=True)
