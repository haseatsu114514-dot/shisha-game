"""Reproduce the requested size candidates from unmodified sources. Requires ImageMagick."""
from pathlib import Path
import subprocess
root=Path(__file__).resolve().parent.parent
out=root/'candidates';out.mkdir(exist_ok=True)
for name in ['suv-rival-a','suv-rival-b','medal-silver','medal-bronze','medal-plain','track-rail','word-vs']:
 args=['magick',str(root/'originals'/(name+'.png'))]
 if name.startswith('suv'):args+=['-resize','720x360']
 elif name.startswith('medal'):args+=['-resize','256x256']
 elif name=='track-rail':args+=['-crop','1642x99+15+421','+repage','-resize','1600x96','-gravity','center','-background','none','-extent','1600x96']
 else:args+=['-resize','1024x1024>']
 subprocess.run(args+['-strip',str(out/(name+'.png'))],check=True)
