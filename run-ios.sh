#!/bin/bash

# ZeroTime Front — iOS 개발 스크립트 (macOS 전용)
# 역할: API 환경 선택 → 빌드(환경변수 주입) → cap sync → Xcode·시뮬레이터 실행
#
# 사용법:
#   ./run-ios.sh              # 개발 기본값 local로 바로 실행 (메뉴 없음)
#   ./run-ios.sh beta         # 릴리스 검증용 인자 (local | beta | prod)
#   ./run-ios.sh down         # 개발·테스트 종료 — 시뮬레이터 종료 (백엔드는 ../dev.sh down)
#
# 환경 3개 (dev-api는 앱에서 쓰지 않는다 — 웹 전용):
#   local — 로컬 백엔드(../dev.sh back). 릴리스 매니페스트 없이 웹 동작으로 강등되는
#           개발 전용 빌드 (app/_lib/native/nativeLocalDev.ts). 시뮬레이터 전용 —
#           실기기는 ATS(http 차단) 때문에 불가. 게스트 플로우 전용 — 로그인·푸시 등
#           네이티브 인증이 필요한 기능은 동작하지 않는다 (검증은 beta에서).
#   beta  — beta-api (TestFlight plane) / prod — api (App Store plane)
#
# API URL은 빌드 시점에 NEXT_PUBLIC_API_BASE_URL_NATIVE로 주입한다 —
# .env.local을 고쳐 쓰지 않으므로 환경을 바꿔도 개인 설정 파일에 흔적이 남지 않는다.
# 시뮬레이터 기기는 SIM_DEVICE 환경변수로 변경 가능 (기본: iPhone 17 Pro).

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

cd "$(dirname "$0")"

if [ "$(uname)" != "Darwin" ]; then
    echo -e "${RED}✗ 이 스크립트는 macOS 전용입니다 (Xcode·시뮬레이터 필요)${NC}"
    echo -e "${YELLOW}웹 개발은 ./run-dev.sh 를 사용하세요${NC}"
    exit 1
fi

SIM_DEVICE="${SIM_DEVICE:-iPhone 17 Pro}"

# 1. 모드 결정 — 무인자는 개발 기본값 local. beta/prod는 릴리스 검증용 인자.
choice="${1:-local}"

case "$choice" in
    down)
        # 개발·테스트 종료 — 시뮬레이터만 정리한다. Xcode는 열린 작업이 있을 수 있어
        # 건드리지 않고, 백엔드 컨테이너는 하네스 ../dev.sh down 몫.
        echo -e "${YELLOW}iOS 시뮬레이터 종료 중...${NC}"
        xcrun simctl shutdown all >/dev/null 2>&1 || true
        osascript -e 'quit app "Simulator"' >/dev/null 2>&1 || true
        echo -e "${GREEN}✓ 시뮬레이터 종료 완료${NC}"
        echo -e "  백엔드 종료는 하네스 루트에서 ${CYAN}./dev.sh down${NC}, Xcode는 직접 닫으세요"
        exit 0
        ;;
    local)
        API_URL="${LOCAL_API_ORIGIN:-http://localhost:8080}"
        ENV_NAME="로컬(시뮬레이터 전용)"; RELEASE_PLANE="local"
        echo -e "${YELLOW}⚠ 로컬 개발 모드 — 웹 동작으로 강등된 개발 전용 빌드입니다.${NC}"
        echo -e "${YELLOW}  게스트 플로우 전용: 로그인·푸시 등 네이티브 인증 기능은 동작하지 않습니다 (검증은 beta).${NC}"
        echo -e "${YELLOW}  실기기는 ATS가 http를 차단하므로 시뮬레이터에서만 동작합니다.${NC}"
        ;;
    dev)
        echo -e "${RED}✗ dev-api는 앱에서 쓰지 않습니다 (웹 전용) — 로컬 백엔드는 local, 실서버 테스트는 beta를 쓰세요${NC}"
        exit 1
        ;;
    beta) API_URL="https://beta-api.zerotime.kr"; ENV_NAME="베타"; RELEASE_PLANE="beta" ;;
    prod) API_URL="https://api.zerotime.kr";      ENV_NAME="프로덕션"; RELEASE_PLANE="prod" ;;
    *)
        echo -e "${RED}✗ 잘못된 인자입니다: ${choice} (local | beta | prod | down)${NC}"
        exit 1
        ;;
esac

echo -e "${GREEN}✓ ${ENV_NAME} 환경: ${API_URL}${NC}"

# 2. 의존성·.env.local 준비 (run-dev.sh 없이 단독 실행해도 되도록)
if [ ! -d node_modules ] || [ package.json -nt node_modules ]; then
    echo -e "${YELLOW}의존성 설치 중...${NC}"
    npm install
fi
if [ ! -f .env.local ]; then
    cp .env.sample .env.local
    sed -i.bak "s/YOUR_LOCAL_IP/localhost/g" .env.local && rm -f .env.local.bak
    echo -e "${GREEN}✓ .env.local 생성${NC}"
fi

# 3. Next.js 빌드 — API URL·매니페스트는 여기서만 주입 (.env.local의 값보다 우선한다)
echo -e "\n${YELLOW}Next.js 빌드 중... (API: ${API_URL})${NC}"
# verified-links 게이트: Apple Team ID는 Xcode 프로젝트의 실제 값,
# Android 지문은 iOS 실행과 무관하므로 형식만 유효한 자리표시자
APPLE_TEAM_ID=$(sed -n 's/.*DEVELOPMENT_TEAM = \([^;]*\);.*/\1/p' ios/App/App.xcodeproj/project.pbxproj | head -1 | tr -d ' ')
PLACEHOLDER_ANDROID_FP=$(printf '00:%.0s' $(seq 31))00

# verified-links 문서 생성 (public/.well-known/ — 커밋하지 않는 생성물, runbook 참조)
MOBILE_RELEASE_APPLE_TEAM_ID="$APPLE_TEAM_ID" \
MOBILE_RELEASE_ANDROID_CERT_SHA256_FINGERPRINTS="$PLACEHOLDER_ANDROID_FP" \
npm run verified-links:generate

if [ "$RELEASE_PLANE" = "local" ]; then
    # 로컬 개발 모드 — 릴리스 매니페스트를 주입하지 않는다. 네이티브 런타임은
    # app/_lib/native/nativeLocalDev.ts의 fail-closed 검증(로컬 http origin만 허용)을
    # 거쳐 웹 동작으로 강등된다 — 실서버로 붙는 매니페스트 없는 빌드는 존재할 수 없다.
    CAPACITOR_BUILD=true \
    MOBILE_RELEASE_APPLE_TEAM_ID="$APPLE_TEAM_ID" \
    MOBILE_RELEASE_ANDROID_CERT_SHA256_FINGERPRINTS="$PLACEHOLDER_ANDROID_FP" \
    NEXT_PUBLIC_NATIVE_LOCAL_DEV="true" \
    NEXT_PUBLIC_API_BASE_URL_WEB="$API_URL" \
    npm run build
else
    # 릴리스 매니페스트 env 15개 전부를 주입해야 네이티브 개인정보 장벽을 통과한다
    # (검증 규칙: app/_lib/native/mobileRelease.ts). 값의 출처:
    #   - frontend git sha / 버전·빌드 번호 / 계약 해시 → 이 repo에서 추출
    #   - 백엔드 신원(git sha·이미지 digest·배포 ID·배포 시각) → /health/release 구현 전까지
    #     형식만 유효한 자리표시자. ⚠ 스토어 제출용 아티팩트에는 runbook에 따라 실제 값 필요.
    FRONTEND_GIT_SHA=$(git rev-parse HEAD)
    CONTRACT_SHA256=$(grep -o "[0-9a-f]\{64\}" app/_lib/native/mobileRelease.ts | head -1)
    APP_VERSION=$(sed -n 's/.*MARKETING_VERSION = \(.*\);/\1/p' ios/App/App.xcodeproj/project.pbxproj | head -1 | tr -d ' ')
    BUILD_NUMBER=$(sed -n 's/.*CURRENT_PROJECT_VERSION = \(.*\);/\1/p' ios/App/App.xcodeproj/project.pbxproj | head -1 | tr -d ' ')
    PLACEHOLDER_SHA=$(printf '0%.0s' $(seq 40))
    PLACEHOLDER_DIGEST="sha256:$(printf '0%.0s' $(seq 64))"
    echo -e "${YELLOW}⚠ 백엔드 신원은 자리표시자입니다 — 스토어 제출용 빌드에는 사용 금지 (runbook 참조)${NC}"

    CAPACITOR_BUILD=true \
    MOBILE_RELEASE_APPLE_TEAM_ID="$APPLE_TEAM_ID" \
    MOBILE_RELEASE_ANDROID_CERT_SHA256_FINGERPRINTS="$PLACEHOLDER_ANDROID_FP" \
    NEXT_PUBLIC_API_BASE_URL_NATIVE="$API_URL" \
    NEXT_PUBLIC_MOBILE_RELEASE_ARTIFACT="native" \
    NEXT_PUBLIC_MOBILE_RELEASE_PLANE="$RELEASE_PLANE" \
    NEXT_PUBLIC_MOBILE_RELEASE_FRONTEND_GIT_SHA="$FRONTEND_GIT_SHA" \
    NEXT_PUBLIC_MOBILE_RELEASE_BACKEND_GIT_SHA="$PLACEHOLDER_SHA" \
    NEXT_PUBLIC_MOBILE_RELEASE_BACKEND_IMAGE_DIGEST="$PLACEHOLDER_DIGEST" \
    NEXT_PUBLIC_MOBILE_RELEASE_BACKEND_DEPLOYMENT_ID="simulator-unverified" \
    NEXT_PUBLIC_MOBILE_RELEASE_BACKEND_DEPLOYED_AT_UTC="$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    NEXT_PUBLIC_MOBILE_RELEASE_CONTRACT_VERSION="mobile-release.v1" \
    NEXT_PUBLIC_MOBILE_RELEASE_CONTRACT_SHA256="$CONTRACT_SHA256" \
    NEXT_PUBLIC_MOBILE_RELEASE_FIREBASE_PROJECT_ID="zerotime-${RELEASE_PLANE}" \
    NEXT_PUBLIC_MOBILE_RELEASE_PLATFORM="ios" \
    NEXT_PUBLIC_MOBILE_RELEASE_APP_VERSION="$APP_VERSION" \
    NEXT_PUBLIC_MOBILE_RELEASE_BUILD_NUMBER="$BUILD_NUMBER" \
    NEXT_PUBLIC_MOBILE_RELEASE_BUNDLE_ID="kr.zerotime.app" \
    npm run build
fi
echo -e "${GREEN}✓ 빌드 완료${NC}"

# 4. Capacitor 동기화
echo -e "\n${YELLOW}Capacitor 동기화 중...${NC}"
npx cap sync ios
echo -e "${GREEN}✓ 동기화 완료${NC}"

# 5. Xcode·시뮬레이터 실행
if [ -d "ios/App/App.xcworkspace" ]; then
    open ios/App/App.xcworkspace
elif [ -d "ios/App/App.xcodeproj" ]; then
    open ios/App/App.xcodeproj
else
    echo -e "${RED}✗ Xcode 프로젝트를 찾을 수 없습니다${NC}"
    exit 1
fi

xcrun simctl boot "$SIM_DEVICE" 2>/dev/null || echo -e "${YELLOW}⚠ 시뮬레이터가 이미 실행 중이거나 '${SIM_DEVICE}' 기기를 찾을 수 없습니다${NC}"
open -a Simulator

echo -e "\n${GREEN}✓ iOS 개발 환경 준비 완료${NC}"
echo -e "  • API: ${ENV_NAME} (${API_URL})"
echo -e "  • 시뮬레이터: ${SIM_DEVICE}"
echo -e "${YELLOW}Xcode에서 앱을 빌드·실행하세요 (⌘+R)${NC}"
