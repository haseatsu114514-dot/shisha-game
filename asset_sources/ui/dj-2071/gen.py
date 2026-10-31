import json,base64,urllib.request,os,sys,concurrent.futures as cf
key=open(os.path.expanduser('~/.config/openai/api_key')).read().strip()
STYLE="Game UI asset for a dark after-hours shisha bar club DJ minigame called RED ROOM. Palette: deep plum-black (#0b0b0e, #19181e, #302c33), neon coral red (#ff6575) for deck A accents, warm amber (#f5bb67) accents, brushed dark metal, subtle hookah smoke motifs. Semi-realistic painted, clean, high detail, no text, no letters, no logos, no watermark."
J={
 "platter":("Top-down orthographic view of a single DJ turntable platter with a black vinyl record, fine grooves, perfectly circular and centered filling the frame, center label is plain dark plum with a thin coral-red and amber ring and a small brass spindle, a strobe dot ring on the outer metal rim. Isolated on fully transparent background, nothing outside the circle.","1024x1024","transparent"),
 "deck-panel":("Seamless flat front panel texture for a DJ deck unit, matte dark plum-black brushed metal with faint scanline texture, subtle screw heads at the four corners, a very faint embossed hookah silhouette pattern, soft coral and amber rim light at the top edge. Flat straight-on, no knobs, no objects, mostly empty dark surface for overlaying controls.","1024x1536","opaque"),
 "mixer-panel":("Narrow vertical DJ mixer faceplate texture, straight-on flat, dark brushed gunmetal with plum tint, engraved thin channel lines, tiny screw heads in corners, a small engraved hookah ornament near the bottom, faint warm amber glow. Mostly empty surface, no knobs, no sliders, no text.","1024x1536","opaque"),
 "fader-cap":("A single DJ crossfader knob cap viewed straight from above, rectangular with rounded corners, matte black rubber with a glowing coral-red center line and brass side trim, centered, isolated on fully transparent background.","1024x1024","transparent"),
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
