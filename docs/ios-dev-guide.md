# iOS 개발 스크립트 사용법

## run-ios.sh

iOS 시뮬레이터·실기기에서 앱을 실행하기 위한 스크립트입니다 (macOS 전용).
API 환경을 선택하면 빌드/동기화/실행까지 자동으로 진행합니다.

### 사용 방법

```bash
./run-ios.sh              # 환경을 메뉴로 선택
./run-ios.sh dev          # 인자로 지정 — local | dev | beta | prod
```

### 실행 과정

1. **API 환경 선택**
   - `local` - 로컬 백엔드 (Mac의 LAN IP 자동 감지 — 실기기에서도 접속 가능)
   - `dev` - 개발 서버 (https://dev-api.zerotime.kr)
   - `beta` - 베타 서버 (https://beta-api.zerotime.kr)
   - `prod` - 프로덕션 서버 (https://api.zerotime.kr)

2. **자동 실행 단계**
   - Next.js 빌드 — 선택한 API URL을 `NEXT_PUBLIC_API_BASE_URL_NATIVE`로
     **빌드 시점에 주입** (`.env.local`은 수정하지 않음)
   - Capacitor 동기화 (`npx cap sync ios`)
   - Xcode 프로젝트 열기
   - iOS 시뮬레이터 실행 (기본: iPhone 17 Pro)

3. **Xcode에서 빌드**
   - Xcode가 열리면 `⌘+R`을 눌러 앱 실행

### 환경별 사용 시나리오

#### local
- 백엔드 API를 이 Mac에서 실행 중일 때 (`../zerotime-back/run-dev.sh`)
- 최신 API 변경사항을 즉시 테스트
- LAN IP를 주입하므로 같은 네트워크의 실기기에서도 접속 가능

#### dev / beta
- 팀과 공유된 서버로 기능 테스트 (dev: 최신 개발, beta: 배포 후보 검증)

#### prod
- 실제 운영 환경 테스트, 최종 배포 전 검증

### 주의사항

- 환경을 변경하려면 스크립트를 다시 실행합니다 (앱에 박히는 URL이 빌드 시점에 결정되므로)
- `.env.local`은 건드리지 않습니다 — 웹 개발(`./run-dev.sh`)과 서로 간섭 없음
- 빌드 시간이 소요됩니다 (약 1-2분)

### 문제 해결

**시뮬레이터를 찾을 수 없음:**
```bash
xcrun simctl list devices | grep iPhone
```
사용 가능한 기기 확인 후 `SIM_DEVICE` 환경변수로 지정:
```bash
SIM_DEVICE="iPhone 16" ./run-ios.sh dev
```

**Xcode 프로젝트를 찾을 수 없음:**
```bash
npx cap sync ios
```
Capacitor 프로젝트를 먼저 동기화

## 웹 개발은 run-dev.sh

웹만 개발할 때는 `./run-dev.sh` — 크로스 플랫폼(macOS/Linux)이며 iOS 단계 없이
`next dev`(localhost:3000)만 띄웁니다. 하네스의 `./dev.sh front`가 이 스크립트를 사용합니다.
