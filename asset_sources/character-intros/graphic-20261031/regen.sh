#!/bin/bash
# 作り直し待ちの人物・背景をまとめて生成する。引数: 作業フォルダ（原画と生成結果を置く）
set -u
W=${1:?work dir}; D="$(cd "$(dirname "$0")" && pwd)"; R="$(cd "$D/../../.." && pwd)"
mkdir -p "$W/out"; cd "$W"
gen() { # out size prompt images...
  local out=$1 size=$2 prompt=$3; shift 3; local args=(); for i in "$@"; do args+=(-F "image[]=@$i"); done
  for t in 1 2 3; do
    curl -sS -N -m 590 -o "$out.sse" https://api.openai.com/v1/images/edits -H "Authorization: Bearer sk-dummy" \
      -F model=gpt-image-2.5-sunburst -F quality=high -F stream=true -F partial_images=1 -F "size=$size" -F "prompt=$prompt" "${args[@]}"
    python3 -I -c "
import json,base64,sys
for l in open(sys.argv[1]+'.sse'):
  if l.startswith('data:'):
    try: d=json.loads(l[5:])
    except Exception: continue
    if d.get('type','').endswith('completed'): open(sys.argv[1],'wb').write(base64.b64decode(d['b64_json'])); print('ok',sys.argv[1]); sys.exit(0)
sys.exit(1)" "$out" && return 0
    grep -q insufficient_quota "$out.sse" && { echo "NO CREDIT $out"; return 1; }
    sleep 3
  done; echo "FAIL $out"
}
STYLE="$D/owner_originals/samechan.png $D/owner_originals/ageha_v1.png $D/owner_originals/rin.png"
BASE=$(sed 's/BGCOLOR/マゼンタ #FF00FF/' "$D/portrait_prompt.txt")
sprite() { python3 -c "
from PIL import Image; import sys
i=Image.open(sys.argv[1]).convert('RGBA'); b=Image.new('RGB',i.size,(255,0,255)); b.paste(i,(0,0),i); b.thumbnail((1024,1024)); b.save(sys.argv[2])" "$R/remake/img/sprites/characters/$1/chr_$1_${2:-normal}.webp" "id_$1.png"; }
sprite adam; sprite minto ura_normal; mv id_minto.png id_oneesan.png
gen out/adam.png 1024x1024 "$BASE

キャラクター: 28歳の大人の日本人男性、シーシャ店EDENの店主。がっしりした筋肉質の体格（厚い胸板・太い首と腕・広い肩幅）。髪は短めで、本人の左側（画面右）が青りんごの緑、本人の右側（画面左）が赤りんごの赤のツートン（左右を逆にしない）。黒いヘンリーネックのシャツを腕まくり、黒いロングエプロン。陽気で芝居がかった大人の男。足を開いて胸を張り、腕を組んだどっしりした構え。組んだ腕の手に赤いりんごと青りんごを一つずつ持つ。両肩と両腕が画面内に収まるように少し引いた構図。若く・細く描かない。目元は前髪の影の形で隠す（黒い帯は禁止）。" $STYLE id_adam.png &
gen out/oneesan.png 1024x1024 "$BASE

キャラクター: 落ち着いた大人の日本人女性（20代後半）、シーシャ店の静かな常連客、私服。長いストレートの黒髪とぱっつん前髪（角・羽・リボン・ハートなどの飾りは無し）。生成りのジャケット風カーディガン、黒いハイネックのトップス（露出は控えめ）、黒いロングスカート、ショルダーバッグ。色はくすんだ生成り・黒・紺だけ。ポーズ: 体を斜め後ろに向け、肩越しに静かに振り返る。片手でショルダーバッグの紐を軽く持ち、もう片手は体の横に下ろす。飲み物やカップは持たない。口は閉じた静かな微笑み。あざとい仕草（指を口元・舌を出す・ウインク・首をかしげる）は禁止。両肩が画面内に収まる構図。黒髪の形を灰青のハイライトで明確に。" $STYLE id_oneesan.png &
wait
for k in nagumo uranaishi volk sumi maki rei naru steve; do
  src="$D/portraits/$k.png"
  gen out/$k.png 1024x1024 "Keep this illustration exactly the same character, pose, colors, shapes and flat graphic style. Zoom out slightly (about 85%) and extend the canvas so that BOTH shoulders and arms fit completely inside the frame with a little margin on the left and right; nothing may be cut by the left or right edge. The character's head stays near the top. Continue the flat solid background color of the original (magenta #FF00FF) into the new area. No other changes, no text." "$src" &
  [ $k = maki ] && wait
done; wait
BGP=$(cat "$D/background_prompt.txt")
OLD="$R/remake/img/ui/character_intros"
bgjpg() { python3 -c "
from PIL import Image; import sys
i=Image.open(sys.argv[1]).convert('RGB'); i.thumbnail((1024,1024)); i.save(sys.argv[2],quality=90)" "$OLD/$1.webp" "bg_ref_$1.jpg"; }
for k in samechan ageha adam; do bgjpg $k; done
STY="bg_ref_samechan.jpg bg_ref_ageha.jpg bg_ref_adam.jpg"
gen out/bg_maki.png 1536x1024 "$BGP Motif for this character: sport axe throwing. A wooden axe-throwing target made of vertical wooden planks with painted concentric rings and a central bullseye; a throwing axe stuck firmly into the target with its blade buried in the wood at the correct angle (blade into the board, handle sticking out). Maple leaves and rust-red accents." $STY "$(bgjpg maki; echo bg_ref_maki.jpg)" &
gen out/bg_steve.png 1536x1024 "$BGP Motif for this character (citrus researcher who loves the lemon-lime flavor 'Mountain Mist'): sliced lemons and limes with bright cross-sections, a misty mountain range silhouette, an analog kitchen timer and handwritten recipe cards. Orange accent with lemon yellow and lime green." $STY "$(bgjpg steve; echo bg_ref_steve.jpg)" &
wait
n=0
for k in adam ageha dr_kemuri hajime hiyori kumicho kuze maezono minto naru oneesan pakki rei rin sai samechan sumi tsumugi uranaishi volk; do
  bgjpg $k; gen out/bg_$k.png 1536x1024 "$BGP Make the colors deeper and richer than the current one, with bold dark flat shapes." $STY bg_ref_$k.jpg &
  n=$((n+1)); [ $((n%5)) = 0 ] && wait
done; wait
echo done
