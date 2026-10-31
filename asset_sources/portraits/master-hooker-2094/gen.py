import os,sys,json,base64,requests,datetime
D=os.path.dirname(os.path.abspath(__file__))
key=open(os.path.expanduser('~/.config/openai/api_key')).read().strip()
E={'smile':'a warm, gentle closed-mouth smile with softened kind eyes, like a patient master pleased with a student',
'laugh':'a hearty open-mouthed laugh, eyes crinkled, head tilted slightly back, delighted grandfatherly amusement',
'serious':'a stern serious focused expression, brows drawn together, mouth set firmly, eyes sharply judging the opponent',
'surprise':'a surprised expression, eyes widened, thick eyebrows raised high, mouth slightly open',
'sad':'a quiet melancholic expression, eyes lowered, brows slanted sadly, mouth closed, wistful',
'angry':'a fierce angry expression, glaring eyes, brows furrowed hard, teeth gritted under the mustache, intimidating'}
f=sys.argv[1]
P=f"Edit this character sprite: change ONLY his facial expression to {E[f]}. Keep exactly the same person, same face shape, white braid, eyebrows, mustache and beard, same crimson robe, cape, sash with shisha hose, same arms-folded pose, same body position and size, same art style and colors. No smoke anywhere, no hand smoke. Full body, fully transparent background."
r=requests.post('https://api.openai.com/v1/images/edits',headers={'Authorization':'Bearer '+key},
 files=[('image[]',('in.png',open(D+'/in.png','rb'),'image/png'))],
 data={'model':'gpt-image-2.5-sunburst','prompt':P,'size':'1024x1536','background':'transparent','quality':'high','output_format':'png'},timeout=700).json()
if 'data' not in r: print(f,json.dumps(r)[:300]);sys.exit(1)
open(f'{D}/raw_{f}.png','wb').write(base64.b64decode(r['data'][0]['b64_json']))
json.dump({'model':'gpt-image-2.5-sunburst','endpoint':'edits','input':'chr_master_hookah_normal.png (#2077) padded to 1024x1536 at (64,168)','prompt':P,'time':datetime.datetime.now().isoformat()},open(f'{D}/raw_{f}.json','w'),indent=1)
print(f,'ok')
