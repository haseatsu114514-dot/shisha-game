#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""設定資料集ジェネレータ: assets/ の画像と DotGothic16 サブセットを埋め込んだ
docs/setting_reference.html（単一ファイル・共有可）を生成する。

使い方:
    pip install Pillow fonttools brotli
    python3 tools/build_setting_reference.py

キャラ設定や章まとめの本文はこのファイル内のデータ構造を編集する
（正本は docs/master_spec.md / docs/owner_requests.md / brand/story_and_structure.md /
 brand/character_profiles.md / data/characters.json。
 食い違いに気づいたら正本を先に確認すること）。
参照commit: origin/main 54a6d87f（2026-10-28 確認）
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
    "samechan": "samechan/chr_samechan_normal.png",
    "hiyori": "hiyori/chr_hiyori_normal.png",
    "kumicho": "kumicho/chr_kumicho_normal.png",
    "rei": "rei/chr_rei_normal.png",
    "kuze": "kuze/chr_kuze_normal.png",
    "steve": "steve/chr_steve_normal.png",
    "volk": "volk/chr_volk_normal.png",
    "dr_kemuri": "dr_kemuri/chr_dr_kemuri_normal.png",
    "nagumo": "nagumo/chr_nagumo_normal.png",
    "maezono": "maezono/chr_maezono_normal.png",
    "pakki": "pakki/chr_pakki_normal.png",
    "maki": "maki/chr_maki_normal.png",
    "sai": "sai/chr_sai_normal.png",
    "uranaishi": "uranaishi/chr_uranaishi_normal.png",
    "salaryman": "salaryman/chr_salaryman_normal.png",
}

BACKGROUNDS = {
    "bg_title": "backgrounds/bg_title.png",
    "bg_tonari": "backgrounds/bg_tonari_inside_night.png",
    "bg_stage": "backgrounds/bg_tournament_stage.png",
    "bg_cstation": "backgrounds/bg_c_station_day.png",
    "bg_map": "backgrounds/bg_osu_map_night.png",
    "bg_mukai": "backgrounds/bg_mukai_shop.png",
}

CGS = {
    "cg_battle": "cgs/cg_ch1_tournament_battle.png",
    "cg_training": "cgs/cg_ch1_sumi_training.png",
    "cg_kuze_mashiro": "cgs/cg_kuze_mashiro_childhood.png",
    "cg_naru_last_chance": "cgs/cg_naru_last_chance.png",
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
        full = os.path.join(ROOT, "assets/sprites/characters", rel)
        if not os.path.exists(full):
            continue
        img = Image.open(full).convert("RGBA")
        img = trim_alpha(img)
        h = 300
        img = img.resize((max(1, round(img.width * h / img.height)), h), Image.LANCZOS)
        result["p_" + key] = to_uri(img, quality=82)
    for group, w, q in ((BACKGROUNDS, 720, 72), (CGS, 640, 74)):
        for key, rel in group.items():
            full = os.path.join(ROOT, "assets", rel)
            if not os.path.exists(full):
                continue
            img = Image.open(full).convert("RGB")
            img = img.resize((w, round(img.height * w / img.width)), Image.LANCZOS)
            result[key] = to_uri(img, quality=q)
    return result


IMAGES = build_images()

# ---------------------------------------------------------------- characters
# tags: (章チップ, 役割チップ, 追加チップ...)
CH1_MAIN = [
    dict(id="hajime", img="p_hajime", name="蒸野 はじめ", kana="むしの はじめ（一人称：俺）", tags=["主人公", "22歳", "tonari"],
         blurb="地元・橙須のシーシャ屋「tonari」でバイトを始めた22歳の青年。一人称は<strong>「俺」</strong>（旧表記（名前の漢字表記・一人称「僕」）は廃止）。出会った人の技や言葉を素直に吸収する一方、第1章・第2章では「採点表の数字」と「目の前の客の顔」の間で揺れ、自分の煙を「誰かの寄せ集めではないか」と悩む。第3章での味覚喪失と生活の積み重ねによる回復を経て、<strong>「出会った人たちと混ざり合ったままの自分が、すでに俺自身だった」</strong>（空・縁起・分人主義）という境地に至る。【魅力】ステータスは指名売上ボーナス（最大+3,000円）と好感度上昇倍率ボーナス（×1.0〜×1.2）の2効果を持つ。"),
    dict(id="sumi", img="p_sumi", name="墨田 丈一郎", kana="スミ（一人称：俺）", tags=["師匠", "46歳", "tonariオーナー"],
         blurb="「tonari」オーナーであり、15年前の世界大会ファイナリスト。DAY1に私物の「アルファーヘブン レモン（50g）」をはじめに贈り、レモンの輪郭と熱管理を教える。ボトルの水の役割は<strong>「煙を冷やして吸いやすくする」だけ</strong>と説き、有害物質への影響は「諸説ある」として断定しない（爆煙の理由は「グリセリンと熱の仕事」）。第1章優勝の夜には、採点表を取り上げて否定するようなことはせず、<strong>まず「よくやった」と優勝を褒めて</strong>はじめ自身の気づきを見守る。"),
    dict(id="naru", img="p_naru", name="鳴切 亮太", kana="なる（一人称：俺）", tags=["ライバル ch1・ch4", "23歳", "KEMURIKUSA"],
         blurb="橙須の「KEMURIKUSA」店主。バニラやキャラメルなどお菓子系を愛する熱血漢。バニラの温度変化（<em>「熱を上げて初めて甘さが起きるが、攻めすぎると焼けた甘さに化けて花の香りが飛ぶ」</em>）や定番レシピ<strong>『氷レモネード（黄金比 レモン7：ミント3）』</strong>を伝授する。第1章敗退後、第2章DAY11にはじめと衝突したのちKEMURIKUSAを休業して長期修行へ旅立ち、第3章と同日の独立予選<strong>「ラストチャンス予選」代表決定大会を制して日本第二代表</strong>を獲得。第4章ドバイ世界大会で再びはじめと激突する。"),
    dict(id="adam", img="p_adam", name="吾妻 大夢", kana="アダム（一人称：俺／私）", tags=["ライバル ch1", "28歳", "EDEN"],
         blurb="橙須の専門店「EDEN」オーナー。髪色は<strong>本人左（画面右）が緑・本人右（画面左）が赤</strong>。店には約10メーカーのダブルアップルとミント・シナモン等の相棒フレーバーのみを置く求道者。4回目イベント（<code>ch1_adam_fourth</code>）では趣味のナイフ投げ（的のリンゴは後で食べる）とともに、<em>「焦げる一歩手前まで熱を攻める。そこが甘い。先人に教わった味に俺の失敗を山ほど足して渡す」</em>と林檎の継承を語る。"),
    dict(id="minto", img="p_minto", name="緑川 栞", kana="みんと（一人称：みんと／私）", tags=["ヒロイン", "ライバル ch1", "自称20歳（実29歳）", "ぺぱーみんと"],
         blurb="スナック＆シーシャ「ぺぱーみんと」のオーナーママ兼唯一のキャスト（<strong>店はすでに自分で買い戻し済み</strong>が正史）。ミントの温度変化（<em>「熱しだいで甘くもキリッと辛くもなる。温度ちょい高めの甘いミントが好き♡」</em>）や『ピーチ・ソルベ』を教えてくれる。LIMEは営業用の「みんと＠ぺぱーみんと」と恋人後の私用「栞」の2アカウント。"),
    dict(id="oneesan", img="p_oneesan", name="お姉さん", kana="みんとの私服・素の姿", tags=["私服エイリアス", "♥2〜3＆来店2回以上で正体判明"],
         blurb="昼の街や閉店後に遭遇する私服姿のみんと（立ち絵：<code>ura_*</code>）。最初は「お姉さん」表記で、<strong>好感度♥2〜3かつ「ぺぱーみんと」来店2回以上</strong>の状態で開店準備中の店先で遭遇すると「お姉さん＝みんと」と判明する。本名「緑川 栞」はさらに信頼を深めて私服で会う約束をした段階で明かされる。"),
    dict(id="tsumugi", img="p_tsumugi", name="つむぎ", kana="一人称：私 ／ 呼称：はじめさん", tags=["ヒロイン", "21歳", "美大生イラストレーター"],
         blurb="tonariの窓際席を愛する常連（<strong>初登場から名前表示</strong>・TSC13）。傷のあるタブレットとスケッチブックで「植物×動物×煙の生き物」を描き、SNSフォロワーは5万人。DAY1取材でLIME交換（全員♥1保証）→ DAY3下描き（炭をずらして再び線を描く）→ DAY11公募応募（<code>ch1_tsumugi_sketch</code>：tonariの照明、棚のボトル、はじめの後ろ姿、手元、窓辺の「葉の耳と煙の尾を持つ猫」を描いた絵）→ <strong>第3章帰郷夜（<code>ch3_tsumugi_result</code>）に入選・会場展示を報告</strong>する。"),
    dict(id="rin", img="p_rin", name="匂坂 凛", kana="さぎさか りん（一人称：私）", tags=["ヒロイン", "27歳", "Dr.fookah 2階"],
         blurb="専門店「Dr.fookah」2階にあるロシア発のシーシャフレーバーブランド<strong>「NIGHTSIDE」日本代理店デスク</strong>（ボスはヴォルク・イヴァノフ）。1階ショップでの買い物は昼夜いつでも0行動だが、<strong>2階の凛デスク訪問は「夜のみ・1行動消費」</strong>（※襟元の試香紙設定は廃止）。試作品のテイスティングを通じてはじめの誠実さに惹かれていく。"),
    dict(id="hiyori", img="p_hiyori", name="朝霧 ひより", kana="あさぎり ひより（一人称：私／あたし）", tags=["ヒロイン", "25歳", "企業総務・元tonariバイト先輩"],
         blurb="地元企業の総務部（社会人3年目）で、<strong>tonari歴代唯一の元バイト先輩</strong>。仕事の疲れと25歳の焦りから、後輩のはじめの前では「儚げで物憂げな綺麗なお姉さん」を自己プロデュースして演じている（旧「アニメ影響」設定は撤回）。おっとりした表の台詞の直後に、<strong>プレイヤーにだけ見える高テンションな心の声（<code>inner</code>）</strong>が炸裂する二段演出が特徴。趣味はシーシャ・斧投げ・ラーメン。"),
]

CH1_JUDGES = [
    dict(id="nagumo", img="p_nagumo", name="南雲 修二", kana="なぐも しゅうじ（一人称：私）", tags=["審査員長 ch1-4", "45歳", "C.STATION会長"],
         blurb="日本シーシャ協会（C.STATION）会長であり、15年前の世界大会でスミと競ったライバル。第1章大会では<strong>「持ち点10点を自らの基準（内部スコア84点以上）を満たした1人に一括投入する」</strong>という特別審査を行う。"),
    dict(id="dr_kemuri", img="p_dr_kemuri", name="火浦 理一", kana="チャコール博士（一人称：私）", tags=["審査員 ch1-3", "ch5主催", "38歳", "SMOKE LAB代表"],
         blurb="本名は<strong>火浦 理一（ひうら りいち）</strong>（旧「炭場 創」から改定）。「SMOKE LAB」代表として<strong>第1章から審査員として登場</strong>し、熱力学とデータで煙を解析する。第5章ではAI搭載機「SHISHA-9000」との二本勝負を主催し、敗北後は白衣を脱いで現場のカウンターへ戻る。好きなフレーバーはコーラ。"),
    dict(id="maezono", img="p_maezono", name="上園 文太郎", kana="うえぞの ぶんたろう（一人称：私／僕）", tags=["審査員 ch1-2", "39歳", "HOOKAH PRESS編集長"],
         blurb="専門誌『HOOKAH PRESS』編集長（旧名「前園 壮一郎」から<strong>上園 文太郎</strong>へ改定、内部IDのみ <code>maezono</code> 維持）。第1章・第2章の審査員を務め、日常パートでは変装した「お忍び客」として来店することもある。好きなフレーバーはアールグレイ。"),
    dict(id="pakki", img="p_pakki", name="パッキー", kana="正体不明のマスコット（一人称：ボク）", tags=["大会MC兼マスコット", "年齢不詳"],
         blurb="全大会の実況・進行を担う、正体不明のマスコットMC。可愛らしい見た目で慇懃無礼な言葉や煽りを繰り出し、根拠不明の上から目線で会場をかき回す。出自・過去・正体は謎のまま。好きなフレーバーはガムシナモン。"),
]

SUB_SPOT_CHARS = [
    dict(id="maki", img="p_maki", name="斧崎 マキ", kana="おのざき まき（一人称：あたし）", tags=["橙須スポット店主", "34歳", "斧投げBar"],
         blurb="橙須の夜スポット「斧投げBar」店主。豪快で姉御肌な職人気質の女性。口癖の<strong>「斧に仕事をさせな」</strong>は、力任せではなく重さと軌道に任せる教えであり、シーシャの火加減にも通じる。朝霧ひよりの行きつけ。"),
    dict(id="sai", img="p_sai", name="六角 サイ", kana="ろっかく さい（一人称：僕）", tags=["柚ヶ谷スポット店長", "28歳", "ボドゲカフェ／TRPGバー"],
         blurb="第2章・柚ヶ谷の「ボドゲカフェ（夜はTRPGバー）」店長。糸目の笑顔で物腰丁寧な遊び好き。来店したはじめを「TRPG部部長」に任命する。"),
    dict(id="uranaishi", img="p_uranaishi", name="路上占い師", kana="一人称：アタシ", tags=["橙須スポット", "年齢不詳", "週2日出店（0行動）"],
         blurb="橙須の路地裏に特定日（DAY3 / 6 / 10 / 13）だけ現れるフードの老婆タロット占い師。1回3,000円・時間消費なし（0行動）でヒロインとの相性や攻略のヒントを占う。"),
    dict(id="salaryman", img="p_salaryman", name="常連のサラリーマン", kana="常連サラリーマン（一人称：俺／私）", tags=["tonari常連", "41歳"],
         blurb="tonariにいつも通う無口で穏やかなスーツ姿の常連客。定番注文は「ダブルアップルにミントを少し」。はじめの成長を静かに見届ける象徴的なお客さん。"),
]

CH2_CHARS = [
    dict(id="samechan", img="p_samechan", name="波多野 なぎさ", kana="サメちゃん（一人称：わし／余）", tags=["ヒロイン ch2〜", "20歳", "SHISHARK店主（非競技者）"],
         blurb="第2章から橙須に開店するコンセプトシーシャ屋「SHISHARK」店主（大会には出ない非競技者）。極度の人見知りを隠すためサメパーカーを着て尊大な「〜じゃ」口調（一人称「わし」・呼称「お主」）で話し、右手のサメパペット<strong>「コロンブレ（コロちゃん）」</strong>（一人称「余」・呼称「勇者はじめ」）で腹話術を使う。好物は<strong>『アフサール スプリングウォーター』</strong>。"),
    dict(id="ageha", img="p_ageha", name="宵野 葉子", kana="あげは（一人称：うち ／ 呼称：ハジメっち）", tags=["ヒロイン", "ライバル ch2", "22歳", "MELTY PUFF店長"],
         blurb="沖縄出身、隣町・柚ヶ谷のギャル系ラウンジ<strong>「MELTY PUFF」</strong>店長（旧店名「パラパラ」は廃止）。明るいムードメーカーだが「日によって手が震える体質」を抱える。<strong>第2章敗北後も失踪・ブロックはせず（#929）</strong>、表では「次はうちの店ね！」と送り出し、閉店後の独白でのみ手順と言葉で場を立て直すはじめへの「才能の壁（こんなの、ズルいよ）」を滲ませる。恋愛着地は第3章帰郷後。共作レシピは<strong>『メルティ・サマー』</strong>。"),
    dict(id="kumicho", img="p_kumicho", name="神崎 竜二", kana="シーシャ組長（一人称：俺）", tags=["ライバル ch2", "53歳", "神崎煙草店"],
         blurb="柚ヶ谷「神崎煙草店」店主（年齢は<strong>53歳</strong>に確定）。ヤクザ事務所風の内装だが安全と礼節を重んじる職人。DAY5の炭落下事故で安全なトング捌きを教え、大会受付では自ら元組長の素性を明かす。<strong>ドラゴンフルーツ</strong>の特性（<em>「火を入れても崩れずジューシーに立つ葉だ。0分で一気に立ち上げるにゃちょうどいい。ただし攻めすぎりゃトゲが立つ」</em>）と<strong>「0分立ち上げ」</strong>を伝授する。"),
    dict(id="rei", img="p_rei", name="田中 健太", kana="零-REI-（一人称：俺）", tags=["ライバル ch2", "25歳", "零-ZERO-店長"],
         blurb="柚ヶ谷のゴシックシーシャバー「零-ZERO-」店長。V系音楽とファッションを心から愛する<strong>純粋で面倒見のいい青年店長</strong>（現役バンドマン設定や裏の顔、スミ由来のタトゥー設定は廃止。タトゥーは初ライブ後に自分で選んだもの）。看板ミックスはV系曲由来の『イエス』『月光花』『嘘』。<strong>ローズ</strong>の扱い（<em>「薔薇は攻めすぎると棘が出て芳香剤みたいになる。だから中温のぎりぎりで止める」</em>）を教える。"),
]

CH3_CHARS = [
    dict(id="mashiro", img="p_mashiro", name="水瀬 ましろ", kana="一人称：僕 ／ 呼称：はじめくん", tags=["ヒロイン ch3〜", "22歳", "mukai同僚", "シガーマン"],
         blurb="東京の姉妹店「mukai」スタッフであり、常連の噂で恐れられる「シガーマン」の正体（本人は最後まで自分だと気づかない）。久世朔の1歳下の幼なじみ。普段から<strong>『アルファーヘブン ダーク アールグレイ』</strong>（ニコチン8の重いダークリーフ）を常用しているため、第3章序盤ではじめの軽いブロンドを吸った際に「これ、お水？」と感じた（休日練習でも自分用のダークとはじめ用のブロンドを分けて置く）。第3章では味覚を失ったはじめを試すため<strong>グレープを「ダブルアップル」と偽って出し</strong>、大会前夜に嘘を謝罪。休養・食事・病院・皿洗い・お茶の日常で回復を支える。"),
    dict(id="kuze", img="p_kuze", name="久世 朔", kana="くぜ さく（一人称：僕）", tags=["メインライバル ch3", "23歳", "間借り店「煙幕」"],
         blurb="東京出身・福岡拠点、東京の間借り店<strong>「煙幕」</strong>で営業する第3章メインライバル（旧「ナンディ・カルダモン」は完全廃止）。ましろの1歳上の幼なじみ。幼少期に公園でましろがお菓子、自分がお茶の絵を描いた記憶を胸に、<strong>『アルファーヘブン フローズンシトラス』＋『アフサール ブラックティー』</strong>の熱の順序を操り、入っていないはずの「お菓子の味」を連想させる。全国大会後、ましろから温かいお茶とともに「僕にはお茶。でも好き」と伝えられる。"),
    dict(id="steve", img="p_steve", name="スティーブ・デイビス", kana="Smoke & Glory 店主（USA）", tags=["ライバル ch3", "30歳", "低温シトラス研究家"],
         blurb="東京「Smoke & Glory」店主。ストップウォッチと温度記録ノートを駆使し、<strong>『フォースフェクタ マウンテンミスト』</strong>を低温管理で澄み切らせる陽気なアメリカ人研究家。"),
    dict(id="volk", img="p_volk", name="ヴォルク・イヴァノフ", kana="NIGHTSIDE経営者・「鉄の煙」店主", tags=["ライバル ch3（ch2は偵察者「？？？」）", "37歳", "ロシア"],
         blurb="ロシア発のシーシャフレーバーブランド<strong>「NIGHTSIDE」経営者</strong>（匂坂凛のボス）であり、東京「鉄の煙」店主。第2章では大会に出場せず、DAY9試煙会・DAY13搬入口・DAY14後列に名無しの偵察者<strong>「？？？」</strong>として登場。第3章東京全国大会で新発売<strong>『ナイトサイド ブラストミント』</strong>を携えて立ち塞がる。"),
    dict(id="mukai_master", img=None, name="ムカイさん", kana="ムカイさん（一人称：俺）", tags=["mukai店長", "48歳", "ましろの雇い主"],
         blurb="高円寺・中野の高架下をモチーフにした姉妹店「mukai」オーナー。味覚を失って東京へ来たはじめを預かり、精神論ではなく「睡眠・食事・病院受診・皿洗い」という生活の基本から立ち直らせる。好物はカプチーノ。"),
]

CH4_CHARS = [
    dict(id="sheikh", img=None, name="シェイク・アル=ガリヤーン", kana="現世界王者・UAE王族（一人称：私／俺）", tags=["ライバル ch4", "52歳", "ドバイ"],
         blurb="ドバイ世界大会「HAZE: GRAND SMOKE」の頂点に君臨する現世界王者。15年前の世界大会で若き日のスミが作った一台に心を動かされてシーシャの道を志し、<strong>王 煙楼</strong>のもとで技術を磨いた。大会前に路地裏カフェで変装してはじめと3度語り合う。好物はグレープ。"),
    dict(id="master_hookah", img=None, name="王 煙楼", kana="ワン・イェンロウ／煙楼先生（一人称：私）", tags=["ライバル ch4", "58歳", "中国・龍龍水煙所"],
         blurb="中国の老舗「龍龍水煙所」主人。中国伝統の水煙文化を継承する老舗。「陰陽五行の理」で相手の呼吸や残り時間を見て調整する職人であり、<strong>現世界王者シェイクに技術を教えた師匠</strong>（旧案の「スミの師匠」設定は撤回）。ライチや茶葉系を自在に操る。"),
    dict(id="da_silva", img=None, name="ダ・シルヴァ太陽", kana="ブラジル「FESTA」店主（一人称：オレ）", tags=["ゲスト審査員 ch4", "28歳", "チャド統合済み"],
         blurb="サンパウロの人気店「FESTA」店主であり、第4章世界大会のゲスト審査員（旧企画の「チャド／SHOWTIME」を完全統合）。アサイーやトロピカル系を愛し、祝祭のような提供演出を高く評価する。"),
]

CH5_CHARS = [
    dict(id="shisha_9000", img=None, name="SHISHA-9000", kana="AI搭載・自動火力制御シーシャ機", tags=["最終対戦相手 ch5", "SMOKE LAB"],
         blurb="チャコール博士（火浦理一）が開発した最新鋭AIシーシャ機。課題<strong>「ダブルアップル単体12g・二本勝負（同じ観客が1本目・2本目の両方に挙手投票し合計票で決着）」</strong>の1本目では環境変化や咳に即応して先取するが、2本目に接客の声へ切り替えたはじめに逆転される。試合後は破壊されず、人間の「間」を学ぶ学習機としてラボに残る。"),
]

JUDGES_MISC = [
    dict(id="emil", img=None, name="エミル・ユルマズ", kana="元トプハーネ伝統パイプ職人（一人称：私）", tags=["審査員 ch3-4", "48歳", "トルコ"],
         blurb="トルコ・イスタンブールの元パイプ職人。<strong>南雲修二が職人交流の中で知り合った知己</strong>として第3章東京・第4章ドバイの審査員に招聘される（旧案の「スミを探して来日」設定は撤回）。好物はピスタチオ。"),
]

HEROINES = [
    ("つむぎ（21歳）", "美大生・tonari常連（初登場から名前表示）", "傷のあるタブレットで「植物×動物×煙の生き物」を描く。DAY11に応募したtonariと猫の絵が第3章帰郷夜に入選・展示"),
    ("みんと／緑川 栞（自称20・実29歳）", "「ぺぱーみんと」オーナーママ兼キャスト", "店は買い戻し済み。昼は「お姉さん」→♥2〜3＆来店2回以上で正体判明→私服の約束で本名「栞」開示"),
    ("匂坂 凛（27歳）", "Dr.fookah 2階・NIGHTSIDE日本代理店デスク", "ボスはヴォルク。1階買い物は昼夜0行動、2階訪問は夜のみ1行動消費。襟に試香紙は挿さない"),
    ("あげは／宵野 葉子（22歳）", "柚ヶ谷「MELTY PUFF」店長（沖縄出身）", "手が震える体質。2章敗北後も失踪せず「次はうちの店ね」と送り出す（#929）。恋愛着地は3章帰郷後"),
    ("水瀬 ましろ（22歳）", "東京「mukai」同僚・シガーマンの正体", "久世朔の幼なじみ。重い『AF ダーク アールグレイ』愛用。3章でグレープをDAと偽って出し、後に謝罪＆日常で回復を支える"),
    ("サメちゃん／波多野 なぎさ（20歳）", "橙須「SHISHARK」店主（2章〜・非競技者）", "一人称「わし」＋右手のパペット「コロンブレ（余／勇者はじめ）」。『アフサール スプリングウォーター』愛用"),
    ("朝霧 ひより（25歳）", "企業総務・tonari唯一の元バイト先輩", "25歳の焦りから「儚いお姉さん」を自己プロデュース。表の声と高テンションな心の声（inner）の二段演出"),
]

CHAPTERS = [
    dict(no="第1章", title="煙がつなぐ街", cup="SMOKE CROWN CUP（橙須・地方大会）", reg="レモン 2g以上使用（DAY1にスミから50g支給）",
         theme="基礎と街のつながり、採点表の数字と客の顔", img="cg_training",
         imgcap="CG: スミさんの特訓（cg_ch1_sumi_training）",
         body="""舞台は地元・<strong>橙須（とうす）</strong>の商店街。シーシャ屋「tonari」で働く蒸野はじめは、DAY1に師匠スミから私物の「アルファーヘブン レモン（50g）」を贈られ、常連の美大生<strong>つむぎ</strong>の取材を受けてLIMEを交換する（全員♥1保証）。スミの腰痛を機に、14日目の地方大会「SMOKE CROWN CUP」へ挑戦することに。<br><br>ケムリクサの<strong>なる</strong>（バニラの温度変化・氷レモネード7:3）、EDENの<strong>アダム</strong>（ダブルアップルの焦げる一歩手前の甘さ）、ぺぱーみんとの<strong>みんと</strong>（ミントの温度変化）と切磋琢磨し、DAY11にはつむぎがtonariの風景と「葉の耳と煙の尾を持つ猫」を描いた公募作を完成させる。大会本番は4人同時1試合、審査員長・南雲の<strong>「持ち点10一括投入（基準84以上）」</strong>で優勝。優勝の夜、スミはまず優勝を褒め、採点表を取り上げて否定したりはしないが、はじめ自身の中に「数字のための煙」への揺らぎが芽生える。章末は90年代セル画アニメ風次回予告（47.5秒）。""",
         points=["課題フレーバー: レモン 2g以上（私物持ち込み・DAY1にスミから1箱50g支給）",
                 "審査員: 南雲修二 ／ チャコール博士（火浦理一・1章から登場） ／ 上園文太郎",
                 "つむぎのスケッチ縦軸: DAY1取材 → DAY3下描き（炭をずらす） → DAY11応募 → 3章帰郷夜に入選報告"]),
    dict(no="第2章", title="才能の壁（Hollow Crown）", cup="HAZE: OPEN CLOUD（県大会・柚ヶ谷）", reg="ストロベリー（DAY9試煙会のアフサール苺支給＋持ち込み苺系も可）",
         theme="数字への執着、仲間との摩擦、才能の壁", img="bg_stage",
         imgcap="背景: 大会ステージ（bg_tournament_stage）",
         body="""電車で隣町・<strong>柚ヶ谷（ゆずがや）</strong>と橙須を往復する第2章（橙須にはサメちゃんの「SHISHARK」が開店）。柚ヶ谷ではギャル店長<strong>あげは</strong>の「MELTY PUFF」、<strong>神崎竜二（53歳）</strong>の「神崎煙草店」、V系青年店長<strong>零-REI-</strong>の「零-ZERO-」と出会う。DAY5の炭落下事故では神崎から安全なトング捌きとドラゴンフルーツの<strong>「0分立ち上げ」</strong>を学び、REIからはローズの中温止めを学ぶ。<br><br>DAY9試煙会で課題<strong>「ストロベリー（新作アフサール苺）」</strong>が発表され、会場には名無しの偵察者<strong>「？？？」（ヴォルク）</strong>が姿を見せる。DAY11、常連の娘の誕生日の苺シーシャを相談に来たなるに対し、はじめは採点表を見ながらグラム数で話を遮ってしまい衝突。大会当日、神崎は受付で自ら組の素性を明かして出場する。優勝後、<strong>あげはは失踪せず「次はうちの店ね！」と送り出す（#929）</strong>が、閉店後の独白でのみ震える手を見つめ「こんなの、ズルいよ」と才能の壁を吐露する。章末、はじめの味覚が鈍り東京の姉妹店「mukai」へ。""",
         points=["全章共通の4人同時1試合制（旧3ステージ制・FLAVOR TRIAL・ヴォルクの2章出場は廃止）",
                 "ヴォルクはDAY9試煙会・DAY13搬入口・DAY14後列に名無しの偵察者「？？？」として登場",
                 "あげはは失踪・LIMEブロックせず関係継続、恋愛の最終着地は第3章帰郷後の再会"]),
    dict(no="第3章", title="嘘つきたちの夜（SMOKE AND MIRRORS）", cup="HAZE: NATIONAL TOKYO（東京全国大会）", reg="自由課題（オリジナルミックス）＋同日「ラストチャンス予選」",
         theme="生活の手順による回復、幼なじみの記憶、混ざったままの自分", img="cg_kuze_mashiro",
         imgcap="CG: 久世とましろの幼少期の記憶（cg_kuze_mashiro_childhood）",
         body="""高円寺・中野の高架下をモチーフにした東京の姉妹店「mukai」へ出向したはじめは、オーナーの<strong>ムカイ</strong>と同僚の<strong>水瀬ましろ</strong>に迎えられる。到着の日にましろが「これ、お水？」と言ったのは、普段から<strong>重いダークリーフ（『AF ダーク アールグレイ』、ニコチン8）</strong>を吸っているための重さのギャップだった。ましろは味覚を失ったはじめを試すため<strong>グレープを「ダブルアップル」と偽って出す</strong>が、回復は超人的な利き煙ではなく<strong>休養・食事・病院受診・皿洗い・お茶という生活の手順</strong>の積み重ねで進む。<br><br>大会前夜、ましろの幼なじみ<strong>久世 朔</strong>（間借り店「煙幕」・旧ナンディは廃止）とましろ、はじめの3人がそれぞれの「嘘・強がり」を明かす。全国大会（はじめ・久世・スティーブ・ヴォルク、審査員は南雲・博士・エミル）で、久世は<strong>『AF フローズンシトラス』＋『アフサール ブラックティー』</strong>の熱順序でお菓子を連想させ一口目に濃い青柑橘を立たせるが、はじめは<strong>「客の一口を待つ」</strong>接客の間を守り抜き日本第一代表に。大会後、ましろは久世にお茶を差し出し「僕にはお茶。でも好き」と伝える。同日、長期修行を経た<strong>なるが独立予選「ラストチャンス予選」を制して日本第二代表</strong>を獲得！帰郷後、つむぎの入選報告とあげはとの再会を経てドバイへ。""",
         points=["旧章題「虚ろな王冠」から『嘘つきたちの夜（SMOKE AND MIRRORS）』へ改定（#385）",
                 "久世朔（柑橘＋紅茶の熱順序）、スティーブ（マウンテンミスト低温管理）、ヴォルク（新発売ナイトサイド ブラストミント）",
                 "なるが「ラストチャンス予選」代表決定大会で優勝し、日本第二代表として第4章ドバイへ進出"]),
    dict(no="第4章", title="継承の煙（Legacy Smoke）", cup="HAZE: GRAND SMOKE（ドバイ世界大会）", reg="自由課題（最高の一台・はじめは「和の一台」でDAは混ぜない）",
         theme="15年前の因縁の決着、縁起の結晶としての世界一", img="cg_naru_last_chance",
         imgcap="CG: ラストチャンス予選を勝ち抜いたなる（cg_naru_last_chance）",
         body="""世界大会の舞台はUAE・ドバイ。出場者は日本第一代表の<strong>はじめ</strong>、日本第二代表の<strong>なる</strong>、中国「龍龍水煙所」の老大家<strong>王 煙楼（煙楼先生）</strong>、そして現世界王者でありUAE王族の<strong>シェイク・アル=ガリヤーン</strong>。審査員は南雲修二、ブラジル「FESTA」店主<strong>ダ・シルヴァ太陽</strong>（旧チャド統合）、トルコの<strong>エミル・ユルマズ</strong>。<br><br>路地裏カフェで変装したシェイクと3度語り合う中で、15年前の世界大会でのスミと南雲のすれ違いと、当時スミが作った一台がシェイクの原点になったこと（その後シェイクは技術を王煙楼に学んだ）が明かされる。本番ではじめはスミの模倣（ダブルアップル）ではなく、出会ったすべての人との縁を繋いだ<strong>「和の一台」（DAは混ぜない）</strong>で世界一に輝く。帰国後の二台は「スミと南雲」「はじめとなる」の二つの店に分かれ、はじめとスミが並ぶ姿は第5章の帰郷が受け持つ。""",
         points=["王煙楼＝シェイクに技術を教えた師匠（スミの師匠設定は撤回）",
                 "エミル＝南雲の職人交流の知己（スミ捜索設定は撤回）",
                 "ダ・シルヴァ太陽に旧チャド（SHOWTIME）を完全統合"]),
    dict(no="第5章", title="機械仕掛けの神（Deus Ex Machina）", cup="エキシビションマッチ（SMOKE LAB 特設ステージ）", reg="ダブルアップル単体 12g・二本勝負（観客挙手2回合計票）",
         theme="完璧な最適化 vs 相手を待つ接客の声", img="bg_cstation",
         imgcap="背景: C.STATION（bg_c_station_day）",
         body="""帰国した世界王者はじめの前に、<strong>チャコール博士（火浦理一）</strong>が最新鋭AI搭載シーシャ機<strong>「SHISHA-9000」</strong>を携えて挑戦状を叩きつける。課題は一切のごまかしが効かない<strong>「ダブルアップル単体 12g」</strong>。勝敗は審査員ではなく、<strong>同じ観客が1本目・2本目の両方を吸って挙手投票し、2回分の合計票数で決着</strong>する。<br><br>1本目は環境変化や観客の咳き込みにミリ秒単位で即応した SHISHA-9000 が僅差で先取。追い詰められたはじめは2本目で「機械より正確に作ろう」とするのをやめ、普段tonariで常連客にかける<strong>接客の声（「いつもの、少し軽めにしますか」）</strong>に切り替え、相手の呼吸を待つ一台で大逆転勝利を収める。敗れた SHISHA-9000 は破壊されず学習機としてラボに残り、火浦博士も白衣を脱いで現場のカウンターへ戻る。""",
         points=["二本勝負: 同じ観客が1本目・2本目の両方に挙手し、2回分の合計票で勝敗を決定",
                 "1本目はAI先取 → 2本目ではじめが接客の声に切り替え逆転勝利",
                 "SHISHA-9000は破壊されず学習機として残り、火浦博士も現場へ復帰する"]),
]

MESSAGES = [
    ("第1章", "煙がつなぐ街", "師匠のレモン、街の常連、ライバルの火加減——日々の営業と出会いが最初の一台を作る"),
    ("第2章", "才能の壁 (Hollow Crown)", "採点表の数字だけを追うと、目の前の人の顔が見えなくなる"),
    ("第3章", "嘘つきたちの夜 (SMOKE AND MIRRORS)", "特別な魔法がなくても、休んで、食べて、お茶を飲んで、相手の一口を待てばいい"),
    ("第4章", "継承の煙 (Legacy Smoke)", "誰かの真似ではなく、出会った全員と混ざり合ったままの自分がすでに自分自身（空・縁起・分人主義）"),
    ("第5章", "機械仕掛けの神 (Deus Ex Machina)", "完璧な温度曲線よりも、「いつもの、少し軽めにしますか」と相手を見る声が人の心を動かす"),
]

FLAVOR_LESSONS = [
    ("スミ（1章DAY1）", "レモン", "鋭い酸味で味の輪郭を締める葉。ミントや甘い葉に少し足してもいいが、熱をかけすぎると香りが飛ぶ"),
    ("なる（1章）", "バニラ ／ 氷レモネード", "バニラの甘さは熱を上げて初めて起きるが、攻めすぎると焼けた甘さに化けて花の香りが飛ぶ。氷レモネードの黄金比はレモン7：ミント3"),
    ("みんと（1章）", "ミント ／ ピーチ・ソルベ", "ミントは熱しだいで甘くもキリッと辛くもなる。温度ちょい高めの甘いミントがみんと流"),
    ("アダム（1章3・4回目）", "ダブルアップル", "焦げる一歩手前まで熱を攻めたところが甘い。越えれば一気に苦くなる。先人から受け継ぎ失敗を重ねた林檎の旅"),
    ("神崎 竜二（2章）", "ドラゴンフルーツ", "火を入れても崩れずジューシーに立つ葉。「0分立ち上げ」に最適だが、攻めすぎるとトゲが立つ"),
    ("零-REI-（2章）", "ローズ", "薔薇は攻めすぎると棘が出て芳香剤みたいになる。だから上げずに中温のぎりぎりで止める"),
    ("久世 朔（3章）", "フローズンシトラス＋ブラックティー", "一口目に濃い青柑橘を立たせ、後から紅茶の香りを重ねる熱の順序で、入っていないお菓子の味を連想させる"),
    ("水瀬 ましろ（3章）", "ダーク アールグレイ ／ グレープ", "ニコチン8の重いダークリーフを常用（3章序盤の「これ、お水？」の理由）。3章ではグレープをダブルアップルと偽って出しはじめを試す"),
]

CANON_ROWS = [
    ("最優先の確定仕様・オーナー裁定", "docs/master_spec.md ・ docs/owner_requests.md"),
    ("各章あらすじ・世界観・構成の正本", "brand/story_and_structure.md"),
    ("キャラクター設定・人物像の正本", "brand/character_profiles.md ・ data/characters.json"),
    ("台詞・イベント・フレーバーうんちく", "data/dialogue/*.json ・ data/story_routes.json"),
    ("フレーバー（5社77種）・レシピ（13種＋裏7種）・機材", "data/flavors.json ・ data/recipes.json ・ data/secret_recipes.json ・ data/equipment.json"),
]

CANON_NOTES = [
    "<strong>参照commit</strong>：<code>origin/main 54a6d87f</code>（2026-10-28 確認）。この設定資料集（<code>docs/setting_book/</code>・<code>docs/setting_reference.html</code>）は二次資料であり、食い違いがある場合は上の正本を優先する。",
    "<strong>照合範囲</strong>：フレーバー収録数・価格、主要人物の氏名・読み・年齢、章タイトル・大会名・課題は正本と照合済み。一人称・呼称、店舗説明、あらすじの細部は全件照合が未了（正本優先）。",
    "<strong>現行唯一の実装は <code>remake/</code></strong>（旧 <code>web/</code> および Godot版は完全廃止）。第1章〜第3章必須進行がブラウザで通しプレイ可能、第4章・第5章は台詞データ先行。",
    "<strong>スミの水の説明（#1113 / #1128）</strong>：ボトルの水の役割は<strong>「煙を冷やして吸いやすくする」だけ</strong>。有害物質への影響は<strong>「諸説ある」</strong>とし、断定しない。爆煙の理由は水ではなく<strong>「グリセリンと熱の仕事」</strong>（K14）。",
    "<strong>水入れ・蒸らし仕様</strong>：水入れ工程は<strong>開始水量 0（空）からスタート</strong>（#1081 E01）。蒸らしは<strong>キッチンタイマーで分1分・秒10秒刻みに設定してスタート</strong>（GP21〜26、上限10分）。",
    "<strong>廃止・統合された旧設定</strong>：旧3章ライバル「ナンディ・カルダモン」は廃止（→<strong>久世 朔</strong>）。旧「チャド（SHOWTIME）」は<strong>ダ・シルヴァ太陽（FESTA）</strong>へ統合。旧「炭場 創」→<strong>火浦 理一</strong>、旧「前園 壮一郎」→<strong>上園 文太郎</strong>へ改名。",
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
        fig = f'<div class="port noart"><span class="noart-mark">{initial}</span><span class="noart-note">立ち絵<br>未配置</span></div>'
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
lesson_rows = "".join(
    f"<tr><td><strong>{p}</strong></td><td><code>{f}</code></td><td>{d}</td></tr>" for p, f, d in FLAVOR_LESSONS)
msg_rows = "".join(
    f"<tr><td class='mono'>{c}</td><td>{t}</td><td>{m}</td></tr>" for c, t, m in MESSAGES)
canon_rows = "".join(
    f"<tr><td>{k}</td><td><code>{v}</code></td></tr>" for k, v in CANON_ROWS)
canon_notes = "".join(f"<li>{n}</li>" for n in CANON_NOTES)
chapters_html = "\n".join(chapter_block(ch, i) for i, ch in enumerate(CHAPTERS))


# ---------------------------------------------------------------- font subset
def subset_font():
    display_text = set()
    for s in [
        "『水煙前線 -EN:CODE-』 設定資料集 第12345章 煙がつなぐ街 才能の壁 Hollow Crown 嘘つきたちの夜 SMOKE AND MIRRORS 継承の煙 Legacy Smoke 機械仕掛けの神 Deus Ex Machina このゲームについて キャラクター全図鑑 ストーリー（全5章） 世界観・クラフト・大会仕様 フレーバーうんちく 正本ガイド 公式ヒロイン7名 審査員・MC・街スポット 開発用・二次資料"
    ]:
        display_text.update(s)
    for group in (CH1_MAIN, CH1_JUDGES, SUB_SPOT_CHARS, CH2_CHARS, CH3_CHARS, CH4_CHARS, CH5_CHARS, JUDGES_MISC):
        for c in group:
            display_text.update(c["name"])
    import string
    display_text.update(string.printable)
    display_text.update("ぁあぃいぅうぇえぉおかがきぎくぐけげこごさざしじすずせぜそぞただちぢっつづてでとどなにぬねのはばぱひびぴふぶぷへべぺほぼぽまみむめもゃやゅゆょよらりるれろゎわゐゑをんゔ")
    display_text.update("ァアィイゥウェエォオカガキギクグケゲコゴサザシジスズセゼソゾタダチヂッツヅテデトドナニヌネノハバパヒビピフブプヘベペホボポマミムメモャヤュユョヨラリルレロヮワヰヱヲンヴーヵヶ")
    display_text.update("★☆♪♥　、。・「」『』（）！？──…〜～：；０１２３４５６７８９")
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
HTML = f'''<title>『水煙前線 -EN:CODE-』設定資料集（origin/main 54a6d87f 準拠）</title>
<meta charset="utf-8">
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
  background: linear-gradient(rgba(10,13,17,.55), rgba(10,13,17,.82)), url("{IMAGES.get("bg_title", "")}") center/cover;
  color: #ece8dd; text-align: center; padding: 84px 20px 72px;
}}
.hero .eyebrow {{ font-size: 13px; letter-spacing: .35em; color: var(--mint); margin: 0 0 14px; }}
.hero h1 {{ font-size: clamp(30px, 6vw, 56px); margin: 0 0 6px; text-wrap: balance; text-shadow: 0 0 24px rgba(232,135,58,.35); }}
.hero .sub {{ font-size: clamp(17px, 2.6vw, 22px); color: var(--accent); margin: 0 0 22px; }}
.hero p.lead {{ max-width: 660px; margin: 0 auto; color: #c8c4b8; font-size: 14.5px; }}
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
  <span class="brand disp">『水煙前線 -EN:CODE-』</span>
  <a href="#about">概要</a>
  <a href="#ch1cast">第1章・街キャラ</a>
  <a href="#allcast">全キャラ図鑑</a>
  <a href="#heroines">ヒロイン7名</a>
  <a href="#story">ストーリー全5章</a>
  <a href="#world">クラフト・大会仕様</a>
  <a href="#canon">正本ガイド</a>
</div></nav>

<header class="hero">
  <p class="eyebrow disp">SETTING REFERENCE BOOK — 2026-10-28</p>
  <h1 class="disp">『水煙前線 -EN:CODE-』</h1>
  <p class="sub disp">共同制作向け・設定資料集（二次資料）</p>
  <p class="lead">シーシャ屋育成 × 恋愛 × 少年漫画バトルADV。地元・橙須の「tonari」で働く青年・蒸野はじめ（俺）が、出会った人々と混ざり合ったままの自分で世界一、そしてAIとの二本勝負へ挑む全5章。参照commit: <code>origin/main 54a6d87f</code>（2026-10-28 確認）。</p>
  <span class="warn">⚠ 開発用・全編ネタバレあり ／ 正本は docs/master_spec.md 等</span>
</header>

<main class="wrap">

<section class="block" id="about">
  <h2 class="sec disp">このゲームについて</h2>
  <p class="sec-note">主人公・<strong>蒸野 はじめ（むしの はじめ／一人称：俺）</strong>は地元・橙須の「tonari」見習いバイト。中心テーマは<strong>「空・縁起・分人主義（混ざったままで、俺だった）」</strong>。現行唯一の実装は <code>remake/</code>（第1章〜第3章必須進行が通しプレイ可能、第4章・第5章は台詞データ先行）。</p>
  <div class="facts">
    <div class="fact"><h4>5ステータス（★1〜5）</h4><p><strong>センス／技術／火力管理／接客／魅力</strong>。【魅力】は指名売上ボーナス（最大+3,000円）と好感度上昇倍率ボーナス（×1.0〜×1.2）の2効果。</p></div>
    <div class="fact"><h4>大会形式（4人同時1試合）</h4><p>第1章〜第4章は<strong>4人同時1試合制</strong>（旧2章3ステージ制・FLAVOR TRIALは廃止）。第5章のみAIとの<strong>DA単体12g・二本勝負（観客挙手2回合計票）</strong>。</p></div>
    <div class="fact"><h4>審査5軸（20%×5）</h4><p><strong>煙量・持続・香り・再現度・提供演出</strong>の各20%＝100点満点。第1章の南雲は持ち点10を基準（84点以上）達成者1人に一括投入。</p></div>
    <div class="fact"><h4>水入れ・スミの水の説明</h4><p>水入れは<strong>開始水量0（空）からスタート</strong>（#1081 E01）。水の役割は<strong>「煙を冷やして吸いやすくする」だけ</strong>（有害物質への影響は「諸説ある」とし断定しない、#1113/#1128）。</p></div>
    <div class="fact"><h4>蒸らし＆温度帯表現</h4><p>蒸らしは<strong>キッチンタイマーで10秒刻みに設定</strong>（GP21〜26、上限10分）。温度計の数値表示はなく、陽炎・炭の赤熱・煙・音・香り描写で温度帯を読む。</p></div>
    <div class="fact"><h4>フレーバー＆レシピ</h4><p><strong>6メーカー全77種</strong>（アルファーヘブン37・ドバジ18・アフサール17・フォースフェクタ1・フワリ1・ナイトサイド3）。定番<strong>13レシピ</strong>＋裏<strong>7レシピ</strong>。</p></div>
  </div>
</section>

<section class="block" id="ch1cast">
  <h2 class="sec disp">第1章・街スポットのキャラクター</h2>
  <p class="sec-note">第1章『煙がつなぐ街』（舞台：橙須）から登場するメインキャスト、審査員・MC、そして橙須・柚ヶ谷のスポット店主たち。</p>
  <h3 class="grp disp">tonari・第1章ライバル・ヒロイン</h3>
  {cards(CH1_MAIN)}
  <h3 class="grp disp">審査員・大会MC</h3>
  {cards(CH1_JUDGES)}
  <h3 class="grp disp">街スポット店主・常連客</h3>
  {cards(SUB_SPOT_CHARS)}
</section>

<section class="block" id="allcast">
  <h2 class="sec disp">全キャラクター図鑑（第2章〜第5章）</h2>
  <p class="sec-note">第2章（柚ヶ谷・橙須）、第3章（東京）、第4章（ドバイ）、第5章（SMOKE LAB）で登場するヒロイン・ライバル・審査員。</p>
  <h3 class="grp disp">第2章『才能の壁』 — 柚ヶ谷・橙須の新キャスト</h3>
  {cards(CH2_CHARS)}
  <h3 class="grp disp">第3章『嘘つきたちの夜』 — 東京・全国大会</h3>
  {cards(CH3_CHARS)}
  <h3 class="grp disp">第4章『継承の煙』 — ドバイ・世界大会</h3>
  {cards(CH4_CHARS)}
  <h3 class="grp disp">第5章『機械仕掛けの神』 — 最終決戦</h3>
  {cards(CH5_CHARS)}
  <h3 class="grp disp">海外審査員</h3>
  {cards(JUDGES_MISC)}
</section>

<section class="block" id="heroines">
  <h2 class="sec disp">公式ヒロイン7名と恋愛システム</h2>
  <p class="sec-note"><code>data/story_routes.json</code> で定義された公式ヒロインは全7名。全章共通で<strong>交流の時系列ルール</strong>（大会前／大会後に遅れてイベントを読む場合の分岐）を守り、複数ヒロインと同時恋人状態に進むと裏レシピ<strong>『二股の林檎』</strong>が解放される。</p>
  <div class="tbl-wrap"><table>
    <thead><tr><th>ヒロイン</th><th>所属・立場</th><th>確定設定・縦軸のポイント</th></tr></thead>
    <tbody>{heroine_rows}</tbody>
  </table></div>
</section>

<section class="block" id="story">
  <h2 class="sec disp">ストーリー（全5章）</h2>
  <p class="sec-note">橙須地方大会 → 柚ヶ谷県大会 → 東京全国大会（＋ラストチャンス予選） → ドバイ世界大会 → SMOKE LAB AI二本勝負。</p>
  {chapters_html}
  <h3 class="grp disp">各章のテーマとメッセージ</h3>
  <div class="tbl-wrap"><table>
    <thead><tr><th>章</th><th>章タイトル</th><th>中心メッセージ</th></tr></thead>
    <tbody>{msg_rows}</tbody>
  </table></div>
</section>

<section class="block" id="world">
  <h2 class="sec disp">世界観・クラフト・フレーバーうんちく（#1108）</h2>
  <p class="sec-note">作中で語られるフレーバーの温度帯変化・固有エピソード（#1108）と、クラフト・日常パートの確定ルール。</p>
  <div class="tbl-wrap"><table>
    <thead><tr><th>伝授キャラ</th><th>対象フレーバー</th><th>作中のうんちく・温度帯のポイント</th></tr></thead>
    <tbody>{lesson_rows}</tbody>
  </table></div>
  <h3 class="grp disp">クラフト・日常パートの重要ルール</h3>
  <ul class="rules">
    <li><strong>ボトルの水の役割（#1113 / #1128）</strong> — スミの説明は<strong>「煙を冷やして吸いやすくする」だけ</strong>。ニコチンやタールなど有害物質への影響は<strong>「諸説ある」とし、断定しない</strong>。また爆煙の理由は水ではなく<strong>「グリセリンと熱の仕事」</strong>（K14）。</li>
    <li><strong>水入れ工程（#1081 E01）</strong> — <strong>開始水量 0（空の状態）からスタート</strong>し、ステム先端が水中に約2〜3cm浸かる適正ラインまで注ぐ。</li>
    <li><strong>パッキング＆混ぜ方</strong> — 1g刻み（ボウル容量12g / 15g / 20gの±1g以内でぴったりボーナス+15%）。2種以上は<strong>ミックス／レイヤー／セパレート</strong>を選択。</li>
    <li><strong>蒸らし＆途中調整</strong> — 画面上の<strong>キッチンタイマーで分1分・秒10秒刻みに設定してスタート</strong>（上限10分）。神崎竜二との交流で<strong>「0分立ち上げ」</strong>も登場。提供中の温度調整は<strong>最大2回</strong>。</li>
    <li><strong>0行動（時間消費なし）スポット</strong> — <strong>Dr.fookah 1階ショップ</strong>（買い物・1,000円アルファーヘブンくじ、昼夜いつでも0行動 ※2階の凛デスクのみ夜1行動）、<strong>C.STATION</strong>、<strong>路上占い師</strong>（DAY3/6/10/13、3,000円）、<strong>家シーシャ</strong>（夜1日1回、行動消費なし・体力1消費、S賞『大会公式モデルの台』で熟練度経験値×1.25）。</li>
  </ul>
</section>

<section class="block" id="canon">
  <h2 class="sec disp">正本ガイド（共同制作のための道しるべ）</h2>
  <p class="sec-note">このHTMLおよび <code>docs/setting_book/*.md</code> は<em>二次資料</em>です。仕様変更や食い違いの確認時は必ず下の正本を参照してください。</p>
  <div class="tbl-wrap"><table>
    <thead><tr><th>事実の種類</th><th>正本ファイル</th></tr></thead>
    <tbody>{canon_rows}</tbody>
  </table></div>
  <h3 class="grp disp">更新メモ・注意点（2026-10-28）</h3>
  <ul class="rules">{canon_notes}</ul>
</section>

</main>

<footer><div class="wrap">
  <span>『水煙前線 -EN:CODE-』設定資料集（開発用・二次資料）</span>
  <span>参照commit: origin/main 54a6d87f ／ 確認・更新日: 2026-10-28（Issue #544）</span>
</div></footer>
'''

out = os.path.join(ROOT, "docs/setting_reference.html")
open(out, "w").write(HTML)
print("written:", out, len(HTML) // 1024, "KB")
