const fs=require('fs');
const {chromium}=require(require('path').resolve('remake/test/browser/node_modules/playwright'));
const launch=chromium.launch.bind(chromium);
const names={1:'pc-axe-10',2:'touch-axe-3',3:'pc-axe-3',4:'touch-axe-10',16:'pc-trpg-ordinary',17:'touch-trpg-ordinary',18:'pc-trpg-day8-shark',19:'touch-trpg-day8-shark'};
chromium.launch=async options=>{
 const browser=await launch(options);const newContext=browser.newContext.bind(browser);let count=0;
 browser.newContext=async options=>{
  const label=names[++count]; const context=await newContext({...options,...(label?{recordVideo:{dir:require('path').join(process.env.CAPTURE_DIR || '.codex/artifacts/play-spots-recording','videos'),size:options.viewport||{width:1280,height:720}}}:{})});
  if(label){const close=context.close.bind(context);context.close=async()=>{const pages=context.pages();await close();if(pages[0]?.video()){const source=await pages[0].video().path();fs.renameSync(source,require('path').join(process.env.CAPTURE_DIR || '.codex/artifacts/play-spots-recording','videos',label+'.webm'));}};}
  return context;
 };
 return browser;
};
