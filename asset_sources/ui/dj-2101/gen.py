import json,base64,urllib.request,os,sys,concurrent.futures as cf
key=open(os.path.expanduser('~/.config/openai/api_key')).read().strip()
STYLE="Square original album cover artwork for a fictional club track, abstract painterly illustration, game theme palette deep purple-black (#0b0812, #151024) with violet (#b45cf0), neon pink (#ff5fa8) and cyan (#3fd0e8) light, subtle hookah smoke wisps, moody shisha-bar club atmosphere, no text, no letters, no logos, no people faces, no watermark."
J={
 "art-danceMonster":("A playful neon monster silhouette made of smoke dancing under violet strobe light.","1024x1024","opaque"),
 "art-digitalLemonade":("A glowing digital lemon slice dissolving into pixel bubbles and smoke, fizzy and bright.","1024x1024","opaque"),
 "art-ravingEnergy":("Exploding concentric light rings and laser beams bursting from a hookah bowl, high energy.","1024x1024","opaque"),
 "art-cutAndDry":("Sharp geometric shards and clean diagonal cuts of light over dark marble, minimal and crisp.","1024x1024","opaque"),
 "art-risingTide":("A rising neon ocean wave made of smoke under a violet moon, sense of upward motion.","1024x1024","opaque"),
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
with cf.ThreadPoolExecutor(5) as ex:
  for x in ex.map(gen,names): print(x)
