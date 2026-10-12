(() => {
  const spec=window.TRAILER_SPEC;
  const canvas=document.getElementById('trailerCanvas');
  const ctx=canvas.getContext('2d',{alpha:false});
  const images=new Map();
  let start=0;
  spec.segments.forEach(s=>{s.start=start;start+=s.duration;s.end=start});
  if(Math.abs(start-spec.duration)>0.001)throw Error('Timeline duration mismatch');
  window.trailerReady=Promise.all(spec.segments.filter(s=>s.image).map(s=>new Promise((resolve,reject)=>{
    const im=new Image();im.onload=()=>{images.set(s.image,im);resolve()};im.onerror=()=>reject(Error('Image not loaded: '+s.image));im.src=s.image;
  })));
  const clamp=x=>Math.max(0,Math.min(1,x));
  const smooth=x=>{x=clamp(x);return x*x*(3-2*x)};
  const font=(n,serif=true)=>n+'px '+(serif?'"Hiragino Mincho ProN","Yu Mincho",serif':'-apple-system,"Hiragino Sans",sans-serif');
  function centered(text,y,size,color='#eee8df'){ctx.font=font(size);ctx.fillStyle=color;ctx.textAlign='center';ctx.fillText(text,640,y);ctx.textAlign='left'}
  function lines(text,maxWidth){
    const result=[];let line='';
    for(const c of Array.from(text)){if(ctx.measureText(line+c).width>maxWidth&&line){result.push(line);line=c}else line+=c}
    if(line)result.push(line);return result;
  }
  window.renderTrailerFrame=(time,options={})=>{
    time=Math.max(0,Math.min(spec.duration-0.000001,time));
    const index=spec.segments.findIndex(s=>time<s.end);
    const s=spec.segments[index],local=time-s.start,p=smooth(local/s.duration);
    ctx.fillStyle='#090d13';ctx.fillRect(0,0,1280,720);
    if(s.image){
      const im=images.get(s.image);if(!im)return {index,segment:s};
      let scale=s.move==='hold'?1.012:s.move==='out'?1.038-p*.038:1.008+p*.032;
      if(options.still)scale=1.008;
      let x=-(1280*scale-1280)*s.focus[0],y=-(720*scale-720)*s.focus[1];
      if(s.move==='slide')x-=p*10;
      ctx.drawImage(im,x,y,1280*scale,720*scale);
      if(!options.hideSubtitle){
        const a=smooth((local-.35)/.45);
        ctx.save();ctx.globalAlpha=a;
        const gradient=ctx.createLinearGradient(0,515,0,720);gradient.addColorStop(0,'rgba(0,0,0,0)');gradient.addColorStop(1,'rgba(0,0,0,.83)');ctx.fillStyle=gradient;ctx.fillRect(0,515,1280,205);
        ctx.font=font(23,false);ctx.fillStyle='#d2bc8f';ctx.fillText(s.speaker,70,602);
        ctx.font=font(38);ctx.fillStyle='#f1eee6';ctx.shadowColor='rgba(0,0,0,.9)';ctx.shadowBlur=4;
        const body=options.visibleChars===undefined?s.text:Array.from(s.text).slice(0,options.visibleChars).join('');
        lines(body,1140).forEach((line,i)=>ctx.fillText(line,70,656+i*47));ctx.restore();
      }
    }else if(s.kind==='intro'){
      centered(s.text,362,51);centered('CHAPTER 02',422,20,'#a79b85');
    }else{
      centered(spec.title,276,83);centered(spec.subtitle,329,38,'#c9b083');
      centered(s.text,445,38);centered('予告編コンセプト試作',586,21,'#8d9399');
    }
    if(!options.noFade){
      const fade=Math.max(1-smooth(local/.25),1-smooth((s.duration-local)/.25));
      ctx.fillStyle='rgba(5,8,13,'+fade+')';ctx.fillRect(0,0,1280,720);
    }
    return {index,segment:s};
  };
})();
