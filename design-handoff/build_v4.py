#!/usr/bin/env python3
"""game-v4.html 빌더 — docs/gamev4.js의 __PLACEHOLDER__를 base64로 치환해 단일 HTML로 굽는다.
base64 원본은 직전 빌드(game-v4.html)에서 '변수명' 기준으로 추출한다."""
import re, sys, pathlib
D = pathlib.Path(__file__).parent / 'docs'
js   = (D/'gamev4.js').read_text(encoding='utf-8')
html = (D/'game-v4.html').read_text(encoding='utf-8')

# 1) 직전 빌드에서 변수명 → base64 수집
PAT = re.compile(r'([A-Za-z_][\w.]*)\.src="(data:image/[a-z]+;base64,)([A-Za-z0-9+/=]+)"')
blobs = {m.group(1): (m.group(2), m.group(3)) for m in PAT.finditer(html)}
if not blobs: sys.exit('FAIL: 직전 빌드에서 base64를 찾지 못함')

# 2) 소스의 플레이스홀더를 같은 변수명의 base64로 치환
PH = re.compile(r'([A-Za-z_][\w.]*)\.src="(data:image/[a-z]+;base64,)(__[A-Z]+__)"')
missing = []
def sub(m):
    name = m.group(1)
    if name not in blobs: missing.append(name); return m.group(0)
    mime, b64 = blobs[name]
    return f'{name}.src="{mime}{b64}"'
body, n = PH.subn(sub, js)
if missing: sys.exit('FAIL: base64 없음 → ' + ', '.join(missing))
if re.search(r'__[A-Z]+__', body): sys.exit('FAIL: 치환 안 된 플레이스홀더 잔존')

# 3) 직전 빌드의 HTML 셸(스크립트 밖) 재사용
head, _, rest = html.partition('<script>')
tail = rest[rest.rindex('</script>'):]
out = head + '<script>\n' + body + tail
(D/'game-v4.html').write_text(out, encoding='utf-8')
print(f'빌드 완료: game-v4.html (이미지 {n}줄 치환, {len(out)//1024} KB)')
