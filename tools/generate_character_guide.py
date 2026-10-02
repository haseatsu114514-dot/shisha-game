#!/usr/bin/env python3
"""Generate the collaborator-facing character guide PDF.

The guide is intentionally generated from repository-local artwork. It does not
open or depend on Godot. Intermediate face crops are written under tmp/pdfs and
the final PDF is written under output/pdf.
"""

from __future__ import annotations

import math
import subprocess
from pathlib import Path

from PIL import Image as PILImage
from reportlab.lib.colors import Color, HexColor, white
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output" / "pdf" / "suien-zensen-character-guide.pdf"
TMP = ROOT / "tmp" / "pdfs" / "character-guide"
FONT_PATH = ROOT / "assets" / "fonts" / "DotGothic16-Regular.ttf"
PAGE = landscape(A4)
PW, PH = PAGE

FONT = "DotGothic"
INK = HexColor("#F4F0EA")
MUTED = HexColor("#AAA6B2")
PAPER = HexColor("#151722")
PANEL = HexColor("#1D202D")
PANEL_ALT = HexColor("#242736")
LINE = HexColor("#343848")
RED = HexColor("#FF6B73")


def commit_hash() -> str:
    try:
        return subprocess.check_output(
            ["git", "rev-parse", "--short", "HEAD"], cwd=ROOT, text=True
        ).strip()
    except Exception:
        return "unknown"


CHARACTERS = [
    {
        "id": "hajime",
        "name": "はじめ",
        "full": "蒸野 始（むしの はじめ）",
        "role": "主人公 / tonari",
        "age": "22歳",
        "accent": "#8E7CFF",
        "image": "assets/sprites/characters/hajime/chr_hajime_normal.png",
        "core": "一見、感じのいい普通の青年。礼儀正しく働き者だが、『tonariの』と名乗る瞬間だけ少し得意げになる。自分の店を持つ夢は語れるのに、なぜ店なのかを問われると言葉に詰まる。プレイヤーだけが薄い違和感に気づいていく主人公。",
        "shisha": "STYLE  素直さ\n推し  なし\n得意  相手に合わせるミックス全般",
        "story": "勝利と承認で薄さが加速し、全国で味覚を失う。仲間が離れた後、ましろが毎日作る一杯を吸う時間を通して、『空っぽだからこそ全部を吸収できる』と気づく。素直さが初めて本物の武器になる。",
        "voice": "現行台詞の一人称は『俺』。基本は丁寧で率直。内心モノローグでは相手の技術へ素直に驚く。恋愛・交友イベントでは薄さを出さない。",
        "direction": "自信のない謙虚キャラにも、露骨に調子へ乗るキャラにもしない。夢・大会・承認が絡む場面だけ、1シーンに1つ小さな『ほころび』を置く。",
        "quote": "『色んな味を組み合わせるのも、シーシャの面白さですよね？』",
    },
    {
        "id": "sumi",
        "name": "スミさん",
        "full": "墨田 丈一郎（すみだ じょういちろう）",
        "role": "師匠 / tonari店長",
        "age": "46歳",
        "accent": "#D69A55",
        "image": "assets/sprites/characters/sumi/chr_sumi_normal.png",
        "core": "主人公の師匠であり、地元店tonariを営む。飄々としているが、かつては世界に名を知られたプレイヤー。教えすぎず、必要なときだけ短い言葉で背中を押す。はじめの続きを見守りながら、自分も煙の楽しさを取り戻す。",
        "shisha": "STYLE  基本に忠実、かつ自由\n推し  カルダモン\n得意  クラシックスパイス系",
        "story": "15年前の世界大会準優勝者。勝つための煙を作るうち客の顔を見失い、決勝の夜に自分の煙へ何も感じられなくなった。ドバイの路地裏で、目の前の一人のために作ることで戻ってきた。",
        "voice": "一人称は『俺』。語尾は軽く、説明は実務的で短い。重大なことほど平熱で言う。過去を長々と語らせず、間と行動に背負わせる。",
        "direction": "万能な仙人にしない。失敗と喪失を経験した職人であり、はじめに教えながら自分も回復している。説教ではなく、炭や一杯を通じて示す。",
        "quote": "『はじめ。大会、出ろ』",
    },
    {
        "id": "naru",
        "name": "なる",
        "full": "鳴切 亮太（なるぎれ りょうた）",
        "role": "第1章ライバル / ケムリクサ",
        "age": "23歳",
        "accent": "#67D6E5",
        "image": "assets/sprites/characters/naru/chr_naru_normal.png",
        "core": "実力も人格も地元最強格。理論派だが知識をひけらかさず、聞かれれば手の内まで惜しみなく教える。負ければ人目をはばからず悔しがり、それでも相手を称える。最初の壁であり、後に最も痛いことを言える友人になる。",
        "shisha": "STYLE  甘さの追求と誠実な理論\n推し  バニラ\n得意  パン・バニラ系の激甘ミックス",
        "story": "実家の喫茶店が中学時代に閉店した。『店を続ける重さ』を知るため、はじめの軽い夢に厳しい。ケムリクサで働くのも、潰れない店の作り方を学ぶため。負けた夜ほど静かにノートを開く。",
        "voice": "一人称は『俺』。友達の距離感でテンポよく、理屈は具体的。道具や温度の話になると熱量が上がる。教えたうえで勝つことを誇りにする。",
        "direction": "現行正史は『人格者の好敵手』。旧案のイキリ・天才気取りへ戻さない。優しさだけでなく、勝負への執念と店への厳しさを必ず同居させる。",
        "quote": "『いいんだよ。手の内見せて、それでも勝つのが俺の流儀なんで』",
    },
    {
        "id": "adam",
        "name": "アダム",
        "full": "吾妻 大夢（あづま だいむ）",
        "role": "第1章ライバル / Eden",
        "age": "28歳",
        "accent": "#F06C58",
        "image": "assets/sprites/characters/adam/chr_adam_normal.png",
        "core": "純日本人だが頑なにアダムを名乗る、ダブルアップル特化の職人。原初の果実を宇宙の真理のように語り、過剰な自己演出で周囲を振り回す愛すべき変人。だが、一つの味を掘り続けた技術だけは疑いようがない。",
        "shisha": "STYLE  ダブルアップル特化\n推し  ダブルアップル\n得意  アニス強めのダブルアップル",
        "story": "私生活は少しポンコツ。原点の味だけを極めることで、自分の弱さや不器用さごと肯定しようとしている。はじめとの出会い以後、客の体調に合わせて強さを微調整する柔軟さを覚える。",
        "voice": "一人称は『俺』。聖書・神話・宇宙の比喩を大仰に使い、短い沈黙から宣言へつなぐ。技術説明へ入ると急に具体的で精密になる。",
        "direction": "一発ギャグだけにしない。笑いの直後に、1mm単位の炭配置やアニス／リコリスへの本気を見せる。変人性と職人性の落差が魅力。",
        "quote": "『世界はリンゴに始まり、リンゴに帰する。これぞ真理』",
    },
    {
        "id": "minto",
        "name": "みんと / 栞",
        "full": "緑川 栞（みどりかわ しおり）",
        "role": "第1章ライバル・ヒロイン / ぺぱーみんと",
        "age": "自称20歳 / 実年齢29歳",
        "accent": "#69E0A5",
        "image": "assets/sprites/characters/minto/chr_minto_normal.png",
        "image_alt": "assets/sprites/characters/minto/chr_minto_ura_normal.png",
        "core": "コンカフェ『ぺぱーみんと』の人気No.1。小悪魔的な『みんと』は、客の心理と画面映えを読み切る完璧な商品。一方、私服の栞は声が小さく、自信がなく、相手の反応をうかがう。二つの姿の落差そのものがキャラの核。",
        "shisha": "STYLE  客商売・魅せ方の極意\n推し  ミント\n得意  清涼感特化のミントミックス",
        "story": "失われた実家の純喫茶を買い戻すため、20代を資金作りへ費やした。精肉店へ変わった記憶の幻臭をミントで上書きしようとしている。はじめは私服の彼女を『お姉さん』として先に知る。",
        "voice": "営業時は一人称『みんと』、高テンション、♡や♪、小悪魔的。素は一人称『私』、短文と『……』が増え、急に弱々しくなる。落差を1シーン内でも明確に描く。",
        "direction": "営業姿を単なる嘘、素を単なる本物にしない。どちらも栞が生き抜くために選んだ本気の姿。年齢ネタだけで消費せず、客商売の戦略眼と大人の切実さを残す。",
        "quote": "営業『初ご来店、嬉しいなー♡』 / 素『……きみ、いいシーシャ屋さんに、なるよ』",
    },
    {
        "id": "tsumugi",
        "name": "つむぎ",
        "full": "つむぎ（フルネーム要確認）",
        "role": "第1章ヒロイン / tonari常連",
        "age": "21歳",
        "accent": "#A998D5",
        "image": "assets/sprites/characters/tsumugi/chr_tsumugi_normal.png",
        "core": "画面にひびの入ったiPadで、いつも煙を描いている寡黙な常連。煙を色として捉え、同じ形が二度と現れないから描きたくなる。ラベンダーしか頼まないが、はじめの煙にだけ少しずつ心を開く。",
        "shisha": "STYLE  吸い手 / 煙を色で捉える\n推し  ラベンダー\n好み  フローラル・お茶系",
        "story": "過去の人間関係で傷つき、ラベンダーの香りを殻にして平静を保っている。本当は別の香りへ踏み出す勇気を求めており、やがて『少しだけ甘い香りを』と自分から頼めるようになる。",
        "voice": "一人称は現行台詞で『私／わたし』。短文、言い淀み、長い間。感情を直接説明せず、色・濁り・形の比喩で煙と相手を読む。",
        "direction": "無口を無反応にしない。視線、ペン先、iPad、注文の小さな変化で内面を動かす。台詞を増やすより、一語の選び方を変える。",
        "quote": "『同じ形は、二度と現れない。一瞬で消える。だから……描きたくなる』",
    },
    {
        "id": "rin",
        "name": "凛",
        "full": "匂坂 凛（さぎさか りん）",
        "role": "第1章ヒロイン / Dr.fookah・NIGHTSIDE",
        "age": "27歳",
        "accent": "#7897C9",
        "image": "assets/sprites/characters/rin/chr_rin_normal.png",
        "core": "問屋街の卸直営店Dr.fookahで、海外メーカーNIGHTSIDEの日本代理店デスクを仕切る『問屋街の魔女』。気だるげでからかい上手。はじめを未発売サンプルの試香モルモットとして雇うが、危険な橋は必ず自分が先に渡る大人。",
        "shisha": "STYLE  商材は自分の鼻と肺で確かめる\n推し  ブルーベリー\n得意  未発売の試作ロット全般",
        "story": "業界の上流で香りを扱いながら、自分が卸した香りを吸う客の顔を知らない。はじめがtonariでの反応を持ち帰ることが関係の軸。香りの専門家として、彼の味覚異変へ最初に気づく。",
        "voice": "一人称は『私』。はじめを『モルモットくん』と呼ぶ。短い命令、乾いた冗談、仕事の具体語を混ぜる。大人であることを隠さず、線引きは正確。",
        "direction": "危険な雰囲気と無責任を混同しない。同意書、先行試香、ロット管理など、グレーに見える場面ほど彼女の職業倫理を具体的に置く。",
        "quote": "『まず一口。考えるのは吐いてから』",
    },
    {
        "id": "ageha",
        "name": "アゲハ",
        "full": "宵野 葉子（よいの ようこ）",
        "role": "第2章ライバル・ヒロイン / ParaPara",
        "age": "22歳（資料上の統一値）",
        "accent": "#FF72AE",
        "image": "assets/sprites/characters/ageha/chr_ageha_normal.png",
        "core": "平成ギャルマインドで店を回す、直感型の天才。『カワイイは最強』『バイブスで全部OK』が信条だが、独特な擬音やギャル語は初心者向けの最適解を感覚で言語化したもの。誰にでも分け隔てなく接する。",
        "shisha": "STYLE  バイブスと直感\n推し  ホワイト／レッドグミベア\n得意  トロピカルフルーツ系",
        "story": "体調により手が震え、感覚が鈍る日がある。教えられない本当の理由は、言葉にした瞬間に魔法が消え、自分が凡人になる恐怖。はじめが直感を少しずつ言語化することで救われていく。",
        "voice": "一人称は『うち』。『ガチ』『エモい』『しか勝たん』などを使い、擬音で吸い方を伝える。明るさの下で沈黙した瞬間だけ不安が見える。",
        "direction": "浅い・無知なギャルにしない。理論を知らなくても観察精度は高い。病弱さを常時の悲壮感へ変えず、主人公だけが知る秘密として扱う。",
        "quote": "『今日はなんか重い感じがするから少なめにしようかなー、みたいな』",
    },
    {
        "id": "kumicho",
        "asset_id": "ryuji",
        "name": "シーシャ組長",
        "full": "神崎 竜二（かんざき りゅうじ）",
        "role": "第2章ライバル / 神崎煙草店",
        "age": "39歳",
        "accent": "#D35B5B",
        "image": "assets/sprites/characters/ryuji/chr_ryuji_normal.png",
        "core": "口も態度も荒く、笑い声も怒鳴り声もでかいヤクザの組長。初対面から『おう、座れ。吸ってけ』と距離を詰める。がさつに見えて客と葉の状態はよく見ており、技術と面倒見は確か。情に厚く、筋の通った仕事に弱い。",
        "shisha": "STYLE  スジを通す煙\n推し／得意  ドラゴンフルーツ\n技  0分蒸らしの吸い上げ（交友で解放）",
        "story": "抗争で若衆を失った後悔から、穏やかな時間を作るシーシャに救われた。素性を隠しているが、後に暴かれる。煙を共に吸うことを盃と同じ『縁』として、一生大切にする。",
        "voice": "一人称は『俺』。敬語を使わず、短く荒い。『おう』『座れ』『吸ってけ』と遠慮なく距離を詰める。怒鳴るように笑い、感動すれば豪快に泣くが、弱い相手を萎縮させるための威圧はしない。",
        "direction": "荒々しさを消して善人に見せない。でかい声、直情的な反応、面倒見のよさを同時に出す。ヤクザの一発ネタにもせず、技術の筋と失った者への後悔を残す。実装speaker IDは『kumicho』、画像フォルダは『ryuji』。",
        "quote": "『フレーバーにも仁義があんだよ。生まれ持った声を殺さず、真正面から引っ張り出す』",
        "no_faces": True,
        "art_hold": True,
        "art_note": "現行のryuji画像はマスタ設定と外見が一致しないため不使用。次回制作は、39歳の日本人男性、長身で威圧感のある体格、鋭い顔と小さな傷、撫でつけた黒髪、ダークスーツ、胸元や前腕に刺青の気配、炭を扱う手だけは繊細という要件で行う。",
    },
    {
        "id": "mashiro",
        "name": "ましろ",
        "full": "水瀬 ましろ",
        "role": "第3章ヒロイン / mukai",
        "age": "22歳 / 154cm",
        "accent": "#D6CFAE",
        "image": "assets/sprites/characters/mashiro/chr_mashiro_normal_v3_154cm.png",
        "core": "つむぎとみんとの中間ほどの、小柄なmukaiの同僚。普通のシーシャを『お水ですか？』と聞くほど舌が重い煙へ慣れているが、作り手の想いが本気で乗った煙だけは鮮明に感じ取り、すべて言葉にできる。",
        "shisha": "STYLE  想いの乗った煙を読む\n推し／得意  シガーリーフ全般\n別名  巷で噂の凄腕『シガーマン』",
        "story": "重い葉へ慣れすぎて通常の味覚はバグっているが、本人は元へ戻そうと思っていない。シガーリーフ全般を好み、今の感覚を自分の通常としている。味覚を失いかけたはじめには治療を押しつけず、何も聞かず毎日一杯を作って自分なりに寄り添う。",
        "voice": "一人称は『私／わたし』。眠たげな短文と長い間。感情を説明しすぎず、煙の温度や重さをぽつりと伝える。はじめが受け取れる状態になると少し語尾が伸び、柔らかくなる。",
        "direction": "本人の味覚を治す物語にしない。今の感覚のまま他人へ寄り添える人物として描く。相手の煙に想いがなければ、優しくてもはっきり『見えていない』と突く。シガーマンの正体を本人だけ誤解するコメディも残す。",
        "quote": "『泣いていいよ。煙のせいにしとけば、分かんないから』",
        "no_faces": True,
    },
    {
        "id": "dr_kemuri",
        "name": "チャコール博士",
        "full": "炭場 創（たんば そう）",
        "role": "固定審査員・研究者 / SMOKE LAB",
        "age": "38歳",
        "accent": "#74C49A",
        "image": "assets/sprites/characters/dr_kemuri/chr_dr_kemuri_normal.png",
        "core": "ヒートマネジメント、パイプ、シーシャ用炭まで開発し、日本の業界を裏で支える研究者。炭の匂いが煙へ乗りにくいチャコールは全国で使われている。温和で紳士的だが、発展のためなら危うい実験もしていそうな気配を持つ。",
        "shisha": "STYLE  全てをデータで最適化\n推し  コーラ\n得意  酸味・シトラス系の変わり種",
        "story": "職人時代、自分の感覚で作った一杯を全否定され、何を吸っても炭の味ばかりが残るようになった。炭臭の少ないチャコールの開発は、その感覚を分解した結果でもある。データは二度と傷つかないための盾。第5章で再び自分の舌で煙を差し出す。",
        "voice": "穏やかな口調のまま、温度差や標準偏差など具体値を挟む。危険な発言も笑顔と同じトーン。自作機材だと分かると急に無邪気になる。",
        "direction": "完全な悪役ではなく、傷ついた元職人と、日本のシーシャ業界を裏で支える研究者を両立させる。危うさの奥にある技術者としての実績と愛情を必ず残す。",
        "quote": "『その熱管理デバイス。それ、作ったの俺だもん』",
    },
    {
        "id": "nagumo",
        "name": "南雲 修二",
        "full": "なぐも しゅうじ",
        "role": "大会審査員長 / C.STATION会長",
        "age": "45歳",
        "accent": "#6D86B8",
        "image": "assets/sprites/characters/nagumo/chr_nagumo_normal.png",
        "core": "誰でも入りやすい大衆チェーンを広げる経営者であり、プロ大会では容赦のない審査員長。精度そのものより、何を背負い誰のために作った煙なのかを見る。自社の店を、本物の煙へ至る入口だと割り切っている。",
        "shisha": "JUDGE  作り手の生き様が煙に出ているか\n推し  シガー（葉巻系）\n流儀  持ち点を最後まで温存し、一台へ投入",
        "story": "小さな古い店で救われた体験を全国へ届けるため、チェーン展開を選んだ。個人店で味を追うスミさんとは、真逆の道を歩いた旧友でありライバル。若手店員をお忍びで見に行く。",
        "voice": "静かで断定的。味の感想より、人間と客の表情を語る。短い『ほう』や二口目が大きな評価になる。威圧のために怒鳴らない。",
        "direction": "チェーン店を軽蔑する権威者にしない。大衆化も本気の理念。大会の厳しさは、若者に技術以上の宛先を求める愛情の裏返し。",
        "quote": "『その人間がどんな人生を歩み、なぜシーシャを作るのか。全部、煙に出てる』",
    },
]


PAIR = [
    {
        "id": "maezono",
        "name": "前園 宗次郎",
        "role": "ゲスト審査員 / HOOKAH PRESS編集長",
        "age": "39歳",
        "accent": "#F3A65D",
        "image": "assets/sprites/characters/maezono/chr_maezono_normal.png",
        "body": "どんな一杯も本当においしそうに吸う、業界の有名ライター。煙量・個性・インパクト、見ていて楽しい煙を高く評価する。超平和主義で、大会後は敗者も必ず拾うコラムを書く。",
        "flavor": "推し: ミント、ダブルアップル",
        "voice": "口癖は『シーシャはおいしいねえ』。好奇心と食レポの温度で場を明るくする。",
        "quote": "『若い子たちの熱気がビシビシ伝わってくるねえ！』",
    },
    {
        "id": "pakki",
        "asset_id": "packii",
        "name": "パッキー",
        "role": "大会MC兼マスコット",
        "age": "年齢不詳",
        "accent": "#F4D35E",
        "image": "assets/sprites/characters/packii/chr_packii_normal.png",
        "body": "常にハイテンションで喋り倒し、敗退の残酷ささえショーにする名物MC。本当においしい煙が出た時だけ沈黙し、煙が虹色になる。実は初期世界大会の創設メンバー。",
        "flavor": "推し: ガムシナモン（仮）",
        "voice": "笑い声は『ぷぷぷっ！』。語尾を跳ねさせ、観客を煽る。沈黙そのものが最大の賛辞。",
        "quote": "『誰かの夢が終わる日！ 誰かの夢だけが始まる日！』",
    },
]


FUTURE = [
    ("零-REI- / 田中 健太", "25歳 / 零-ZERO-", "カリスマ", "ローズ・フローラル", "派手なV系ペルソナは、極度の人見知りを守る鎧。"),
    ("ヴォルク・イヴァノフ", "37歳 / Железный Дым", "完璧な熱管理と精度", "ダークミント／シガー", "極寒で客を守るため精度を極めた。冷たさではなく優しさ。"),
    ("ナンディ・カルダモン", "31歳 / Prana Dhūm", "伝統的なスパイスと生命の煙", "パンラースナ", "伝統と現代フレーバーの融合へ進むインド流職人。"),
    ("スティーブ・デイビス", "30歳 / Smoke & Glory", "繊細な超低温管理", "Mountain Fog", "巨漢の見た目に反して、焦がさない外科的な炭管理。"),
    ("マスター・フーカ / 王 煙楼", "58歳 / アジア圏シーシャ協会", "陰陽五行の理", "ライチ", "体質と精神へ合わせる世界大会のボス。スミの源流の一人。"),
    ("シェイク・アル=ガリヤーン", "52歳 / ドバイ王族", "純金機材と至上の煙", "グレープ", "資金力を誇示するだけでなく、単一味を極限まで洗練する。"),
    ("SHISHA-9000", "AI / SMOKE LAB", "最適化アルゴリズム", "環境へ100%最適化", "平均化された完璧さには宛先と賭けた人生がない。本作の問いの鏡。"),
    ("エミル", "48歳 / 大会審査員", "伝統と歴史", "ピスタチオ（仮）", "トプハーネ地区の元ナルギレ職人。技術の奥の人間を見る。"),
    ("DJ SMOKE", "35歳 / 大会審査員", "空間とフロアの一体感", "エナジードリンク（仮）", "味単体ではなく、音・照明・場の空気まで審査する。"),
    ("ダ・シルヴァ太陽", "28歳 / 世界戦プレイヤー", "フェスタとショーマンシップ", "南国フルーツ", "煙を祝祭へ変える世界戦のプレイヤー兼ゲスト審査員。"),
    ("ムカイさん", "48歳 / mukai店長", "東京編の溜まり場を守る", "お茶・コーヒー系", "はじめとましろが働くtonari姉妹店の店長。"),
]


def rel(path: str) -> Path:
    return ROOT / path


def register_fonts() -> None:
    pdfmetrics.registerFont(TTFont(FONT, str(FONT_PATH)))


def faded(color: Color, amount: float = 0.25) -> Color:
    return Color(
        color.red + (1 - color.red) * amount,
        color.green + (1 - color.green) * amount,
        color.blue + (1 - color.blue) * amount,
    )


def wrap_text(text: str, size: float, width: float) -> list[str]:
    lines: list[str] = []
    for para in text.split("\n"):
        if not para:
            lines.append("")
            continue
        line = ""
        for ch in para:
            trial = line + ch
            if line and pdfmetrics.stringWidth(trial, FONT, size) > width:
                lines.append(line)
                line = ch
            else:
                line = trial
        if line:
            lines.append(line)
    return lines


def draw_text(
    c: canvas.Canvas,
    text: str,
    x: float,
    y: float,
    width: float,
    size: float = 9.2,
    leading: float | None = None,
    color: Color = INK,
    max_lines: int | None = None,
) -> float:
    leading = leading or size * 1.55
    lines = wrap_text(text, size, width)
    if max_lines and len(lines) > max_lines:
        lines = lines[:max_lines]
        if lines:
            lines[-1] = lines[-1][:-1] + "…"
    c.setFont(FONT, size)
    c.setFillColor(color)
    for line in lines:
        c.drawString(x, y, line)
        y -= leading
    return y


def rounded_panel(c: canvas.Canvas, x: float, y: float, w: float, h: float, fill=PANEL) -> None:
    c.setFillColor(fill)
    c.setStrokeColor(LINE)
    c.setLineWidth(0.7)
    c.roundRect(x, y, w, h, 10, fill=1, stroke=1)


def panel(
    c: canvas.Canvas,
    title: str,
    body: str,
    x: float,
    y: float,
    w: float,
    h: float,
    accent: Color,
    body_size: float = 8.7,
    max_lines: int | None = None,
) -> None:
    rounded_panel(c, x, y, w, h)
    c.setFillColor(accent)
    c.roundRect(x + 12, y + h - 26, 4, 14, 2, fill=1, stroke=0)
    c.setFont(FONT, 8.5)
    c.drawString(x + 23, y + h - 22, title)
    draw_text(c, body, x + 14, y + h - 42, w - 28, body_size, body_size * 1.5, INK, max_lines)


def draw_chip(c: canvas.Canvas, text: str, x: float, y: float, accent: Color) -> float:
    size = 8.2
    width = pdfmetrics.stringWidth(text, FONT, size) + 22
    c.setFillColor(Color(accent.red, accent.green, accent.blue, alpha=0.16))
    c.setStrokeColor(Color(accent.red, accent.green, accent.blue, alpha=0.52))
    c.roundRect(x, y, width, 23, 11, fill=1, stroke=1)
    c.setFillColor(faded(accent, 0.16))
    c.setFont(FONT, size)
    c.drawString(x + 11, y + 7, text)
    return x + width + 8


def background(c: canvas.Canvas, accent: Color | None = None) -> None:
    c.setFillColor(PAPER)
    c.rect(0, 0, PW, PH, fill=1, stroke=0)
    if accent:
        c.setStrokeColor(Color(accent.red, accent.green, accent.blue, alpha=0.12))
        c.setLineWidth(18)
        for i in range(4):
            p = c.beginPath()
            y = PH * (0.15 + i * 0.18)
            p.moveTo(PW * 0.50, y)
            p.curveTo(PW * 0.67, y + 75, PW * 0.77, y - 55, PW + 30, y + 35)
            c.drawPath(p, stroke=1, fill=0)


def footer(c: canvas.Canvas, page_no: int, label: str = "CHARACTER GUIDE") -> None:
    c.setStrokeColor(LINE)
    c.setLineWidth(0.6)
    c.line(35, 28, PW - 35, 28)
    c.setFillColor(MUTED)
    c.setFont(FONT, 7.2)
    c.drawString(36, 15, f"水煙前線 -EN:CODE- / {label}")
    right = f"{page_no:02d}"
    c.drawRightString(PW - 36, 15, right)


def draw_image_contain(c: canvas.Canvas, path: Path, x: float, y: float, w: float, h: float) -> None:
    im = PILImage.open(path).convert("RGBA")
    alpha_bbox = im.getchannel("A").getbbox()
    if alpha_bbox:
        im = im.crop(alpha_bbox)
    iw, ih = im.size
    scale = min(w / iw, h / ih)
    dw, dh = iw * scale, ih * scale
    c.saveState()
    c.setFillAlpha(1)
    c.setStrokeAlpha(1)
    c.drawImage(
        ImageReader(im),
        x + (w - dw) / 2,
        y + (h - dh) / 2,
        width=dw,
        height=dh,
        preserveAspectRatio=True,
        mask="auto",
    )
    c.restoreState()


def draw_image_cover(c: canvas.Canvas, path: Path) -> None:
    im = PILImage.open(path)
    iw, ih = im.size
    scale = max(PW / iw, PH / ih)
    dw, dh = iw * scale, ih * scale
    c.drawImage(ImageReader(im), (PW - dw) / 2, (PH - dh) / 2, dw, dh)


def face_crop(source: Path, key: str) -> Path:
    TMP.mkdir(parents=True, exist_ok=True)
    out = TMP / f"face-{key}.png"
    if out.exists() and out.stat().st_mtime >= source.stat().st_mtime:
        return out
    im = PILImage.open(source).convert("RGBA")
    alpha = im.getchannel("A")
    bbox = alpha.getbbox() or (0, 0, im.width, im.height)
    x0, y0, x1, y1 = bbox
    bw, bh = x1 - x0, y1 - y0
    side = max(180, int(min(bw * 0.72, bh * 0.34)))
    cx = (x0 + x1) // 2
    top = max(0, y0 - int(side * 0.02))
    left = max(0, min(im.width - side, cx - side // 2))
    top = max(0, min(im.height - side, top))
    crop = im.crop((left, top, left + side, top + side))
    backdrop = PILImage.new("RGBA", (360, 360), (34, 37, 51, 255))
    crop.thumbnail((342, 342), PILImage.Resampling.LANCZOS)
    backdrop.alpha_composite(crop, ((360 - crop.width) // 2, (360 - crop.height) // 2))
    backdrop.save(out)
    return out


def expression_files(ch: dict) -> list[tuple[str, Path]]:
    if ch.get("no_faces"):
        return []
    asset_id = ch.get("asset_id", ch["id"])
    folder = ROOT / "assets" / "sprites" / "characters" / asset_id
    labels = [
        ("normal", "通常"),
        ("smile", "笑顔"),
        ("serious", "真剣"),
        ("surprise", "驚き"),
        ("sad", "沈み"),
        ("thinking", "思案"),
        ("intense", "熱"),
        ("wink", "ウィンク"),
    ]
    found: list[tuple[str, Path]] = []
    for suffix, label in labels:
        candidates = list(folder.glob(f"chr_{asset_id}_{suffix}.png"))
        if candidates:
            found.append((label, candidates[0]))
        if len(found) == 5:
            break
    return found


def draw_expressions(c: canvas.Canvas, ch: dict, accent: Color) -> None:
    items = expression_files(ch)
    if not items:
        return
    box = 43
    gap = 7
    total = len(items) * box + (len(items) - 1) * gap
    x = 554 + (252 - total) / 2
    y = 44
    for idx, (label, path) in enumerate(items):
        fp = face_crop(path, f"{ch['id']}-{idx}")
        c.setFillColor(PANEL_ALT)
        c.setStrokeColor(Color(accent.red, accent.green, accent.blue, alpha=0.5))
        c.roundRect(x, y, box, box, 8, fill=1, stroke=1)
        c.drawImage(str(fp), x + 2, y + 2, box - 4, box - 4, mask="auto")
        c.setFillColor(MUTED)
        c.setFont(FONT, 5.7)
        c.drawCentredString(x + box / 2, y - 9, label)
        x += box + gap


def cover_page(c: canvas.Canvas, page_no: int, commit: str) -> None:
    draw_image_cover(c, rel("assets/backgrounds/bg_title.png"))
    c.setFillColor(Color(0.035, 0.038, 0.08, alpha=0.56))
    c.rect(0, 0, PW, PH, fill=1, stroke=0)
    c.setFillColor(Color(0.04, 0.04, 0.08, alpha=0.78))
    c.roundRect(48, 64, 460, 465, 18, fill=1, stroke=0)
    c.setFillColor(HexColor("#FF927C"))
    c.setFont(FONT, 10)
    c.drawString(76, 486, "SUien ZENSEN / CREATIVE REFERENCE")
    c.setFillColor(INK)
    c.setFont(FONT, 34)
    c.drawString(72, 423, "水煙前線")
    c.setFont(FONT, 26)
    c.drawString(74, 378, "-EN:CODE-")
    c.setFont(FONT, 19)
    c.drawString(74, 320, "キャラクター設定資料")
    c.setFillColor(HexColor("#FFB39D"))
    c.roundRect(73, 270, 188, 27, 13, fill=1, stroke=0)
    c.setFillColor(HexColor("#332029"))
    c.setFont(FONT, 9)
    c.drawCentredString(167, 278, "制作共有用 / 完全ネタバレ")
    draw_text(
        c,
        "シーシャを知る共同制作者向け。用語解説ではなく、人物の価値観・煙・物語・台詞の芯を揃えるための資料。",
        75,
        232,
        385,
        10,
        17,
        INK,
    )
    c.setFillColor(MUTED)
    c.setFont(FONT, 8)
    c.drawString(75, 105, f"Edition 1 / 2026-06-29 / source commit {commit}")
    c.drawString(75, 86, "Canonical repository: haseatsu114514-dot/shisha-game")
    footer(c, page_no, "CHARACTER GUIDE / INTERNAL")
    c.showPage()


def intro_page(c: canvas.Canvas, page_no: int) -> None:
    accent = HexColor("#FF8D76")
    background(c, accent)
    c.setFillColor(accent)
    c.setFont(FONT, 9)
    c.drawString(45, 550, "01 / HOW TO USE")
    c.setFillColor(INK)
    c.setFont(FONT, 25)
    c.drawString(43, 510, "この資料の前提")
    panel(c, "作品の軸", "正式タイトルは『水煙前線 -EN:CODE-』。シーシャ店ADV＋育成／大会もの。地元から世界へ進むが、勝敗の芯は技術値ではなく『誰のために、何を賭けて作る煙か』にある。", 43, 362, 356, 118, accent, 9.2)
    panel(c, "想定読者", "シーシャの基本語彙を知る共同制作者。炭・蒸らし・吸い出し・ダークリーフ等の初歩解説は省略し、キャラごとの作法とドラマへ紙面を使う。", 43, 230, 356, 112, accent, 9.2)
    panel(c, "視点と見せ方", "物語は主人公はじめの一人称視点。ゲーム中は、はじめの立ち絵を原則表示しない。立ち絵はデザイン共有・告知・特殊演出の参照として扱う。", 43, 98, 356, 112, accent, 9.2)
    panel(c, "設定の優先順位", "現行の基準は data/characters.json、現行dialogue、CLAUDE.mdの確定事項。brand/character_profiles.mdは詳細参照だが、旧案が残る箇所は現行マスタを優先する。", 421, 362, 376, 118, accent, 9.2)
    panel(c, "制作共有のルール", "キャラをフレーバー1個の擬人化へ縮めない。得意味は、その人の生き方・接客・弱点とつながる。説明台詞より、炭配置・注文・一口目・沈黙で価値観を見せる。", 421, 230, 376, 112, accent, 9.2)
    panel(c, "ネタバレ運用", "本資料は内部共有用で、隠し設定と後半アークを含む。外部公開する場合は各ページの STORY ARC / SECRET を外し、年齢詐称・正体・味覚喪失などの情報を再編集する。", 421, 98, 376, 112, RED, 9.2)
    footer(c, page_no)
    c.showPage()


def caution_page(c: canvas.Canvas, page_no: int) -> None:
    accent = HexColor("#F4D35E")
    background(c, accent)
    c.setFillColor(accent)
    c.setFont(FONT, 9)
    c.drawString(45, 550, "02 / CONTINUITY")
    c.setFillColor(INK)
    c.setFont(FONT, 25)
    c.drawString(43, 510, "旧設定を混ぜないための固定事項")
    items = [
        ("なる", "現行は人格者の好敵手。『イキリオタク』『天才気取りから改心』は旧案で使用しない。", "FIXED"),
        ("はじめ", "一人称は『俺』。露骨なイキリにも、弱気な謙虚主人公にもしない。", "FIXED"),
        ("アゲハ", "本資料では22歳に統一。characters.jsonのageとブランド設定は22歳だが、descriptionに24歳表記が残る。", "FIXED"),
        ("チャコール博士", "ヒートマネジメント、パイプ、炭臭の少ないチャコールを開発し、日本の業界を裏で支える研究者。", "FIXED"),
        ("ましろ", "154cmの小柄な体格。一人称は『私／わたし』。シガーリーフ全般が好みで、自分の味覚を元へ戻すアークは持たない。", "FIXED"),
        ("つむぎ", "現行マスタ名は『つむぎ』。CLAUDE.mdにはフルネーム表記があるが、data側未反映。外部素材では姓を保留する。", "CHECK"),
        ("実装ID", "神崎竜二のspeakerは kumicho、画像フォルダは ryuji。パッキーのspeakerは pakki、画像フォルダは packii。", "FIXED"),
        ("店舗・大会", "チェーン名は C.STATION。地元大会は SMOKE CROWN CUP。旧大会名・旧チェーン表記を使わない。", "FIXED"),
    ]
    x0, y0 = 43, 448
    cw, ch = 368, 84
    for i, (name, body, status) in enumerate(items):
        col, row = i % 2, i // 2
        x = x0 + col * 386
        y = y0 - row * 98 - ch
        rounded_panel(c, x, y, cw, ch)
        color = accent if status == "FIXED" else RED
        c.setFillColor(color)
        c.setFont(FONT, 7.1)
        c.drawRightString(x + cw - 13, y + ch - 20, status)
        c.setFont(FONT, 11)
        c.drawString(x + 14, y + ch - 23, name)
        draw_text(c, body, x + 14, y + ch - 44, cw - 28, 8.2, 12.2, INK, 3)
    footer(c, page_no, "CONTINUITY NOTES")
    c.showPage()


def cast_map_page(c: canvas.Canvas, page_no: int) -> None:
    accent = HexColor("#8E7CFF")
    background(c, accent)
    c.setFillColor(accent)
    c.setFont(FONT, 9)
    c.drawString(45, 550, "03 / CAST MAP")
    c.setFillColor(INK)
    c.setFont(FONT, 25)
    c.drawString(43, 510, "主要人物の配置")
    groups = [
        ("HOME / tonari", "#D69A55", [("はじめ", "吸収する主人公", "hajime"), ("スミ", "師匠・過去の鏡", "sumi"), ("つむぎ", "煙を色で読む", "tsumugi")]),
        ("CHAPTER 1", "#69E0A5", [("なる", "最初の壁と友人", "naru"), ("アダム", "原点特化", "adam"), ("みんと", "魅せ方と仮面", "minto"), ("凛", "香りの上流", "rin")]),
        ("CHAPTER 2-3", "#FF72AE", [("アゲハ", "直感と言語化", "ageha"), ("竜二", "荒々しさと面倒見", "kumicho"), ("ましろ", "はじめへ寄り添う", "mashiro")]),
        ("TOURNAMENT", "#74C49A", [("南雲", "生き様を審査", "nagumo"), ("博士", "データと傷", "dr_kemuri"), ("前園", "楽しさと個性", "maezono"), ("パッキー", "残酷なショー", "pakki")]),
    ]
    gx, gy, gw, gh = 42, 91, 182, 370
    for gi, (title, color_hex, people) in enumerate(groups):
        x = gx + gi * 196
        color = HexColor(color_hex)
        rounded_panel(c, x, gy, gw, gh, PANEL)
        c.setFillColor(color)
        c.rect(x, gy + gh - 8, gw, 8, fill=1, stroke=0)
        c.setFont(FONT, 10)
        c.drawString(x + 13, gy + gh - 32, title)
        py = gy + gh - 76
        for name, role, cid in people:
            source = next((p for p in CHARACTERS + PAIR if p["id"] == cid), None)
            if source and not source.get("art_hold"):
                fp = face_crop(rel(source["image"]), f"map-{cid}")
                c.setFillColor(PANEL_ALT)
                c.circle(x + 39, py + 17, 24, fill=1, stroke=0)
                c.drawImage(str(fp), x + 17, py - 5, 44, 44, mask="auto")
            elif source:
                c.setFillColor(PANEL_ALT)
                c.circle(x + 39, py + 17, 24, fill=1, stroke=0)
                c.setFillColor(HexColor("#D35B5B"))
                c.setFont(FONT, 6.2)
                c.drawCentredString(x + 39, py + 15, "ART HOLD")
            c.setFillColor(INK)
            c.setFont(FONT, 9.5)
            c.drawString(x + 73, py + 22, name)
            c.setFillColor(MUTED)
            c.setFont(FONT, 7.2)
            c.drawString(x + 73, py + 6, role)
            py -= 67
    draw_text(c, "関係の基本: はじめは相手を打ち負かすだけでなく、その人の良さを吸収する。相手側も、はじめとの一杯を経て自分のスタイルを少し変える。", 43, 66, 752, 8.5, 13, MUTED, 2)
    footer(c, page_no)
    c.showPage()


def character_page(c: canvas.Canvas, ch: dict, page_no: int) -> None:
    accent = HexColor(ch["accent"])
    background(c, accent)
    c.setFillColor(accent)
    c.setFont(FONT, 8.5)
    c.drawString(43, 555, ch["role"])
    c.setFillColor(INK)
    c.setFont(FONT, 28 if len(ch["name"]) < 10 else 22)
    c.drawString(41, 514, ch["name"])
    c.setFillColor(MUTED)
    c.setFont(FONT, 10)
    c.drawString(43, 489, ch["full"])
    nx = 43
    nx = draw_chip(c, ch["age"], nx, 449, accent)
    nx = draw_chip(c, f"ID: {ch['id']}", nx, 449, accent)

    panel(c, "CHARACTER CORE", ch["core"], 42, 326, 486, 105, accent, 8.8, 5)
    panel(c, "SHISHA", ch["shisha"], 42, 207, 235, 103, accent, 8.5, 5)
    panel(c, "VOICE", ch["voice"], 42, 78, 235, 113, accent, 8.2, 6)
    panel(c, "STORY ARC / SECRET", ch["story"], 293, 199, 235, 111, accent, 8.2, 6)
    panel(c, "DIRECTION", ch["direction"], 293, 78, 235, 105, accent, 8.2, 5)

    c.setFillColor(Color(accent.red, accent.green, accent.blue, alpha=0.10))
    c.circle(687, 300, 205, fill=1, stroke=0)
    c.setStrokeColor(Color(accent.red, accent.green, accent.blue, alpha=0.32))
    c.setLineWidth(1.2)
    c.circle(687, 300, 184, fill=0, stroke=1)
    if ch.get("art_hold"):
        rounded_panel(c, 558, 116, 248, 372, PANEL)
        c.setStrokeColor(accent)
        c.setLineWidth(1.1)
        c.roundRect(575, 305, 214, 158, 13, fill=0, stroke=1)
        c.setFillColor(accent)
        c.setFont(FONT, 19)
        c.drawCentredString(682, 393, "ART HOLD")
        c.setFillColor(MUTED)
        c.setFont(FONT, 7.2)
        c.drawCentredString(682, 367, "CURRENT ASSET MISMATCH")
        panel(c, "NEXT VISUAL DIRECTION", ch["art_note"], 575, 139, 214, 142, accent, 7.7, 8)
    elif ch.get("image_alt"):
        draw_image_contain(c, rel(ch["image"]), 548, 142, 135, 350)
        draw_image_contain(c, rel(ch["image_alt"]), 681, 142, 135, 350)
        c.setFillColor(MUTED)
        c.setFont(FONT, 6.8)
        c.drawCentredString(615, 127, "Minto / 営業")
        c.drawCentredString(748, 127, "Shiori / 素")
    else:
        draw_image_contain(c, rel(ch["image"]), 550, 78, 265, 450)
        draw_expressions(c, ch, accent)

    c.setFillColor(Color(0.03, 0.03, 0.05, alpha=0.78))
    c.roundRect(550, 505, 263, 50, 10, fill=1, stroke=0)
    draw_text(c, ch["quote"], 562, 536, 239, 7.5, 11.5, INK, 3)
    footer(c, page_no)
    c.showPage()


def pair_page(c: canvas.Canvas, page_no: int) -> None:
    background(c, HexColor("#F0A95C"))
    c.setFillColor(HexColor("#F0A95C"))
    c.setFont(FONT, 9)
    c.drawString(45, 550, "TOURNAMENT / SUPPORTING CAST")
    c.setFillColor(INK)
    c.setFont(FONT, 25)
    c.drawString(43, 510, "大会の声と温度を作る二人")
    for idx, ch in enumerate(PAIR):
        x = 42 + idx * 395
        accent = HexColor(ch["accent"])
        rounded_panel(c, x, 78, 372, 392)
        c.setFillColor(accent)
        c.rect(x, 462, 372, 8, fill=1, stroke=0)
        c.setFont(FONT, 19)
        c.drawString(x + 17, 424, ch["name"])
        c.setFillColor(MUTED)
        c.setFont(FONT, 7.5)
        c.drawString(x + 18, 404, f"{ch['role']} / {ch['age']} / ID: {ch['id']}")
        draw_image_contain(c, rel(ch["image"]), x + 218, 212, 134, 188)
        panel(c, "CORE", ch["body"], x + 15, 263, 191, 123, accent, 8.0, 7)
        panel(c, "SHISHA / VOICE", ch["flavor"] + "\n" + ch["voice"], x + 15, 132, 337, 112, accent, 7.9, 6)
        c.setFillColor(Color(accent.red, accent.green, accent.blue, alpha=0.12))
        c.roundRect(x + 15, 93, 337, 27, 8, fill=1, stroke=0)
        c.setFillColor(INK)
        c.setFont(FONT, 7.2)
        c.drawString(x + 25, 102, ch["quote"])
    footer(c, page_no)
    c.showPage()


def future_page(c: canvas.Canvas, page_no: int, batch: list[tuple], title: str) -> None:
    accent = HexColor("#8E7CFF")
    background(c, accent)
    c.setFillColor(accent)
    c.setFont(FONT, 9)
    c.drawString(45, 550, "APPENDIX / ART PENDING")
    c.setFillColor(INK)
    c.setFont(FONT, 25)
    c.drawString(43, 510, title)
    c.setFillColor(MUTED)
    c.setFont(FONT, 8)
    c.drawString(45, 486, "設定は現行マスタにあるが、主要立ち絵が未収録の人物。ビジュアル制作時は個別に再確認する。")
    for i, (name, meta, style, flavor, hook) in enumerate(batch):
        col, row = i % 2, i // 2
        x = 42 + col * 396
        y = 454 - row * 125 - 107
        rounded_panel(c, x, y, 374, 107)
        c.setFillColor(accent)
        c.setFont(FONT, 11)
        c.drawString(x + 14, y + 81, name)
        c.setFillColor(MUTED)
        c.setFont(FONT, 7.1)
        c.drawString(x + 14, y + 64, meta)
        c.setFillColor(INK)
        c.setFont(FONT, 7.8)
        c.drawString(x + 14, y + 44, f"STYLE  {style}")
        c.drawString(x + 14, y + 28, f"FLAVOR  {flavor}")
        c.setFillColor(MUTED)
        c.setFont(FONT, 7.1)
        c.drawString(x + 14, y + 11, hook)
    footer(c, page_no, "FUTURE CAST / ART PENDING")
    c.showPage()


def final_page(c: canvas.Canvas, page_no: int, commit: str) -> None:
    accent = HexColor("#FF8D76")
    background(c, accent)
    c.setFillColor(accent)
    c.setFont(FONT, 9)
    c.drawString(45, 550, "APPENDIX / SOURCE & HANDOFF")
    c.setFillColor(INK)
    c.setFont(FONT, 25)
    c.drawString(43, 510, "更新するときの参照先")
    refs = [
        ("キャラクターマスタ", "data/characters.json", "ID・年齢・所属・得意味・説明・隠し設定の起点。"),
        ("現行の声", "data/dialogue/*.json", "実際の一人称、間、語尾、呼び名は台詞で確認。"),
        ("確定ルール", "CLAUDE.md", "主人公アーク、旧設定NG、ID、正式名称。"),
        ("詳細設定", "brand/character_profiles.md", "長い背景設定。旧案が残る箇所は現行マスタ優先。"),
        ("立ち絵", "assets/sprites/characters/", "正規の表情差分。外部素材は必ずrepo内へコピーしてから使用。"),
    ]
    y = 448
    for title, path, desc in refs:
        rounded_panel(c, 43, y - 60, 754, 52)
        c.setFillColor(accent)
        c.setFont(FONT, 9.5)
        c.drawString(57, y - 29, title)
        c.setFillColor(INK)
        c.setFont(FONT, 8.2)
        c.drawString(189, y - 29, path)
        c.setFillColor(MUTED)
        c.drawString(428, y - 29, desc)
        y -= 70
    panel(c, "HANDOFF", "このPDFは共同制作用の初版。内容を更新したら、PDFだけを直接編集せず、本生成スクリプトと現行マスタを揃えて再出力する。要確認項目は確定後にCONTINUITYページから外す。", 43, 55, 754, 66, accent, 8.6, 3)
    c.setFillColor(MUTED)
    c.setFont(FONT, 7)
    c.drawString(45, 36, f"Generated from canonical repository commit {commit}")
    footer(c, page_no, "SOURCE & HANDOFF")
    c.showPage()


def build() -> Path:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    TMP.mkdir(parents=True, exist_ok=True)
    register_fonts()
    commit = commit_hash()
    c = canvas.Canvas(str(OUT), pagesize=PAGE, pageCompression=1)
    c.setTitle("水煙前線 -EN:CODE- キャラクター設定資料")
    c.setAuthor("haseatsu114514-dot/shisha-game")
    c.setSubject("共同制作者向けキャラクター設定資料")
    c.setKeywords("水煙前線, EN:CODE, キャラクター, シーシャ")

    page_no = 1
    cover_page(c, page_no, commit)
    page_no += 1
    intro_page(c, page_no)
    page_no += 1
    caution_page(c, page_no)
    page_no += 1
    cast_map_page(c, page_no)
    page_no += 1
    for ch in CHARACTERS:
        c.bookmarkPage(ch["id"])
        c.addOutlineEntry(ch["name"], ch["id"], level=0, closed=False)
        character_page(c, ch, page_no)
        page_no += 1
    pair_page(c, page_no)
    page_no += 1
    future_page(c, page_no, FUTURE[:6], "未立ち絵キャラクター / 世界へ続くライバル")
    page_no += 1
    future_page(c, page_no, FUTURE[6:], "未立ち絵キャラクター / 裏ボス・審査員・拠点")
    page_no += 1
    final_page(c, page_no, commit)
    c.save()
    return OUT


if __name__ == "__main__":
    print(build())
