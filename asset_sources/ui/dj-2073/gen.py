import json,base64,urllib.request,os,sys,concurrent.futures as cf
key=open(os.path.expanduser('~/.config/openai/api_key')).read().strip()
STYLE="Game UI asset for a dark after-hours shisha bar club DJ minigame called RED ROOM. Palette: deep plum-black (#0b0b0e, #19181e, #302c33), neon coral red (#ff6575) for deck A accents, warm amber (#f5bb67) accents, brushed dark metal, subtle hookah smoke motifs. Semi-realistic painted, clean, high detail, no text, no letters, no logos, no watermark."
J={
 "controller-body":("Straight-on top-down flat view of a DJ controller chassis faceplate filling the whole frame edge to edge, wide landscape, matte dark plum-black anodized aluminum with fine brushed texture, completely smooth plain surface with NO holes, NO sockets, NO slots, NO pads, NO knobs, NO wheels, only a raised beveled outer frame with tiny hex screws in the corners, two very subtle shallow circular shadows on the left and right thirds, thin coral-red LED edge strip on the left side and amber LED edge strip on the right side, a faint engraved hookah smoke ornament at center bottom.","1536x1024","opaque"),
 "jog-wheel":("Top-down orthographic view of one DJ controller jog wheel, perfectly circular and centered filling the frame: outer ring of knurled brushed aluminum with grip dimples, inner glossy black touch platter with a subtle vinyl groove sheen, a small round center display bezel left plain dark, a thin coral LED ring between metal ring and platter. Isolated on fully transparent background.","1024x1024","transparent"),
 "eq-knob":("A single DJ mixer rotary EQ knob viewed straight from above, round, matte black rubberized cap with fine knurled edge, a single bright white indicator line pointing straight up, thin brass collar, centered, isolated on fully transparent background.","1024x1024","transparent"),
}
def gen(name):
  p,size,bg=J[name]; prompt=p+" "+STYLE
  body={"model":"gpt-image-2.5-sunburst","prompt":prompt,"size":size,"n":1,"quality":"high","background":bg,"output_format":"png"}
  req=urllib.request.Request("https://api.openai.com/v1/images/generations",json.dumps(body).encode(),{"Authorization":"Bearer "+key,"Content-Type":"application/json"})
  try: r=json.load(urllib.request.urlopen(req,timeout=600))
  except urllib.error.HTTPError as e: return name,e.read().decode()[:400]
  open(name+".png","wb").write(base64.b64decode(r["data"][0]["b64_json"]))
  json.dump({k:v for k,v in body.items()}|{"created":r.get("created"),"usage":r.get("usage")},open(name+".json","w"),ensure_ascii=False,indent=1)
  return name,"ok"
names=sys.argv[1:] or list(J)
with cf.ThreadPoolExecutor(4) as ex:
  for x in ex.map(gen,names): print(x)
