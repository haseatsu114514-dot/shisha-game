"""#896 A3 炭8枚を gpt-image-2.5-sunburst で作り直す（2026-10-31・Grok Bot）。generation.json の手順・プロンプトを使う。"""
import json,os,sys
sys.path.insert(0,'/workspace/imggen'); import oa
from PIL import Image
D=os.path.dirname(os.path.abspath(__file__)); R=os.path.abspath(f'{D}/../..')
g=json.load(open(f'{D}/generation.json')); M='gpt-image-2.5-sunburst'
fix=json.load(open('/tmp/coalfix_prompts.json')) if os.path.exists('/tmp/coalfix_prompts.json') else {}
order=['coal_flat_just.png','coal_just.png','coal_cold.png','coal_red.png','coal_white.png','coal_flat_cold.png','coal_flat_red.png','coal_flat_white.png']
import concurrent.futures as cf
def one(n):
  v=g['images'][n]; ref=v['ref']; p=fix.get(n[:-4],v['prompt']); v['prompt']=p
  oa.edit(p,[f'{D}/{ref}' if ref.startswith('originals') else f'{R}/{ref}'],f'{D}/originals/{n}',quality=g['quality'],background='transparent',model=M)
  return n
for stage in [order[:1],order[1:2],order[2:]]:
  with cf.ThreadPoolExecutor(6) as ex:
    for n in ex.map(one,stage): print('ok',n,flush=True)
g['model']=M; g['regenerated']='2026-10-31 JST: 全8枚を gpt-image-2.5-sunburst で作り直し。coal_cold は向きを他の状態にそろえる文、coal_red は上面の小さな黒い点を出さない文を追加'
json.dump(g,open(f'{D}/generation.json','w'),ensure_ascii=False,indent=1)
# ゲーム用: 外接矩形→幅最大270・320x320・下端（cube 298 / flat 238）
for n in order:
  im=Image.open(f'{D}/originals/{n}').convert('RGBA'); bb=im.getchannel('A').point(lambda a:255 if a>8 else 0).getbbox(); im=im.crop(bb)
  bottom=238 if 'flat' in n else 298; maxh=bottom-28
  r=min(270/im.width,maxh/im.height); im=im.resize((round(im.width*r),round(im.height*r)),Image.LANCZOS)
  c=Image.new('RGBA',(320,320),(0,0,0,0)); c.paste(im,((320-im.width)//2,bottom-im.height),im); c.save(f'{R}/assets/ui/making/{n}')
  print(n,im.size)
