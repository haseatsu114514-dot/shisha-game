import os,sys,json,base64,requests,datetime
key=open(os.path.expanduser('~/.config/openai/api_key')).read().strip()
P="""Full-body standing character sprite for a Japanese visual novel, same painted anime illustration style, line weight, shading and proportions as the reference image (the reference is only a STYLE reference; draw a completely different person).
Character: Wang Yanlou, a 58-year-old Chinese shisha grandmaster with the bearing of a legendary old martial-arts master. Short (165cm) but powerfully built, broad chest, thick forearms, very upright proud stance, arms folded across chest, feet planted apart. Long white hair swept back into a single very long thick braid hanging down his back, thick sharp upswept white eyebrows, long white drooping mustache and a white beard tied at the tip, deep wrinkles, tanned skin, fierce intense piercing eyes with a confident faint smile, large knotted hands.
Costume (original design): deep crimson Chinese martial-arts long jacket with black frog-knot buttons and a high collar, embroidered on the hems in dark gold with an original pattern of curling smoke swirls and small shisha-bowl motifs; black loose trousers, black cloth kung-fu shoes; a wide black waist sash wrapped by a coiled braided shisha hose whose metal mouthpiece hangs at the hip like a tassel; a short dark crimson half-cape over the shoulders with a charcoal-black lining and ember-orange edge stitching. Faint wisp of white smoke near one hand only.
No helmet, no mecha, no armor, no logos, no text, no staff, no talismans, no glowing aura, no badges or insignia. Whole body visible head to shoes, centered, facing viewer slightly three-quarter, plain fully transparent background, no floor shadow."""
def save(name,data,meta):
    open(name+'.png','wb').write(base64.b64decode(data['data'][0]['b64_json']))
    meta['time']=datetime.datetime.now().isoformat();meta['model']='gpt-image-2.5-sunburst'
    json.dump(meta,open(name+'.json','w'),ensure_ascii=False,indent=1)
mode=sys.argv[1]
if mode=='normal':
    r=requests.post('https://api.openai.com/v1/images/edits',headers={'Authorization':'Bearer '+key},
      files=[('image[]',('ref.png',open('/workspace/wt-2068/assets/sprites/characters/sumi/chr_sumi_normal.png','rb'),'image/png'))],
      data={'model':'gpt-image-2.5-sunburst','prompt':P,'size':'1024x1536','background':'transparent','quality':'high','output_format':'png'},timeout=600)
    j=r.json()
    if 'data' not in j: print(json.dumps(j)[:500]);sys.exit(1)
    save(sys.argv[2],j,{'endpoint':'edits','prompt':P,'style_reference':'assets/sprites/characters/sumi/chr_sumi_normal.png'})
