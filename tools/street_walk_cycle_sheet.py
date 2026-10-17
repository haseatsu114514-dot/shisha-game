#!/usr/bin/env python3
"""本編の4コマ歩行絵を既存の共通縮尺/足元/減色パイプラインで変換する。"""
import proto_walk_sheet as converter

converter.FRAMES = ["left-contact", "left-passing", "right-contact", "right-passing"]
# 4行シートは行間が狭い。旧2行用の6px結合では隣の帽子と靴がつながる。
find_blobs = converter.find_blobs
converter.find_blobs = lambda image, count: find_blobs(image, count, join_px=1)
extract_frames = converter.extract_frames

def extract_cycle_frames(image, cols, rows):
    if converter.order_in_grid(converter.find_blobs(image, cols*rows), cols, rows) is None:
        raise ValueError("歩行の各コマを分離できません。等分切り出しで靴/帽子を切らず、原画を確認してください。")
    frames = extract_frames(image, cols, rows)
    # 接地足の重心で寄せると、踏み出すたび腰が横へずれる。胴の中心を共通の根元にする。
    for frame in frames:
        mask = converter.np.asarray(frame['img'].getchannel('A')) >= converter.ALPHA_SOLID
        centers = []
        for y in range(int(mask.shape[0]*.5),int(mask.shape[0]*.65)):
            xs = converter.np.nonzero(mask[y])[0]
            if len(xs):
                runs = converter.np.split(xs,converter.np.nonzero(converter.np.diff(xs)>1)[0]+1)
                body = max(runs,key=len)
                centers.append((body[0]+body[-1]+1)/2)
        if centers:
            frame['foot_x'] = float(converter.np.median(centers))
    return frames

converter.extract_frames = extract_cycle_frames

if __name__ == "__main__":
    converter.main()
