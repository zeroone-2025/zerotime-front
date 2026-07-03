# iOS 개발 스크립트 사용법

## run-ios.sh

iOS 시뮬레이터에서 앱을 실행하기 위한 스크립트입니다. API 환경을 선택하고 자동으로 빌드/동기화/실행합니다.

### 사용 방법

```bash
./run-ios.sh
```

### 실행 과정

1. **API 환경 선택**
   - `1` - 로컬 개발 서버 (http://localhost:8080)
   - `2` - 개발 서버 (https://dev-api.zerotime.kr)
   - `3` - 프로덕션 서버 (https://api.zerotime.kr)

2. **자동 실행 단계**
   - `.env.local` 파일의 `NEXT_PUBLIC_API_BASE_URL_NATIVE` 업데이트
   - Next.js 프로젝트 빌드 (`npm run build`)
   - Capacitor 동기화 (`npx cap sync ios`)
   - Xcode 프로젝트 열기
   - iOS 시뮬레이터 실행 (iPhone 17 Pro)

3. **Xcode에서 빌드**
   - Xcode가 열리면 `⌘+R`을 눌러 앱 실행

### 환경별 사용 시나리오

#### 로컬 개발 (옵션 1)
- 백엔드 API를 로컬에서 실행 중일 때
- 최신 API 변경사항을 즉시 테스트
- 네트워크 연결 불필요

#### 개발 서버 (옵션 2)
- 팀과 공유된 개발 서버 사용
- 최신 개발 기능 테스트
- 네트워크 연결 필요

#### 프로덕션 서버 (옵션 3)
- 실제 운영 환경 테스트
- 최종 배포 전 검증
- 네트워크 연결 필요

### 주의사항

- 환경을 변경할 때마다 스크립트를 다시 실행해야 합니다
- `.env.local` 파일이 자동으로 업데이트됩니다
- 빌드 시간이 소요됩니다 (약 1-2분)

### 문제 해결

**시뮬레이터를 찾을 수 없음:**
```bash
xcrun simctl list devices | grep iPhone
```
위 명령어로 사용 가능한 시뮬레이터 확인 후 스크립트의 136번 줄 수정

**Xcode 프로젝트를 찾을 수 없음:**
```bash
npx cap sync ios
```
Capacitor 프로젝트를 먼저 동기화
