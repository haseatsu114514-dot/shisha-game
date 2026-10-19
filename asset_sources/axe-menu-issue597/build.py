"""Convert the two preserved image_gen originals; never redraw game assets."""
from pathlib import Path
from PIL import Image
import hashlib,json,shutil
base=Path(__file__).resolve().parent
root=base.parent.parent
outputs=[]
for name,crop,size in [('menu-walnut-panel',(36,122,2132,588),(1024,228)),('menu-crossed-axes',(250,240,1004,994),(192,192))]:
    original=base/'originals'/('walnut-panel.png' if 'walnut' in name else 'crossed-axes.png')
    im=Image.open(original).convert('RGBA').crop(crop).resize(size,Image.Resampling.LANCZOS)
    target=root/'assets/ui/axe_throw'/f'{name}.webp'
    target.parent.mkdir(parents=True,exist_ok=True)
    im.save(target,'WEBP',quality=86,method=6)
    runtime=root/'remake/img/ui/axe_throw'/target.name
    runtime.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(target,runtime)
    outputs.append({'name':name,'original':str(original.relative_to(root)),'crop':crop,'size':size,'alpha_extrema':im.getchannel('A').getextrema(),'bytes':target.stat().st_size,'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'shared':str(target.relative_to(root)),'runtime':str(runtime.relative_to(root))})
manifest={'issue':597,'generator':'OpenAI built-in image_gen','transparent_background':True,'reference_role':'adopted concept material/style only; no runtime full-screen mockup','outputs':outputs}
manifest['preserved_files']=[{'path':str(p.relative_to(root)),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for folder in ['originals','reference','prompts'] for p in sorted((base/folder).iterdir()) if p.is_file()]
(base/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(outputs,indent=2))
