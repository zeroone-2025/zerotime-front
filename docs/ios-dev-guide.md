# iOS 개발 스크립트 사용법

## run-ios.sh

iOS 시뮬레이터·실기기에서 앱을 실행하기 위한 스크립트입니다 (macOS 전용).
API 환경을 선택하면 빌드/동기화/실행까지 자동으로 진행합니다.

### 사용 방법

```bash
./run-ios.sh              # 환경을 메뉴로 선택
./run-ios.sh local        # 인자로 지정 — local | beta | prod
```

### 실행 과정

1. **API 환경 선택** (dev-api는 앱에서 쓰지 않습니다 — 웹 전용)
   - `local` - 로컬 백엔드 http://localhost:8080 (시뮬레이터 전용, 개발 전용 빌드)
   - `beta` - 베타 서버 (https://beta-api.zerotime.kr — TestFlight plane)
   - `prod` - 프로덕션 서버 (https://api.zerotime.kr — App Store plane)

2. **자동 실행 단계**
   - Next.js 빌드 — 선택한 환경을 **빌드 시점에 주입** (`.env.local`은 수정하지 않음).
     beta/prod는 릴리스 매니페스트 15개, local은 로컬 개발 플래그만 주입
   - Capacitor 동기화 (`npx cap sync ios`)
   - Xcode 프로젝트 열기
   - iOS 시뮬레이터 실행 (기본: iPhone 17 Pro)

3. **Xcode에서 빌드**
   - Xcode가 열리면 `⌘+R`을 눌러 앱 실행

### 환경별 사용 시나리오

#### local
- 백엔드 API를 이 Mac에서 실행 중일 때 (하네스의 `../dev.sh back`)
- 최신 API·프론트 변경사항을 develop push 없이 즉시 테스트
- 릴리스 매니페스트 없이 웹 동작으로 강등되는 개발 전용 빌드
  (`app/_lib/native/nativeLocalDev.ts` — 로컬 http origin만 허용, 푸시 등 네이티브 전용 기능 비활성)
- **시뮬레이터 전용** — 실기기는 ATS가 http를 차단하므로 붙지 않습니다.
  실기기 테스트는 beta를 사용 (LAN IP가 필요하면 `LOCAL_API_ORIGIN=http://<LAN IP>:8080`
  으로 넘길 수 있지만 iOS 실기기에서는 ATS 예외 없이는 동작하지 않음)

#### beta
- 실기기·TestFlight plane 검증, 푸시 등 네이티브 기능 테스트

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
SIM_DEVICE="iPhone 16" ./run-ios.sh beta
```

**Xcode 프로젝트를 찾을 수 없음:**
```bash
npx cap sync ios
```
Capacitor 프로젝트를 먼저 동기화

## 웹 개발은 run-dev.sh

웹만 개발할 때는 `./run-dev.sh` — 크로스 플랫폼(macOS/Linux)이며 iOS 단계 없이
`next dev`(localhost:3000)만 띄웁니다. 하네스의 `./dev.sh front`가 이 스크립트를 사용합니다.
