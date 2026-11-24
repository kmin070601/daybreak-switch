# Daybreak Switch · No. 062

**사이트**: https://kmin070601.github.io/daybreak-switch/ · **Windows 앱**: [DaybreakSwitch-setup.exe](https://github.com/kmin070601/daybreak-switch/releases/latest/download/DaybreakSwitch-setup.exe) (1.6MB)

유리구슬을 밀면 그 자리의 밤과 아침이 바뀌는 볼륨 슬라이더입니다. 웹 재질 연구 시리즈 No. 062.

- **사이트**: 브라우저에서 바로 열립니다. 슬라이더는 페이지 안의 소리만 조절합니다.
- **Windows 앱**: 설치하면 키보드 볼륨 키를 누를 때 Windows 기본 볼륨 팝업 대신 이 슬라이더가 뜨고, 실제 PC 볼륨이 바뀝니다.

## 사용법

| 조작 | 동작 |
|---|---|
| 구슬 끌기, 휠, ← → 키 | 볼륨 조절. 구슬 왼쪽은 밤, 오른쪽은 낮 |
| 고양이·강아지 끌기 | 들어서 옮기기. 침대 위나 바닥에 내려앉음 |
| 고양이·강아지 클릭 또는 문지르기 | 쓰다듬기 |

고양이와 강아지는 스스로 돌아다니고, 서 있는 자리가 밤이 되면 그 자리에서 잠듭니다. 둘은 코 인사, 잡기 놀이, 침대 실랑이, 나란히 앉기를 합니다.

## Windows 앱 설치

1. 사이트의 다운로드 버튼이나 [Releases](../../releases/latest)에서 `DaybreakSwitch-setup.exe`를 받습니다.
2. 실행합니다. 코드 서명이 없어 "Windows의 PC 보호" 창이 뜨면 **추가 정보 → 실행**을 누릅니다.
3. 설치가 끝나면 트레이에 아이콘이 생깁니다. 이제 키보드 볼륨 키를 누르면 슬라이더가 뜹니다.

- 배경 소리(귀뚜라미, 새소리, 화음)는 본 창을 열어 두었을 때만 납니다. 볼륨 키로 뜨는 작은 팝업은 소리를 내지 않습니다.
- 창을 닫아도 트레이에 남아 볼륨 키를 받습니다. 끄려면 트레이 아이콘 → 종료.

## 기술

외부 라이브러리 없이 만들었습니다.

| 파일 | 역할 |
|---|---|
| `src/scene.js` | 2D 픽셀 버퍼(384×64)에 방을 코드로 그림. 열마다 밤/낮 시간을 따로 계산 |
| `src/pets.js` | 고양이·강아지 행동, 자세, 상호작용 |
| `src/glass.js` | raw WebGL2 셰이더. 유리 베젤, 물방울 손잡이의 굴절과 색수차 |
| `src/switch.js` | 입력, 스프링 움직임, 프레임 루프 |
| `src/audio.js` | Web Audio 합성 소리 (샘플 파일 없음) |
| `src-tauri/` | Windows 앱 (Tauri v2, Rust). 볼륨 키 가로채기, Core Audio로 시스템 볼륨 제어 |

### 직접 빌드

```
node tools/serve.mjs          # 개발 서버 http://localhost:5321
node tools/bundle.mjs         # 한 파일짜리 HTML (dist/daybreak-switch.html)
cargo tauri build             # Windows 설치 파일 (Rust, VS Build Tools, tauri-cli 필요)
```
