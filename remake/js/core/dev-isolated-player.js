// Isolated visual rehearsal, NOT the production VN engine.
// The sandbox has an opaque origin, no access to the parent or its saves.
export function createIsolatedEventPlayer(getDialogues, doc) {
  let frame = null;
  const close = () => { frame?.remove(); frame = null; };
  function open(id) {
    const scene = getDialogues()?.[id];
    if (!scene) throw new Error("Unknown dialogue ID: " + id);
    close();
    const iframe = doc.createElement("iframe");
    iframe.setAttribute("sandbox", "allow-scripts");
    iframe.setAttribute("title", "隔離イベント試写（本番エンジンではありません）");
    Object.assign(iframe.style, {
      position: "fixed", inset: "3%", width: "94%", height: "94%",
      zIndex: "2147483647", border: "2px solid #ad9fc9", background: "#14101b",
    });
    iframe.srcdoc = `<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
body{background:linear-gradient(145deg,#20172f,#0e0b14);color:#f8f4ff;font:18px/1.8 system-ui;margin:0;padding:28px}
main{max-width:850px;margin:3vh auto}h1{font-size:20px;color:#c5b8e7}#text{min-height:180px;background:#100e18ee;border:1px solid #786b96;border-radius:12px;padding:24px;white-space:pre-wrap}
button{cursor:pointer;border:1px solid #a69abb;background:#332b45;color:white;padding:12px 18px;margin:8px;border-radius:8px}
button:focus-visible{outline:3px solid #fff}#speaker{color:#d8bbff;font-weight:bold}small{color:#c5c0cc}
</style><main><h1 id="title">隔離イベント試写</h1><small>本番の演出・条件分岐・ゲーム状態は再現しません</small>
<h2 id="speaker"></h2><div id="text" aria-live="polite"></div><div id="choices"></div>
<button id="next">次へ →</button><button id="restart">最初から</button></main>
<script>
let scene=null,queue=[],branches={},steps=0;
const $=id=>document.getElementById(id);
function start(){queue=[...(scene.lines||[])];branches=scene.branches||{};steps=0;next()}
function next(){
 if(++steps>1000){$('text').textContent='表示上限に達しました';return}
 const line=queue.shift();$('choices').replaceChildren();
 if(!line){$('speaker').textContent='';$('text').textContent='試写終了';$('next').disabled=true;return}
 $('next').disabled=false;
 if(line.type==='choice'){
   $('speaker').textContent='選択肢';$('text').textContent='選択してください';$('next').disabled=true;
   for(const choice of line.choices||[]){
     const b=document.createElement('button');b.textContent=choice.text||'（無題）';
     b.onclick=()=>{const target=choice.next;
       if(typeof target==='string' && Array.isArray(branches[target]))queue.unshift(...branches[target]);
       else if(choice.next_id)queue.unshift({text:'次のイベント: '+choice.next_id+'（試写では移動しません）'});
       next()};
     $('choices').append(b);
   }
 }else{
   $('speaker').textContent=line.speaker||'';
   $('text').textContent=line.text||'【'+(line.type||'演出')+'】';
 }
}
$('next').onclick=next;$('restart').onclick=()=>scene&&start();
window.addEventListener('message',e=>{if(scene||!e.data||e.data.kind!=='dev-event-rehearsal')return;
 scene=e.data.scene;$('title').textContent='隔離イベント試写: '+e.data.id;start()});
<\/script></html>`;
    iframe.addEventListener("load", () => {
      iframe.contentWindow?.postMessage({
        kind: "dev-event-rehearsal", id,
        scene: JSON.parse(JSON.stringify({
          lines: scene.lines || [], branches: scene.branches || {},
        })),
      }, "*"); // Opaque-origin sandbox requires '*'; payload contains public game dialogue only.
    }, { once: true });
    doc.body.append(iframe);
    frame = iframe;
    return id;
  }
  return Object.freeze({ open, close });
}
