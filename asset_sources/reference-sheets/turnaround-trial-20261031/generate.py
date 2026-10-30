import os,json,base64,subprocess,concurrent.futures as cf
R=os.path.abspath(os.path.join(os.path.dirname(__file__),'../../..'))
P="""Character reference / model sheet for an existing visual-novel character. Keep the game's CURRENT art style exactly as in the attached standing sprites (same face, hair, outfit, colours, proportions, line quality, soft cel shading). Attached images are the canonical character; do not redesign, do not change age, outfit, hairstyle or colours.
Layout (landscape 1536x1024, plain flat light warm-grey background #e9e6e1, no scenery):
- Top ~70%: four full-body views of the SAME character standing side by side at the SAME scale on one common horizontal ground line, evenly spaced, head and feet fully inside the frame: (1) front view, (2) three-quarter front view, (3) side profile view facing left, (4) back view. Relaxed neutral standing pose, arms slightly away from the body so the outfit silhouette is readable. A thin faint horizontal guide line at the feet and another at the top of the head of the front view, running across all four views.
- Bottom ~30%: a row of five head-and-shoulders expression busts of the same character, same size: normal, smile, serious, surprise, sad.
For parts not visible in the attached sprites (back of outfit, back hair), extrapolate conservatively and simply from what is visible; no new accessories, logos or decorations.
NG: any text, letters, labels, numbers, logo, watermark, extra characters, props, shisha/hookah, cropped feet or head, perspective camera, dramatic lighting, photorealism, 3d render."""
C={'hajime':['normal','smile','serious','surprise'],'mashiro':['normal','smile','serious','surprise']}
def run(a):
  ch,k=a; o=f'{O}/{ch}_turnaround_trial_{k}.png'
  if os.path.exists(o): return o,'skip'
  refs=[f'{R}/assets/sprites/characters/{ch}/chr_{ch}_{f}.png' for f in C[ch]]
  cmd=['curl','-s','-m','600','https://api.openai.com/v1/images/edits','-H','Authorization: Bearer '+os.environ['OPENAI_API_KEY'],'-F','model=gpt-image-2.5-sunburst','-F','size=1536x1024','-F','quality=high','-F','prompt=<-']+sum([['-F','image[]=@'+r] for r in refs],[])
  for t in range(3):
    r=subprocess.run(cmd,input=P.encode(),capture_output=True)
    try:
      d=json.loads(r.stdout); img=base64.b64decode(d['data'][0]['b64_json']); open(o,'wb').write(img)
      open('/workspace/imggen/log.jsonl','a').write(json.dumps({'file':o,'model':'gpt-image-2.5-sunburst','usage':d.get('usage')})+'\n'); return o,'ok'
    except Exception: e=r.stdout[:300]
  return o,'ERR '+e.decode(errors='replace')
with cf.ThreadPoolExecutor(4) as ex:
  for x in ex.map(run,[(c,k) for c in C for k in (1,2)]): print(x,flush=True)
