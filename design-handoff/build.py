#!/usr/bin/env python3
# 게임 빌드: docs/gamev2.js(이미지=플레이스홀더 템플릿) + build_assets/ 이미지 -> docs/game-v2.html
# gamev2.js는 __BG__/__F__ 등 플레이스홀더만 있음. 이 스크립트가 실제 이미지를 박아 완성 html 생성.
import base64, re, os, sys
ROOT=os.path.dirname(os.path.abspath(__file__))
HTML=os.path.join(ROOT,"docs","game-v2.html")
JS=os.path.join(ROOT,"docs","gamev2.js")
BA=os.path.join(ROOT,"build_assets")
IMGS={"__BG__":"map_v5.jpg","__F__":"spr_front.png","__S__":"spr_side.png","__B__":"spr_back.png",
      "__SC__":"spr_sangcheol.png","__JH__":"spr_jaehyuk.png","__JN__":"spr_jina.png","__MS__":"spr_mansu.png"}
def b64(fn):
    # 템플릿에 이미 "data:image/...;base64," 접두어가 있음 → base64 문자열만 반환(접두어 붙이면 이중!)
    return base64.b64encode(open(os.path.join(BA,fn),"rb").read()).decode()
html=open(HTML,encoding="utf-8").read()
hi=html.index("<script>")+len("<script>"); ti=html.rindex("</script>")
body=open(JS,encoding="utf-8").read()
new=html[:hi]+"\n"+body+"\n"+html[ti:]
for tok,fn in IMGS.items():
    new=new.replace(tok, b64(fn))
left=set(re.findall(r'__[A-Z_]+__',new))
assert not left, "치환 안 된 플레이스홀더: %s"%left
blobs=len(re.findall(r'data:image/[a-z]+;base64,[A-Za-z0-9+/=]{40,}',new))
assert blobs==8, "이미지 blob 수 이상: %d"%blobs
open(HTML,"w",encoding="utf-8").write(new)
print("빌드 완료: game-v2.html (blobs=%d, size=%d)"%(blobs,len(new)))
