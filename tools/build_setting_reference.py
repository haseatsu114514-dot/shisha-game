#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""設定資料集ジェネレータ: assets/ の画像と DotGothic16 サブセットを埋め込んだ
docs/setting_reference.html（単一ファイル・共有可）を生成する。

使い方:
    pip install Pillow fonttools brotli
    python3 tools/build_setting_reference.py

キャラ設定や章まとめの本文はこのファイル内のデータ構造を編集する
（正本は data/characters.json / brand/story_and_structure.md / CLAUDE.md。
 食い違いに気づいたら正本を先に確認すること）。
"""
import base64, io, json, os, subprocess, sys, tempfile
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

PORTRAITS = {
    "hajime": "hajime/chr_hajime_normal.png",
    "sumi": "sumi/chr_sumi_normal.png",
    "naru": "naru/chr_naru_normal.png",
    "adam": "adam/chr_adam_normal.png",
    "minto": "minto/chr_minto_normal.png",
    "oneesan": "minto/chr_minto_ura_normal.png",
    "tsumugi": "tsumugi/chr_tsumugi_normal.png",
    "rin": "rin/chr_rin_normal.png",
    "ageha": "ageha/chr_ageha_normal.png",
    "mashiro": "mashiro/chr_mashiro_normal.png",
    "dr_kemuri": "dr_kemuri/chr_dr_kemuri_normal.png",
    "nagumo": "nagumo/chr_nagumo_normal.png",
    "maezono": "maezono/chr_maezono_normal.png",
    "pakki": "pakki/chr_pakki_normal.png",
}

BACKGROUNDS = {
    "bg_title": "backgrounds/bg_title.png",
    "bg_tonari": "backgrounds/bg_tonari_inside_night.png",
    "bg_stage": "backgrounds/bg_tournament_stage.png",
    "bg_cstation": "backgrounds/bg_c_station_day.png",
    "bg_map": "backgrounds/bg_map_local_night.png",
}

CGS = {
    "cg_battle": "cgs/cg_ch1_tournament_battle.png",
    "cg_training": "cgs/cg_ch1_sumi_training.png",
    "cg_tension": "cgs/cg_ch1_tournament_tension.png",
}


def trim_alpha(img):
    if img.mode != "RGBA":
        return img
    bbox = img.getchannel("A").getbbox()
    return img.crop(bbox) if bbox else img


def to_uri(img, lossless_alpha=True, quality=80):
    buf = io.BytesIO()
    img.save(buf, "WEBP", quality=quality, method=6)
    return "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode()




def build_images():
    result = {}
    for key, rel in PORTRAITS.items():
        img = Image.open(os.path.join(ROOT, "assets/sprites/characters", rel)).convert("RGBA")
        img = trim_alpha(img)
        h = 300
        img = img.resize((max(1, round(img.width * h / img.height)), h), Image.LANCZOS)
        result["p_" + key] = to_uri(img, quality=82)
    for group, w, q in ((BACKGROUNDS, 720, 72), (CGS, 640, 74)):
        for key, rel in group.items():
            img = Image.open(os.path.join(ROOT, "assets", rel)).convert("RGB")
            img = img.resize((w, round(img.height * w / img.width)), Image.LANCZOS)
            result[key] = to_uri(img, quality=q)
    return result

IMAGES = build_images()

# ---------------------------------------------------------------- characters
# tags: (章チップ, 役割チップ, 追加チップ...)
CH1_MAIN = [
    dict(id="hajime", img="p_hajime", name="蒸野 始", kana="むしの はじめ", tags=["主人公", "22歳", "tonari"],
         blurb="シーシャバイトの青年。一見感じのいい普通の若者だが、よく見ると「自分の店を持ちたい」という夢は店名や内装しか語れない<em>薄い夢</em>で、tonariの看板に寄りかかる得意げさが垣間見える。テーマは<strong>「素直さ」</strong>＝他人の良さに素直に気づける力。それは嫉妬の種にもなるが、吸収と継承の源でもある。上位大会で勝ち続けた果てに味覚を失い、仲間に見放され、ch3でましろに救われて素直さが本物になる。使う葉はブロンドリーフのみ——「普通の葉で世界一になる」が本作の背骨。"),
    dict(id="sumi", img="p_sumi", name="墨田 丈一郎", kana="スミさん", tags=["師匠", "46歳", "tonari店主"],
         blurb="主人公の師匠であり良き理解者。かつては名の知れたプレイヤーだったが、今は飄々と地元の小さな店を営む。ch1チュートリアルの<em>「技は盗め。ただし、誰から盗んだかは忘れるな」</em>が全編の継承テーマの起点。優勝の夜には採点表を突きつけ、はじめの「実力で勝った」という自己認識を最初から砂上にする役。折れた理由は「負けたから」ではなく<strong>「勝つための煙で客の顔が見えなくなったから」</strong>（ch4で告白）。"),
    dict(id="naru", img="p_naru", name="鳴切 亮太", kana="なる", tags=["ライバル ch1", "23歳", "ケムリクサ"],
         blurb="実力・人格ともに地元最強格の<strong>人格者の好敵手</strong>。理論派だが知識をひけらかさず、口癖は「うまくなりたいなら全部見てけ」。負けると人目もはばからず悔しがるが、相手を称えることを忘れない。ch1敗退後は隣県の地元大会からイチで勝ち直し、ch4のHAZE: GRAND SMOKEではじめと再戦する——ゲーム最大の感動パートの相手。"),
    dict(id="adam", img="p_adam", name="吾妻 大夢", kana="アダム", tags=["ライバル ch1", "28歳", "Eden"],
         blurb="純日本人なのに頑なに「アダム」と名乗る、<strong>ダブルアップル特化</strong>の愛すべき変人。ダブルアップルを宇宙の原点のように語り、ローランド風の名言と過剰な自己演出で周囲を振り回すが、一つの味を掘り下げる技術は本物。ch3のダブルアップル事件、そしてch5のダブルアップル単体勝負（贖罪とリスペクトの回収）まで、実は全編の背骨に関わる。"),
    dict(id="minto", img="p_minto", name="緑川 栞", kana="みんと", tags=["ライバル ch1", "ヒロイン", "自称20歳（実29歳）", "ぺぱーみんと"],
         blurb="コンセプトカフェ「ぺぱーみんと」の人気No.1キャスト。「ばえ」重視に見えて、実は客の心理を計算し尽くした戦略家。真の目的は精肉店に乗っ取られた<em>実家の純喫茶の場所を買い戻す</em>こと。心にこびりついた「血と肉の匂い」の幻臭を、ミントの香りと煙で上書きしたいという強迫観念を抱えている。"),
    dict(id="oneesan", img="p_oneesan", name="お姉さん", kana="みんとの私服・素の姿", tags=["エイリアス", "訪問5回目で正体判明"],
         blurb="私服・素の姿のみんとが客としてtonariに来るときの表示名（speaker: <code>oneesan</code>／立ち絵は minto の <code>ura_*</code>）。はじめのデビュー一台を最初に飲んだ客。研修中の身分証確認で「平成──…ん？」となった記憶が<em>「自称20歳」の嘘の伏線</em>。通常営業では正体を伏せられているが、みんと訪問5回目の私服デート（<code>ch1_minto_fifth</code>）で<em>ch1内でも正体が判明する</em>（正史）。"),
    dict(id="tsumugi", img="p_tsumugi", name="つむぎ", kana="白木 つむぎ", tags=["ヒロイン", "21歳", "tonari常連"],
         blurb="画面にひびの入ったiPadでいつも絵を描いている寡黙な少女。頼むのはラベンダーだけ。煙の色が視える共感覚の持ち主で、優勝の夜に「最後の方だけ、ちょっとだけ──濁ってた」と、はじめの慢心をプレイヤーにだけゾクッと可視化する。"),
    dict(id="rin", img="p_rin", name="匂坂 凛", kana="さぎさか りん", tags=["ヒロイン", "27歳", "Dr.fookah 2階"],
         blurb="問屋街の卸直営店『Dr.fookah』2階で海外メーカーNIGHTSIDEの日本代理店デスクを仕切る<strong>「問屋街の魔女」</strong>。はじめを未発売サンプルの「試香モルモットくん」として雇う。危険な香りはするがグレーの線引きは正確で、サンプルは必ず自分が先に吸う筋の通った大人。最初から大人であることを一切隠さない年上枠。"),
]
CH1_JUDGES = [
    dict(id="nagumo", img="p_nagumo", name="南雲 修二", kana="なぐも しゅうじ", tags=["審査員長", "45歳", "シーステーション会長"],
         blurb="大手チェーン「シーステーション」会長。自社は「ファミレスのような手軽さ」と割り切る一方、大会では<strong>「作り手の生き様が煙ににじみ出ているか」</strong>を最重要基準にする二面性の人。持ち点10は最後まで温存し、「もう一口吸いたい一台」にだけ一括投入する流儀——ch1の逆転優勝はこの制度の上に成立する。優勝後の「……懐かしい味だ」はch4のスミさん告白まで引っ張る縦糸。"),
    dict(id="maezono", img="p_maezono", name="前園 壮一郎", kana="まえぞの そういちろう", tags=["審査員", "39歳", "HOOKAH PRESS編集長"],
         blurb="口癖は<em>「シーシャはおいしいねえ」</em>。どんな一杯も本当に美味しそうに吸うため、出場者全員が彼に吸ってもらいたがる。日本最大のシーシャ情報サイト「HOOKAH PRESS」編集長で影響力は絶大。持ち点はわりと早入れ派。"),
    dict(id="pakki", img="p_pakki", name="パッキー", kana="大会MC兼マスコット", tags=["MC", "年齢不詳"],
         blurb="実況・進行を一手に担う名物MC。常にハイテンションで喋り倒すが、本当に美味いシーシャが出た時だけ沈黙し、<em>煙が虹色になる</em>という伝説を持つ。笑い声は「ぷぷぷっ！」。"),
]
CH1_CAMEO = [
    dict(id="ageha_cameo", img=None, name="謎のギャル", kana="＝アゲハ（ch2ライバル）", tags=["カメオ DAY4夜"],
         blurb="買い出し帰りに荷物をぶちまけたはじめを助けてくれる通りすがりのギャル。残り香は「ホワイトグミベア」。ch2初対面で匂いから繋がり、「ハジメっち」と命名する。"),
    dict(id="rei_cameo", img=None, name="V系の客", kana="＝零-REI-（田中健太）", tags=["カメオ バイト2回目"],
         blurb="正体を伏せて一度だけ来店。「一台。重くて、暗いやつ。──夜の底みたいな」→30分無言→「炎の歌が、よく聴こえる一台だった」。帰り際だけ素の声で「ごちそうさまでした」。ペルソナと素のギャップを先に体験させる仕込み。"),
    dict(id="kemuri_cameo", img=None, name="白衣の男", kana="＝チャコール博士", tags=["カメオ 表彰式前"],
         blurb="観客席の隅でノートPCに何かを打ち込み、目が合う寸前に消える。優勝の夜、未知の送信者「？？？」から「本日のあなたの試合データは、すべて記録させていただきました。」の通知——ch5まで効く不穏な引き。"),
    dict(id="salaryman", img=None, name="サラリーマン", kana="tonari常連", tags=["ストーリー専用", "41歳"],
         blurb="感情を全く顔に出さない手強い客。本当に上手い一台を出すと心が動く、はじめの成長を測る指標。ラストシーンで新人を絶賛する役どころまで持つ象徴的キャラ。"),
    dict(id="kako", img=None, name="かこ", kana="tonari常連（ちょい役）", tags=["シークレット常連", "26歳"],
         blurb="フリーランスデザイナーでオタク気質。姫カット黒髪ロング。裏好感度MAX（3回遭遇）で世界大会にギャラリーとして応援に来る。"),
    dict(id="rira", img=None, name="りら", kana="tonari常連（ちょい役）", tags=["シークレット常連", "28歳"],
         blurb="童顔×ライダースの少し男勝りなお姉さん。4歳下の彼氏の愚痴をこぼしていく。かこ同様、裏好感度MAXで応援に来てくれる。"),
]
CH2_CHARS = [
    dict(id="ageha", img="p_ageha", name="宵野 葉子", kana="アゲハ", tags=["ライバル ch2", "ヒロイン", "22歳", "読者モデル"],
         blurb="平成ギャルマインド——「カワイイは最強」「バイブスで全部OK」「人に優しく、自分にもゆるく」。理論ゼロ、<strong>バイブスだけで最高の一杯を作る天才肌</strong>。だが体は丈夫でなく、朝起きるたび「今日、感覚あるかな…」と確かめるのが習慣。この秘密は主人公だけが知る。ch2スランプのはじめの回復の糸口にもなる。香りはホワイトグミベア。"),
    dict(id="kumicho", img=None, name="神崎 竜二", kana="シーシャ組長", tags=["ライバル ch2", "39歳", "神崎煙草店"],
         blurb="非常に丁寧な接客で知られる店主。正体はヤクザの組長（シノギで店を営んでいることは隠している）。プレイスタイルは「スジを通す煙」。交友を深めると<strong>蒸らし0分（吸いながら立ち上げる高等テク）</strong>が解放される。<br>※立ち絵は未実装（旧画像は設定不一致のため廃止済み・2026-07-05）。新規作成時は chr_kumicho_* で追加。"),
    dict(id="rei", img=None, name="田中 健太", kana="零-REI-", tags=["ライバル ch2-3", "25歳", "零-ZERO-店長"],
         blurb="V系コンセプトカフェ「零-ZERO-」店長。全身の刺青と非対称カラーリング、ステージに立つだけで空気が変わるカリスマ。ミックス名はすべてV系バンドへのオマージュ（「嘘の薔薇」「CASSIS MEMORIAL」等）。フローラルを極限まで重ね、煙をパフォーマンスに変える。ch3ではなるを僅差で降す。"),
    dict(id="dr_kemuri", img="p_dr_kemuri", name="炭場 創", kana="チャコール博士", tags=["ライバル ch2", "審査員兼研究者", "ch5仕掛け人", "38歳"],
         blurb="ヒートマネジメント機材を数々開発した研究者。温和で紳士的だが「業界の発展のためなら人体実験まがいも厭わない」という噂が囁かれる危うい二面性。実は<strong>味覚を失った元職人</strong>（はじめの味覚喪失の鏡像）。ch5でSHISHA-9000戦を仕掛け、敗北後、十数年ぶりに自分の舌で一台を作って「賭けて差し出す煙」を取り戻す。"),
]
CH3_CHARS = [
    dict(id="mashiro", img="p_mashiro", name="水瀬 ましろ", kana="ましろ", tags=["ヒロイン ch3", "22歳", "mukai", "シガーマン"],
         blurb="東京の溜まり場「mukai」の同僚。一人称は「僕」、いつも眠たげで浮世離れ。想いの乗った煙だけを鮮明に感じ取れる心の持ち主で、彼女の「美味しい」は<strong>「その人の魂が煙に宿っているか」</strong>で決まる。巷で噂の凄腕職人<em>「シガーマン」の正体</em>だが、本人はシガーマンを怖いいかつい男だと思って怯えている（アンジャッシュ状態）。味覚を失ったはじめをch3で救う存在。はじめの呼び方は「ましろちゃん」で統一。"),
    dict(id="nandi", img=None, name="ナンディ・カルダモン", kana="Prana Dhūm 代表", tags=["ライバル ch3", "31歳"],
         blurb="東京のインド流伝統店の代表。本場中東・南アジアのクラシックスタイルを重んじ、スパイスとハーブを巧みに操る。「伝統的なスパイスと生命の煙」。"),
    dict(id="steve", img=None, name="スティーブ・デイビス", kana="Smoke & Glory", tags=["ライバル ch3", "30歳"],
         blurb="ピザを愛す巨漢だが、作りは異常なまでに繊細。クセの強いアメリカ産フレーバーを極めて低い温度帯でじっくり育てる達人。"),
    dict(id="volk", img=None, name="ヴォルク・イヴァノフ", kana="Железный Дым", tags=["ライバル ch3", "37歳", "ロシア"],
         blurb="データと徹底した温度管理システムによる「ブレない完璧な提供」。機械のように精密なシーシャを作る——ch5のSHISHA-9000を予感させる人間側の精度番長。"),
    dict(id="mukai_master", img=None, name="ムカイさん", kana="向井", tags=["ch3 溜まり場", "48歳", "mukai店長"],
         blurb="tonari姉妹店「mukai」の店長。次元大輔ルックスの超絶渋いダンディ。周囲からシガーマンと勘違いされているが、実はシガーは得意ではない。"),
    dict(id="tetsuko", img=None, name="テツコ", kana="mukai裏口の猫", tags=["猫"],
         blurb="mukaiの裏口で飼われている茶色のハチワレ猫（スコティッシュフォールド）。"),
]
CH4_CHARS = [
    dict(id="sheikh", img=None, name="シェイク・アル=ガリヤーン", kana="ドバイの絶対王者", tags=["ライバル ch4", "52歳", "王族"],
         blurb="世界大会決勝の相手。純金の特別機材を持つ王族だが、原体験は15年前に路地裏のカフェで吸った<em>「ある日本人」＝若きスミさんの煙</em>。あの本物をもう一度超えるためだけに戦い続けている。大会前には「謎のおじさん」に変装してはじめと3回接触する。"),
    dict(id="master_hookah", img=None, name="王 煙楼", kana="マスター・フーカ", tags=["ラスボス ch4", "58歳"],
         blurb="「お前の煙には『命』がある」と語る仙人のような職人。吐いた煙で龍を形作る伝説の技。陰陽五行の理に通じ、その人の体質・精神状態にぴったり合う一台を漢方のように調合する。"),
    dict(id="da_silva", img=None, name="ダ・シルヴァ太陽", kana="エンリケ・ダ・シルヴァ・太陽", tags=["ゲスト審査員 ch4", "28歳"],
         blurb="「シーシャはフェスタ！楽しくなけりゃ意味がねぇ！」。派手なパフォーマンスで場を盛り上げ、はじめに純粋な楽しさを思い出させる。「大会で会おう」の約束どおり、審査員席から再会する。"),
]
CH5_CHARS = [
    dict(id="shisha_9000", img=None, name="SHISHA-9000", kana="究極のAIシーシャマシン", tags=["隠しボス ch5", "SMOKE LAB"],
         blurb="チャコール博士が数百万の配合データと環境センサーで開発した到達点。技術・最適化でははじめを上回り、「目の前の人に合わせる」ことすらできる。それでも勝てなかった理由が本作の答え——<strong>9000の煙は過去の何万人のエンコードの平均であり、誰の生き方でもなく、宛先がなく、何も賭けていない</strong>。戦後は破壊されず、名職人の煙を学ぶ教材として稼働を続ける。"),
]
JUDGES_MISC = [
    dict(id="emil", img=None, name="エミル", kana="元トプハーネ地区ナルギレ職人", tags=["審査員", "48歳", "トルコ"],
         blurb="伝統と歴史に根ざした深みを誰よりも理解し、「新しいだけでは本物ではない」という信念で人の煙を見極める。かつて出会った放浪の日本人（スミさん）の煙が審査員を目指したきっかけとも噂される。感動するとトルコ語でぽつりとつぶやく。"),
]

HEROINES = [
    ("つむぎ", "tonari常連の絵描き。ラベンダー一筋・共感覚", "彼女なら来る"),
    ("ましろ", "ch3 mukaiの同僚。シガーマンの正体", "友達でも来る（唯一）"),
    ("みんと", "ぺぱーみんとNo.1。私服は「お姉さん」", "彼女なら来る"),
    ("アゲハ", "バイブスの天才ギャル。体の秘密を共有", "彼女なら来る"),
    ("凛", "問屋街の魔女。年上枠", "彼女なら来る（品質管理名目）"),
]

CHAPTERS = [
    dict(no="第1章", title="一吸目（ファーストドロー）", cup="SMOKE CROWN CUP", reg="ミント2g以上",
         theme="僕には何もない", img="cg_training",
         imgcap="CG: スミさんの特訓（cg_ch1_sumi_training）",
         body="""ゲームは開幕30秒、ch4ドバイ決勝の歓声と煙だけのコールドオープンから「──1年前。」でtonariの日常へ巻き戻る。バイト青年はじめは、スミさんの「お前の煙は優しい。それだけでいい」の一言でよく分からないまま地元大会へ。なる・アダム・みんととの出会いで井の中の蛙を自覚しつつ、私服のみんと（お姉さん）にデビュー一台を出し、つむぎや凛と関係を築いていく。<br><br>決勝は一台の出来（craft）が基準を超えたときだけ、最後まで持ち点を温存していた南雲の10点一括投入で<strong>最終発表の大逆転優勝</strong>。だが優勝の夜、スミさんのLIMEが採点表を突きつける——「技術点も個性点も、お前は4人の中で下位だ」「お前を勝たせたのは、南雲さんの総合印象点ひとつ」。<em>ch1の優勝は実力ではない</em>。祝杯の一台が「馬鹿みたいにうまい」「いままでで一番濃い」夜——味覚を失う直前が、人生で一番味が濃い夜。""",
         points=["伏線: 白衣の男／「？？？」の通知／つむぎ「濁ってた」／南雲「懐かしい味だ」／シガーマンの都市伝説／なるの「店の匂い」問答",
                 "カメオ: 謎のギャル（アゲハ）・V系の客（零-REI-）",
                 "優勝インタビューの選択肢でプレイヤー自身に慢心を選ばせて共犯にする"]),
    dict(no="第2章", title="才能の壁（ジェラシー・ヘイズ）", cup="HAZE: OPEN CLOUD（県大会）", reg="ストロベリー指定（県特産・高難度）",
         theme="才能への嫉妬とデータの壁", img="bg_stage",
         imgcap="背景: 大会ステージ（bg_tournament_stage）",
         body="""アゲハの圧倒的な「バイブス」、強豪たちの才能。はじめは「自分にないもの」を妬む醜い感情に呑まれ、素直さを失っていく。天狗と嫉妬の果てに<strong>味覚スランプ</strong>が始まり、自分の煙が分からなくなる——輪郭の見えにくいストロベリー指定は、スランプ進行中のはじめに最も残酷な課題（ミックス画面の味見情報にノイズが混じる等、メカニクスで体感させる）。<br><br>バイト中の崩壊、なるの正面からの苦言、アゲハとの交流による回復の糸口。大会は勝ち上がるが、仲間は一人ずつ離れていき（テイルズオブジアビス型）、たどり着くのは<strong>「誰もいない優勝」</strong>。「誰の顔も、浮かばなかった」——味覚は戻らないまま、東京へ。""",
         points=["審査で出来が良くても「お客さんの顔が頭に残らない」——全編の縦糸「顔」の中継点",
                 "スミさんのLIME「誰のために作ってる？」",
                 "ライバル: アゲハ／シーシャ組長／零-REI-／チャコール博士"]),
    dict(no="第3章", title="虚ろな王冠（ホロウ・クラウン）", cup="HAZE: NATIONAL TOKYO（全国大会）", reg="自由（ましろと作戦会議3択）",
         theme="世界を知り、自分を広げる", img="bg_tonari",
         imgcap="背景: tonari店内・夜（bg_tonari_inside_night）",
         body="""東京。看板が通用しない街で、溜まり場になるのはtonari姉妹店「mukai」——そこで出会う同僚ましろは、想いの乗った煙だけを感じ取れる少女で、味覚を失ったはじめの唯一の救いになる。毎日の一杯で<strong>舌の地図を引き直す</strong>回復パートと、本作ハイライトの<strong>ダブルアップル事件</strong>（テイルズオマージュ）がこの章の心臓。<br><br>ナンディ・スティーブ・ヴォルク・零-REI-ら全国級と戦い、なるは別ブロックでレイに僅差敗退。はじめは勝ち上がり優勝するが、手にしたのは空虚な王冠。大会後の気づき、帰ってきたtonari、後輩、酸っぱい顔の客、なるからの連絡——「空っぽは弱さじゃない」へ着地する。""",
         points=["恋愛ルートは全ヒロインともch3までに着地（付き合う／友達のまま）",
                 "ダブルアップル事件の贖罪は本章ではなくch5で回収する設計",
                 "ましろが3章の師匠枠（作戦会議: 客層読み／会場環境対策／対戦相手対策）"]),
    dict(no="第4章", title="継承の煙（レガシー・スモーク）", cup="HAZE: GRAND SMOKE（世界大会・ドバイ）", reg="自由＋日本アピール（和風一本・ダブルアップル要素なし）",
         theme="全部背負って、最後に出す一台", img="cg_battle",
         imgcap="CG: 大会の激突（cg_ch1_tournament_battle）",
         body="""スミさんとの特訓を経てドバイへ。前夜にはヒロインたちが応援に駆けつける（登場条件は下の表）。現地では「謎のおじさん」（変装したシェイク）との強制イベント×3、太陽の店「FESTA」のミスディレクションを挟み、大会当日にすべての正体が明かされる。<br><br>決勝は4人一斉（はじめ・なる・王煙楼・シェイク）。転-1は<strong>はじめ vs なる</strong>——イチから勝ち直してきた男との、ゲーム最大の感動パート。転-2はアジアの壁・王煙楼、転-3は絶対王者シェイクとの最終対決。はじめは<strong>和素材×tonariの日常の丁寧さの一台</strong>で世界一に。帰国後、スミさんが告白する: 15年前ドバイでシェイクを感動させた日本人は自分であり、折れた理由は「勝つための煙で、客の顔が見えなくなったから」——はじめのch2の鏡像。""",
         points=["南雲の「懐かしい味だ」・エミルの噂・シェイクの原体験、すべての縦糸がスミさんに収束する",
                 "打ち上げ（交際2人以上なら修羅場イベント）／スミさんとの最後の一杯",
                 "決勝4人: なる・王煙楼（マスター・フーカ）・シェイク、ゲスト審査員: ダ・シルヴァ太陽（旧チャドと統合済み）"]),
    dict(no="第5章", title="機械仕掛けの神（Deus Ex Machina）", cup="SHISHA-9000戦（SMOKE LAB・真の最終章）", reg="ダブルアップル単体・配合自由度ゼロ",
         theme="AIにシーシャは代替されるのか — EN:CODE回収", img="bg_cstation",
         imgcap="背景: C.STATION（bg_c_station_day）",
         body="""世界王者となったはじめの前に、審査員チャコール博士が究極のAI「SHISHA-9000」を携えて再登場（章タイトルは演出上の残置で「煙の向こう側」表記）。9000は完璧で、環境センサーで「目の前の人に合わせる」ことすらできる——「合わせる」では勝てない。最後の一台は<strong>賭け</strong>。課題はダブルアップル単体、配合自由度ゼロの純粋技術勝負であり、ch3事件の贖罪とアダムへのリスペクトの最終回収でもある。<br><br>採点UIは出ない。勝敗は観客の<strong>「もう一回吸いたいのはどっち」の挙手</strong>。ここでタイトルが回収される——煙を作る＝生き方のエンコード、吸う＝デコード。AIの煙は誰もエンコードしていないコード、宛先のない煙。9000は破壊されず教材として残り、博士は十数年ぶりに自分の舌で一台を作る。<br><br>ラストはtonariの変わらない日常。常連のサラリーマンが、はじめを抜き去る新人を絶賛する。はじめは完敗だと笑う。<em>「人の好みはそれぞれ。だからシーシャは面白い」</em>。""",
         points=["「-EN:CODE-」の意味はここまで作中で一切説明しない（大会ロゴ等の意匠のみ）",
                 "エンディングはヒロイン好感度に応じた個別エンド or 修羅場エンドへ分岐",
                 "隠しボス戦であり、チャコール博士の再生の物語でもある"]),
]

MESSAGES = [
    ("Ch1", "なんとなく始めた", "始まりは「なんとなく」でいい。毎日の積み重ねには価値がある"),
    ("Ch2", "才能の壁", "他人の武器を「ずるい」と思ったとき、素直さを失う。妬みは煙に出る。でも取り戻せる"),
    ("Ch3", "空っぽな自分", "技術が上がっても「自分のスタイル」が見つからないのは普通。空っぽは弱さじゃない"),
    ("Ch4", "継承の煙", "素直にリスペクトし続けた先に「あなたの煙が好き」と言ってくれる人がいる。世界の頂点で出すのは、自分の国と日常の煙"),
    ("Ch5", "EN:CODE", "煙は生き方のエンコード。レシピはコピーできても、賭けて差し出す一台はコピーできない"),
]

DUBAI_TABLE = [
    ("つむぎ", "来ない", "来る（あなたのために）"),
    ("アゲハ", "来ない", "来る（あなたのために）"),
    ("みんと", "来ない", "来る（あなたのために）"),
    ("ましろ", "来る（ch3クリアで無条件）", "来る（大事な人だから）"),
    ("凛", "来ない（本国出張と被る）", "来る（「最重要サンプルの品質管理」名目）"),
]

CANON_ROWS = [
    ("キャラのID・本名・年齢・ステータス", "data/characters.json"),
    ("大会名・章レギュレーション・ステータス名", "CLAUDE.md（リポジトリ直下）"),
    ("章ごとのプロット", "brand/story_and_structure.md"),
    ("台詞", "data/dialogue/*.json（web/js/data.js は生成物・直接編集禁止）"),
    ("キャラ設定の読み物", "brand/character_profiles.md（数値・年齢は書かない）"),
]
CANON_NOTES = [
    "旧タイトル「煙の向こう側」は不使用 → 正式タイトルは<strong>「水煙前線 -EN:CODE-」</strong>、第5章の章題は「機械仕掛けの神（Deus Ex Machina）」（2026-07-18確定）。",
    "<code>brand/brand</code>・<code>brand/chapter1（character）</code> は旧設定の残骸。参照・引用しない（旧名「ドクター・ケムリ」等）。",
    "旧審査員 <strong>DJ SMOKE・白峰恒一郎・霧島レン</strong> は廃止済み（2026-07-05・オーナー指定）。データ・台詞に再登場させない。",
    "神崎竜二の立ち絵は<strong>未実装</strong>（旧ネオンバー画像は設定不一致のため廃止）。新規作成時は <code>chr_kumicho_*</code> で追加する。",
    "Godot版は削除済み（2026-06-15）。web/ ＋ data/*.json ＋ brand/ が唯一の正史。",
]

# ---------------------------------------------------------------- rendering
def esc_attr(s):
    return s.replace('"', "&quot;")

def chips(tags):
    return "".join(f'<span class="chip">{t}</span>' for t in tags)

def card(c):
    if c.get("img") and c["img"] in IMAGES:
        fig = f'<div class="port"><img src="{IMAGES[c["img"]]}" alt="{esc_attr(c["name"])} 立ち絵" loading="lazy"></div>'
    else:
        initial = c["name"][0]
        fig = f'<div class="port noart"><span class="noart-mark">{initial}</span><span class="noart-note">立ち絵<br>未実装</span></div>'
    return f'''<article class="card" id="c-{c["id"]}">
  {fig}
  <div class="card-body">
    <h4 class="disp">{c["name"]}</h4>
    <p class="kana">{c["kana"]}</p>
    <p class="chips">{chips(c["tags"])}</p>
    <p class="blurb">{c["blurb"]}</p>
  </div>
</article>'''

def cards(lst):
    return '<div class="cards">' + "\n".join(card(c) for c in lst) + "</div>"

def chapter_block(ch, i):
    img = ""
    if ch.get("img") and ch["img"] in IMAGES:
        img = f'<figure class="ch-fig"><img src="{IMAGES[ch["img"]]}" alt="{esc_attr(ch["imgcap"])}" loading="lazy"><figcaption>{ch["imgcap"]}</figcaption></figure>'
    pts = "".join(f"<li>{p}</li>" for p in ch["points"])
    return f'''<section class="chapter">
  <header class="ch-head">
    <span class="ch-no disp">{ch["no"]}</span>
    <div>
      <h3 class="disp">{ch["title"]}</h3>
      <p class="ch-meta"><span class="cup">🏆 {ch["cup"]}</span><span class="reg">課題: {ch["reg"]}</span></p>
      <p class="ch-theme">テーマ「{ch["theme"]}」</p>
    </div>
  </header>
  <div class="ch-grid">
    <div class="ch-text"><p>{ch["body"]}</p>
      <ul class="pts">{pts}</ul>
    </div>
    {img}
  </div>
</section>'''

heroine_rows = "".join(
    f"<tr><td><strong>{n}</strong></td><td>{d}</td><td>{c}</td></tr>" for n, d, c in HEROINES)
dubai_rows = "".join(
    f"<tr><td><strong>{n}</strong></td><td>{f}</td><td>{g}</td></tr>" for n, f, g in DUBAI_TABLE)
msg_rows = "".join(
    f"<tr><td class='mono'>{c}</td><td>{t}</td><td>{m}</td></tr>" for c, t, m in MESSAGES)
canon_rows = "".join(
    f"<tr><td>{k}</td><td><code>{v}</code></td></tr>" for k, v in CANON_ROWS)
canon_notes = "".join(f"<li>{n}</li>" for n in CANON_NOTES)
chapters_html = "\n".join(chapter_block(ch, i) for i, ch in enumerate(CHAPTERS))

# ---------------------------------------------------------------- font subset
def subset_font():
    display_text = set()
    for s in ["水煙前線 -EN:CODE- 設定資料集 第123450章 一吸目ファーストドロー 才能の壁ジェラシー・ヘイズ 虚ろな王冠ホロウ・クラウン 継承の煙レガシー・スモーク 機械仕掛けの神 Deus Ex Machina このゲームについて のキャラクター 全図鑑 ストーリー（全5章） 世界観と文化ルール 正本ガイド ヒロインと恋愛システム 審査員・MC 大会システム 開発用・全編ネタバレあり"]:
        display_text.update(s)
    for group in (CH1_MAIN, CH1_JUDGES, CH1_CAMEO, CH2_CHARS, CH3_CHARS, CH4_CHARS, CH5_CHARS, JUDGES_MISC):
        for c in group:
            display_text.update(c["name"])
    import string
    display_text.update(string.printable)
    display_text.update("ぁあぃいぅうぇえぉおかがきぎくぐけげこごさざしじすずせぜそぞただちぢっつづてでとどなにぬねのはばぱひびぴふぶぷへべぺほぼぽまみむめもゃやゅゆょよらりるれろゎわゐゑをんゔ")
    display_text.update("ァアィイゥウェエォオカガキギクグケゲコゴサザシジスズセゼソゾタダチヂッツヅテデトドナニヌネノハバパヒビピフブプヘベペホボポマミムメモャヤュユョヨラリルレロヮワヰヱヲンヴーヵヶ")
    display_text.update("★☆♪　、。・「」『』（）！？──…〜～：；０１２３４５６７８９")
    txt = "".join(sorted(ch for ch in display_text if ch.strip() or ch == " "))
    tf = os.path.join(tempfile.gettempdir(), "encode_subset_text.txt")
    open(tf, "w").write(txt)
    out = os.path.join(tempfile.gettempdir(), "encode_dot_subset.woff2")
    subprocess.run([sys.executable, "-m", "fontTools.subset",
                    os.path.join(ROOT, "assets/fonts/DotGothic16-Regular.ttf"),
                    f"--text-file={tf}", "--flavor=woff2", f"--output-file={out}",
                    "--layout-features=*", "--no-hinting"], check=True)
    b64 = base64.b64encode(open(out, "rb").read()).decode()
    print("font subset KB:", len(b64) // 1024)
    return "data:font/woff2;base64," + b64

FONT_URI = subset_font()

# ---------------------------------------------------------------- template
HTML = f'''<title>水煙前線 -EN:CODE- 設定資料集</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
@font-face {{
  font-family: "DotGothic16";
  src: url("{FONT_URI}") format("woff2");
  font-display: swap;
}}
:root {{
  --bg: #14181d;
  --bg2: #191f26;
  --surface: #1d242c;
  --surface2: #232b34;
  --ink: #e9e5da;
  --muted: #98a1a9;
  --faint: #6b747d;
  --accent: #e8873a;
  --accent-soft: rgba(232,135,58,.14);
  --mint: #6fd0a8;
  --mint-soft: rgba(111,208,168,.13);
  --line: #2b333d;
  --card-shadow: 0 6px 24px rgba(0,0,0,.35);
  --port-glow: radial-gradient(ellipse 70% 55% at 50% 78%, rgba(232,135,58,.20), rgba(111,208,168,.05) 60%, transparent 75%);
}}
@media (prefers-color-scheme: light) {{
  :root {{
    --bg: #f2eee6; --bg2: #ece7dc; --surface: #faf8f2; --surface2: #f1ede3;
    --ink: #292319; --muted: #6e675a; --faint: #98917f;
    --accent: #c25e17; --accent-soft: rgba(194,94,23,.10);
    --mint: #1f8a63; --mint-soft: rgba(31,138,99,.10);
    --line: #ddd5c6; --card-shadow: 0 4px 16px rgba(90,70,40,.10);
    --port-glow: radial-gradient(ellipse 70% 55% at 50% 78%, rgba(194,94,23,.14), rgba(31,138,99,.05) 60%, transparent 75%);
  }}
}}
:root[data-theme="light"] {{
  --bg: #f2eee6; --bg2: #ece7dc; --surface: #faf8f2; --surface2: #f1ede3;
  --ink: #292319; --muted: #6e675a; --faint: #98917f;
  --accent: #c25e17; --accent-soft: rgba(194,94,23,.10);
  --mint: #1f8a63; --mint-soft: rgba(31,138,99,.10);
  --line: #ddd5c6; --card-shadow: 0 4px 16px rgba(90,70,40,.10);
  --port-glow: radial-gradient(ellipse 70% 55% at 50% 78%, rgba(194,94,23,.14), rgba(31,138,99,.05) 60%, transparent 75%);
}}
:root[data-theme="dark"] {{
  --bg: #14181d; --bg2: #191f26; --surface: #1d242c; --surface2: #232b34;
  --ink: #e9e5da; --muted: #98a1a9; --faint: #6b747d;
  --accent: #e8873a; --accent-soft: rgba(232,135,58,.14);
  --mint: #6fd0a8; --mint-soft: rgba(111,208,168,.13);
  --line: #2b333d; --card-shadow: 0 6px 24px rgba(0,0,0,.35);
  --port-glow: radial-gradient(ellipse 70% 55% at 50% 78%, rgba(232,135,58,.20), rgba(111,208,168,.05) 60%, transparent 75%);
}}
* {{ box-sizing: border-box; }}
html {{ scroll-behavior: smooth; }}
@media (prefers-reduced-motion: reduce) {{ html {{ scroll-behavior: auto; }} }}
body {{
  margin: 0; background: var(--bg); color: var(--ink);
  font-family: "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Yu Gothic", "Meiryo", sans-serif;
  line-height: 1.85; font-size: 15.5px;
}}
.disp {{ font-family: "DotGothic16", "Hiragino Kaku Gothic ProN", sans-serif; font-weight: 400; letter-spacing: .04em; }}
a {{ color: var(--accent); text-decoration: none; }}
a:hover, a:focus-visible {{ text-decoration: underline; }}
a:focus-visible {{ outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 2px; }}
code {{ background: var(--surface2); border: 1px solid var(--line); border-radius: 4px; padding: 0 .35em; font-size: .85em; }}
em {{ font-style: normal; color: var(--mint); }}
strong {{ color: var(--accent); font-weight: 700; }}
.wrap {{ max-width: 1000px; margin: 0 auto; padding: 0 20px; }}

/* ---- nav ---- */
nav {{
  position: sticky; top: 0; z-index: 20;
  background: color-mix(in srgb, var(--bg) 88%, transparent);
  backdrop-filter: blur(8px); border-bottom: 1px solid var(--line);
}}
nav .wrap {{ display: flex; gap: 4px 18px; align-items: center; overflow-x: auto; padding: 10px 20px; white-space: nowrap; }}
nav .brand {{ color: var(--accent); font-size: 13px; margin-right: 8px; }}
nav a {{ color: var(--muted); font-size: 13px; }}
nav a:hover {{ color: var(--ink); text-decoration: none; }}

/* ---- hero ---- */
header.hero {{
  position: relative; overflow: hidden;
  background: linear-gradient(rgba(10,13,17,.55), rgba(10,13,17,.82)), url("{IMAGES["bg_title"]}") center/cover;
  color: #ece8dd; text-align: center; padding: 84px 20px 72px;
}}
.hero .eyebrow {{ font-size: 13px; letter-spacing: .35em; color: var(--mint); margin: 0 0 14px; }}
.hero h1 {{ font-size: clamp(30px, 6vw, 56px); margin: 0 0 6px; text-wrap: balance; text-shadow: 0 0 24px rgba(232,135,58,.35); }}
.hero .sub {{ font-size: clamp(17px, 2.6vw, 22px); color: var(--accent); margin: 0 0 22px; }}
.hero p.lead {{ max-width: 620px; margin: 0 auto; color: #c8c4b8; font-size: 14.5px; }}
.hero .warn {{ display: inline-block; margin-top: 26px; font-size: 12px; letter-spacing: .12em; color: #f0b184; border: 1px solid rgba(232,135,58,.5); border-radius: 999px; padding: 5px 16px; background: rgba(0,0,0,.3); }}

/* ---- sections ---- */
section.block {{ padding: 56px 0 12px; }}
h2.sec {{ font-size: clamp(21px, 3.4vw, 28px); margin: 0 0 6px; text-wrap: balance; }}
h2.sec::before {{ content: "◆ "; color: var(--accent); }}
p.sec-note {{ color: var(--muted); margin: 0 0 26px; font-size: 14px; max-width: 68ch; }}
h3.grp {{ font-size: 15px; letter-spacing: .18em; color: var(--mint); margin: 34px 0 14px; text-transform: uppercase; }}
h3.grp::before {{ content: "— "; color: var(--faint); }}

/* ---- fact grid ---- */
.facts {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 14px; margin: 22px 0; }}
.fact {{ background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 16px 18px; }}
.fact h4 {{ margin: 0 0 6px; font-size: 13px; letter-spacing: .1em; color: var(--accent); }}
.fact p {{ margin: 0; font-size: 13.5px; color: var(--muted); }}
.fact p strong {{ color: var(--ink); }}
.stars {{ color: var(--accent); letter-spacing: .1em; }}

/* ---- character cards ---- */
.cards {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }}
.card {{
  display: flex; gap: 14px; background: var(--surface); border: 1px solid var(--line);
  border-radius: 12px; padding: 16px; box-shadow: var(--card-shadow);
}}
.port {{
  flex: 0 0 96px; height: 150px; border-radius: 8px; overflow: hidden;
  background: var(--surface2); background-image: var(--port-glow);
  display: flex; align-items: flex-end; justify-content: center; align-self: flex-start;
  border: 1px solid var(--line);
}}
.port img {{ max-width: 100%; max-height: 100%; object-fit: contain; object-position: bottom; display: block; }}
.port.noart {{ align-items: center; flex-direction: column; justify-content: center; gap: 6px; }}
.noart-mark {{ font-size: 34px; color: var(--faint); font-family: "DotGothic16", sans-serif; }}
.noart-note {{ font-size: 10px; color: var(--faint); text-align: center; line-height: 1.5; letter-spacing: .08em; }}
.card-body {{ min-width: 0; }}
.card h4 {{ margin: 0; font-size: 17px; }}
.kana {{ margin: 1px 0 7px; font-size: 12px; color: var(--muted); }}
.chips {{ margin: 0 0 8px; display: flex; flex-wrap: wrap; gap: 5px; }}
.chip {{
  font-size: 11px; padding: 1.5px 9px; border-radius: 999px;
  background: var(--mint-soft); color: var(--mint); border: 1px solid color-mix(in srgb, var(--mint) 35%, transparent);
}}
.chip:first-child {{ background: var(--accent-soft); color: var(--accent); border-color: color-mix(in srgb, var(--accent) 40%, transparent); }}
.blurb {{ margin: 0; font-size: 13px; color: var(--muted); line-height: 1.8; }}
.blurb strong {{ color: var(--ink); }}

/* ---- chapters ---- */
.chapter {{ background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 26px 26px 20px; margin: 0 0 22px; box-shadow: var(--card-shadow); }}
.ch-head {{ display: flex; gap: 18px; align-items: flex-start; margin-bottom: 14px; }}
.ch-no {{
  flex: 0 0 auto; font-size: 15px; color: var(--accent); border: 1px solid color-mix(in srgb, var(--accent) 50%, transparent);
  border-radius: 8px; padding: 6px 12px; background: var(--accent-soft); margin-top: 3px; white-space: nowrap;
}}
.ch-head h3 {{ margin: 0 0 4px; font-size: clamp(18px, 3vw, 23px); }}
.ch-meta {{ margin: 0 0 2px; display: flex; flex-wrap: wrap; gap: 6px 16px; font-size: 12.5px; }}
.cup {{ color: var(--accent); }}
.reg {{ color: var(--mint); }}
.ch-theme {{ margin: 0; color: var(--muted); font-size: 13px; }}
.ch-grid {{ display: grid; grid-template-columns: 1fr 300px; gap: 22px; align-items: start; }}
.ch-text p {{ margin: 0 0 12px; font-size: 14px; color: color-mix(in srgb, var(--ink) 88%, var(--muted)); }}
.ch-fig {{ margin: 0; }}
.ch-fig img {{ width: 100%; border-radius: 10px; border: 1px solid var(--line); display: block; }}
.ch-fig figcaption {{ font-size: 11px; color: var(--faint); margin-top: 6px; }}
.pts {{ margin: 0; padding-left: 1.2em; font-size: 13px; color: var(--muted); }}
.pts li {{ margin-bottom: 5px; }}
.pts li::marker {{ color: var(--accent); }}
@media (max-width: 760px) {{
  .ch-grid {{ grid-template-columns: 1fr; }}
  .ch-fig {{ order: -1; max-width: 420px; }}
}}

/* ---- tables ---- */
.tbl-wrap {{ overflow-x: auto; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); margin: 14px 0 30px; }}
table {{ border-collapse: collapse; width: 100%; font-size: 13.5px; min-width: 540px; }}
th, td {{ text-align: left; padding: 10px 16px; border-bottom: 1px solid var(--line); vertical-align: top; }}
th {{ font-size: 12px; letter-spacing: .1em; color: var(--mint); background: var(--surface2); white-space: nowrap; }}
tr:last-child td {{ border-bottom: none; }}
td.mono {{ font-variant-numeric: tabular-nums; color: var(--accent); white-space: nowrap; }}

/* ---- misc lists ---- */
ul.rules {{ padding-left: 1.3em; font-size: 14px; color: var(--muted); max-width: 76ch; }}
ul.rules li {{ margin-bottom: 9px; }}
ul.rules li::marker {{ color: var(--mint); }}
ul.rules strong {{ color: var(--ink); }}

footer {{ border-top: 1px solid var(--line); margin-top: 60px; padding: 28px 0 48px; color: var(--faint); font-size: 12.5px; }}
footer .wrap {{ display: flex; flex-wrap: wrap; gap: 8px 24px; justify-content: space-between; }}
</style>

<nav aria-label="目次"><div class="wrap">
  <span class="brand disp">水煙前線 -EN:CODE-</span>
  <a href="#about">概要</a>
  <a href="#ch1cast">第1章キャラ</a>
  <a href="#allcast">全キャラ図鑑</a>
  <a href="#heroines">ヒロイン</a>
  <a href="#story">ストーリー</a>
  <a href="#world">世界観ルール</a>
  <a href="#canon">正本ガイド</a>
</div></nav>

<header class="hero">
  <p class="eyebrow disp">SETTING REFERENCE BOOK</p>
  <h1 class="disp">水煙前線 -EN:CODE-</h1>
  <p class="sub disp">設定資料集</p>
  <p class="lead">シーシャ屋アドベンチャー＆シミュレーション。バイト青年・蒸野始が、地元大会から世界大会、そしてAIとの一騎打ちまで駆け上がる全5章。この資料は共同制作用のリファレンスです。</p>
  <span class="warn">⚠ 開発用・全編ネタバレあり</span>
</header>

<main class="wrap">

<section class="block" id="about">
  <h2 class="sec disp">このゲームについて</h2>
  <p class="sec-note">主人公・蒸野 始（むしの はじめ）は名店tonariのバイト青年。テーマは「素直さ」——他人の良さに素直に気づける力は、嫉妬にもなるが、吸収と継承の源にもなる。一人称視点で、主人公の立ち絵は基本表示しない。ブラウザ版（web/）がメインの開発トラック。</p>
  <div class="facts">
    <div class="fact"><h4>ステータス（5種のみ）</h4><p><strong>技術／センス／根性／魅力／洞察</strong>。数値は非公開、表示は <span class="stars">★★★☆☆</span> と「少し上がった〜大きく上がった」の4段階の抽象語のみ。</p></div>
    <div class="fact"><h4>大会形式</h4><p><strong>4人一斉対決</strong>。1位のみ進出、2位以下はその場で敗退＝GAME OVER（敗者復活戦なし）。</p></div>
    <div class="fact"><h4>審査員持ち点投入制</h4><p>各審査員は<strong>持ち点10</strong>を好きなタイミングで投入（戻せない）。早入れはドラマ、南雲は最後まで温存派。</p></div>
    <div class="fact"><h4>FLAVOR TRIAL</h4><p>提供後、<strong>コンセプト</strong>と<strong>アピールポイント</strong>を審査員のザワザワに「ぶつける」審査パート。反論は「香ってない！」「ズレてる！」。</p></div>
    <div class="fact"><h4>リーフの規範</h4><p>はじめが使うのは<strong>ブロンドリーフのみ</strong>。「普通の葉で世界一になる」が本作の背骨。ダーク／シガーは他キャラの演出専用。</p></div>
    <div class="fact"><h4>報酬設計</h4><p>全イベントに必ず報酬（ステUP or アイテム）。育て方で詰む事態は発生させない。</p></div>
  </div>
</section>

<section class="block" id="ch1cast">
  <h2 class="sec disp">第1章のキャラクター</h2>
  <p class="sec-note">第1章「一吸目（ファーストドロー）」＝ SMOKE CROWN CUP 編に登場する面々。tonariの日常、3人のライバル、そしてch2以降に効いてくるカメオたち。</p>
  <h3 class="grp disp">tonariとライバルたち</h3>
  {cards(CH1_MAIN)}
  <h3 class="grp disp">審査員・MC</h3>
  {cards(CH1_JUDGES)}
  <h3 class="grp disp">カメオ・ちょい役（ch2以降への仕込み）</h3>
  {cards(CH1_CAMEO)}
</section>

<section class="block" id="allcast">
  <h2 class="sec disp">全キャラクター図鑑（第2章〜第5章）</h2>
  <p class="sec-note">第1章のキャラクターは上のセクション参照。ここでは章ごとの新登場キャラをまとめる。</p>
  <h3 class="grp disp">第2章 — 県大会の強豪</h3>
  {cards(CH2_CHARS)}
  <h3 class="grp disp">第3章 — 東京・全国大会</h3>
  {cards(CH3_CHARS)}
  <h3 class="grp disp">第4章 — 世界大会・ドバイ</h3>
  {cards(CH4_CHARS)}
  <h3 class="grp disp">第5章 — 真の最終章</h3>
  {cards(CH5_CHARS)}
  <h3 class="grp disp">その他の審査員</h3>
  {cards(JUDGES_MISC)}
</section>

<section class="block" id="heroines">
  <h2 class="sec disp">ヒロインと恋愛システム</h2>
  <p class="sec-note">ヒロインは5人。「メインヒロイン」という枠組みは設けず、プレイヤーが好きなキャラを一番愛せる構成を目指す。好感度は5段階、MAXで「付き合う」か「友達のまま」の選択肢。<strong>交際2人以上で修羅場イベント</strong>。恋愛ルートはch3までに着地し、ch4に新ヒロインは追加しない。</p>
  <div class="tbl-wrap"><table>
    <thead><tr><th>ヒロイン</th><th>ひとこと</th><th>ch4ドバイへの応援登場</th></tr></thead>
    <tbody>{heroine_rows}</tbody>
  </table></div>
  <div class="tbl-wrap"><table>
    <thead><tr><th>ch4登場条件</th><th>友達のまま</th><th>彼女</th></tr></thead>
    <tbody>{dubai_rows}</tbody>
  </table></div>
</section>

<section class="block" id="story">
  <h2 class="sec disp">ストーリー（全5章）</h2>
  <p class="sec-note">地元大会 → 県大会 → 全国大会 → 世界大会 → AI戦。「勝ち上がる物語」であると同時に、素直さを失って味覚を失い、取り戻す物語。</p>
  {chapters_html}
  <h3 class="grp disp">全編を貫くモチーフ</h3>
  <ul class="rules">
    <li><strong>店の匂い</strong> — 「店を持つとは、匂いを背負うこと」。はじめの夢が薄いのは背負う匂いがまだ無いから。各章に一度だけ、説明せずさりげなく置く。最終盤、自分の服にtonariの匂いが染みていることに気づく。</li>
    <li><strong>「顔」の縦糸</strong> — 煙の良し悪しを「客の顔が浮かぶかどうか」で語る。ch1決勝（サラリーマンの顔がよぎる）→ ch2「誰の顔も、浮かばなかった」→ スミさんのLIME「誰のために作ってる？」→ ch4告白で全回収。</li>
    <li><strong>継承の対句</strong> — 「技は盗め。ただし、誰から盗んだかは忘れるな」（ch1スミ）→「盗むのと、借り物で着飾るのは違う」（ch2なる）→ ダブルアップル単体勝負＝誰から始まった味かを忘れない（ch5）。</li>
    <li><strong>-EN:CODE-</strong> — タイトルの意味はch5まで作中で説明しない。煙を作る＝生き方のエンコード、吸う＝デコード。</li>
  </ul>
  <h3 class="grp disp">各章のメッセージ</h3>
  <div class="tbl-wrap"><table>
    <thead><tr><th>章</th><th>テーマ</th><th>シーシャプレイヤーへのメッセージ</th></tr></thead>
    <tbody>{msg_rows}</tbody>
  </table></div>
</section>

<section class="block" id="world">
  <h2 class="sec disp">世界観と文化ルール</h2>
  <p class="sec-note">ゲーム全編で守るシーシャ文化の共通ルール。台詞やイベントを書くときはここに反する描写を入れない。</p>
  <ul class="rules">
    <li><strong>蒸らし時間</strong>は 0／3／5／8／10分の選択制。基本は5〜8分。<em>0分は神崎竜二との交友で解放される高等テク</em>。</li>
    <li><strong>炭の配置</strong>は基本トライアングル（三角配置）。<strong>詰める量</strong>は基本12g、ボウルの容量までは増やせる。</li>
    <li><strong>吸い出し</strong> — 提供前に何度か吸って温度を立ち上げる工程。最低2回・3回までは無傷、それ以上は葉が痩せる。</li>
    <li><strong>ミントの好み</strong> — 苦手な客は自分から「ミント抜きで」と言う。毎回口頭確認はしない（不自然）。「お任せで」は普通にある注文。</li>
    <li><strong>チップ文化はない</strong> — 客が現金を置いていく描写は禁止。臨時収入は「売上ボーナス」「まかない」等で表現。</li>
    <li><strong>「シガー」の意味</strong> — 本作でシガーは基本、葉巻ではなく<em>シガーリーフを使ったシーシャ</em>のこと。シガーマン＝シガーリーフシーシャの凄腕職人。</li>
    <li><strong>表記</strong> — C.STATIONが正式名称（旧表記「シーシャステーション」はNG）。ch1大会は SMOKE CROWN CUP（旧名「地方シーシャバトル」「地方予選」はNG）。</li>
    <li><strong>噂のクロスオーバー</strong> — 南雲がシガーマンの噂を恐れている／ムカイさんがシガーマンと勘違いされている／チャコール博士の人体実験の噂——キャラ同士の噂が世界観を深くする。</li>
  </ul>
</section>

<section class="block" id="canon">
  <h2 class="sec disp">正本ガイド（共同制作のための道しるべ）</h2>
  <p class="sec-note">同じ事実は正本1箇所だけに書く。この資料集は<em>二次資料</em>——食い違いを見つけたら、必ず下の正本側を確認して直すこと。</p>
  <div class="tbl-wrap"><table>
    <thead><tr><th>事実の種類</th><th>正本（ここだけを編集）</th></tr></thead>
    <tbody>{canon_rows}</tbody>
  </table></div>
  <h3 class="grp disp">既知の注意点・表記ゆれ</h3>
  <ul class="rules">{canon_notes}</ul>
</section>

</main>

<footer><div class="wrap">
  <span>水煙前線 -EN:CODE- 設定資料集（開発用・二次資料）</span>
  <span>出典: data/characters.json ・ brand/story_and_structure.md ・ CLAUDE.md ／ 2026-07-05 更新</span>
</div></footer>
'''

out = os.path.join(ROOT, "docs/setting_reference.html")
open(out, "w").write(HTML)
print("written:", out, len(HTML) // 1024, "KB")
