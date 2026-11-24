#!/usr/bin/env python3
"""구출 생존자 아트 → 게임 스프라이트(RGBA, 높이 150px).
배경 제거는 '테두리에서 연결된 흰 영역'만 (전역 흰색 키잉은 흰 조리복·가운에 구멍을 낸다)."""
import sys, pathlib
from collections import deque
from PIL import Image

H = 150                 # 기존 임베드 스프라이트와 동일한 높이
TOL = 26                # 흰색 허용 오차 (0~255 거리)
SRC = pathlib.Path('assets'); OUT = pathlib.Path('assets/sprites')

MAP = {                 # key : 최신 확정 라운드 파일
 'gojuyeon'  : 'gpt_r3_gojuyeon.png',
 'ganghogu'  : 'gpt_r5_ganghogu.png',
 'bangsoonim': 'gpt_r4_bangsoonim.png',
 'jopilseong': 'gpt_r3_jopilseong.png',
 'mika'      : 'gpt_r3_mika.png',
 'munjunggap': 'gpt_r6_munjunggap.png',
 'gwakbunnam': 'gpt_r5_gwakbunnam.png',
 'imsunjung' : 'gpt_r6_imsunjung.png',
}

def near_white(p):
    return p[0] >= 255-TOL and p[1] >= 255-TOL and p[2] >= 255-TOL

def strip_bg(im):
    """테두리 시작 플러드필로 배경만 투명화. 내부 흰색(조리복 등)은 보존."""
    im = im.convert('RGBA')
    w, h = im.size
    px = im.load()
    bg = bytearray(w*h)                      # 1 = 배경
    q = deque()
    for x in range(w):
        for y in (0, h-1):
            if near_white(px[x, y]) and not bg[y*w+x]:
                bg[y*w+x] = 1; q.append((x, y))
    for y in range(h):
        for x in (0, w-1):
            if near_white(px[x, y]) and not bg[y*w+x]:
                bg[y*w+x] = 1; q.append((x, y))
    while q:
        x, y = q.popleft()
        for dx, dy in ((1,0),(-1,0),(0,1),(0,-1)):
            nx, ny = x+dx, y+dy
            if 0 <= nx < w and 0 <= ny < h and not bg[ny*w+nx] and near_white(px[nx, ny]):
                bg[ny*w+nx] = 1; q.append((nx, ny))
    for y in range(h):
        row = y*w
        for x in range(w):
            if bg[row+x]:
                px[x, y] = (255, 255, 255, 0)
    return im

def main():
    for key, fn in MAP.items():
        p = SRC/fn
        if not p.exists():
            print(f'  !! 없음: {fn}'); continue
        im = strip_bg(Image.open(p))
        bb = im.getbbox()
        if not bb:
            print(f'  !! 전부 투명: {fn}'); continue
        im = im.crop(bb)
        w = max(1, round(im.width * H / im.height))
        im = im.resize((w, H), Image.LANCZOS)
        o = OUT/f'{key}.png'
        im.save(o, optimize=True)
        kb = o.stat().st_size // 1024
        # 투명 비율로 배경 제거가 됐는지 확인
        a = im.split()[3]
        clear = sum(1 for v in a.getdata() if v < 16) * 100 // (im.width*im.height)
        print(f'  {key:12} {fn:26} → {im.width}x{H}  {kb:3} KB  투명 {clear}%')

if __name__ == '__main__':
    main()
