#!/bin/bash

# ZeroTime Front — Android 개발 스크립트
# 역할: API 환경 선택 → 빌드(환경변수 주입) → cap sync → 에뮬레이터·앱 실행
#
# 사용법:
#   ./run-android.sh              # 환경을 메뉴로 선택
#   ./run-android.sh beta         # 인자로 지정 (local | dev | beta | prod) — 자동화·재실행용
#
# API URL은 빌드 시점에 NEXT_PUBLIC_API_BASE_URL_NATIVE로 주입한다 (run-ios.sh와 동일 원리) —
# .env.local을 고쳐 쓰지 않으므로 환경을 바꿔도 개인 설정 파일에 흔적이 남지 않는다.
# 에뮬레이터 기기는 ANDROID_AVD 환경변수로 변경 가능 (기본: 첫 번째 AVD).
#
# ⚠ iOS와 동시 테스트 시: platform이 빌드 산출물(out/)에 박히므로 out/을 두 플랫폼이
#   공유할 수 없다. 이 스크립트 완주 후 run-ios.sh를 돌리면 된다 — cap sync가 산출물을
#   각 플랫폼 프로젝트로 복사하므로, sync 이후 out/이 덮여도 실행 중인 앱에는 영향 없다.

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

cd "$(dirname "$0")"

# 1. API 환경 결정 — 인자 우선, 없으면 메뉴
choice="${1:-}"
if [ -z "$choice" ]; then
    echo -e "${CYAN}API 환경을 선택하세요:${NC}\n"
    echo -e "  ${GREEN}1)${NC} local — 로컬 백엔드 (LAN IP 자동 감지, 실기기 접속 가능)"
    echo -e "  ${GREEN}2)${NC} dev   — https://dev-api.zerotime.kr"
    echo -e "  ${GREEN}3)${NC} beta  — https://beta-api.zerotime.kr"
    echo -e "  ${GREEN}4)${NC} prod  — https://api.zerotime.kr"
    echo ""
    read -p "선택 (1-4): " choice
fi

case "$choice" in
    1|local|2|dev)
        # 네이티브 계약(app/_lib/native/mobileRelease.ts)상 네이티브 런타임은
        # beta/prod plane만 허용된다 — local/dev API로 붙는 네이티브 빌드는 존재할 수 없다.
        echo -e "${YELLOW}⚠ 네이티브 앱은 개인정보 장벽 때문에 beta/prod plane만 실행 가능합니다 — beta plane으로 진행합니다${NC}"
        API_URL="https://beta-api.zerotime.kr"; ENV_NAME="베타(개발 실행)"; RELEASE_PLANE="beta"
        ;;
    3|beta) API_URL="https://beta-api.zerotime.kr"; ENV_NAME="베타"; RELEASE_PLANE="beta" ;;
    4|prod) API_URL="https://api.zerotime.kr";      ENV_NAME="프로덕션"; RELEASE_PLANE="prod" ;;
    *)
        echo -e "${RED}✗ 잘못된 선택입니다: ${choice} (local | dev | beta | prod)${NC}"
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

# 3. Next.js 빌드 — NATIVE URL은 여기서만 주입 (.env.local의 값보다 우선한다)
echo -e "\n${YELLOW}Next.js 빌드 중... (API: ${API_URL})${NC}"
# 릴리스 매니페스트 env 15개 전부를 주입해야 네이티브 개인정보 장벽을 통과한다
# (검증 규칙: app/_lib/native/mobileRelease.ts). 값의 출처:
#   - frontend git sha / 계약 해시 → 이 repo에서 추출
#   - 버전·빌드 번호 → android/app/build.gradle의 versionName/versionCode
#   - 백엔드 신원(git sha·이미지 digest·배포 ID·배포 시각) → /health/release 구현 전까지
#     형식만 유효한 자리표시자. ⚠ 스토어 제출용 아티팩트에는 runbook에 따라 실제 값 필요
#     (release 빌드는 build.gradle의 provenance 검증 게이트가 자리표시자를 거부한다).
FRONTEND_GIT_SHA=$(git rev-parse HEAD)
CONTRACT_SHA256=$(grep -o "[0-9a-f]\{64\}" app/_lib/native/mobileRelease.ts | head -1)
APP_VERSION=$(sed -n 's/.*versionName "\(.*\)"/\1/p' android/app/build.gradle | head -1)
BUILD_NUMBER=$(sed -n 's/.*versionCode \([0-9][0-9]*\).*/\1/p' android/app/build.gradle | head -1)
PLACEHOLDER_SHA=$(printf '0%.0s' $(seq 40))
PLACEHOLDER_DIGEST="sha256:$(printf '0%.0s' $(seq 64))"
echo -e "${YELLOW}⚠ 백엔드 신원은 자리표시자입니다 — 스토어 제출용 빌드에는 사용 금지 (runbook 참조)${NC}"

# 검증된 링크(/.well-known/) 생성용 서명 신원 (prebuild 게이트가 요구, scripts/generate-verified-links.mjs):
#   - Apple Team ID → 미지정 시 형식만 유효한 자리표시자 (에뮬레이터 테스트에는 영향 없음)
#   - Android 서명 지문 → 미지정 시 debug keystore에서 실제 지문 추출, 그것도 없으면 자리표시자
if [ -z "${MOBILE_RELEASE_APPLE_TEAM_ID:-}" ]; then
    export MOBILE_RELEASE_APPLE_TEAM_ID="0000000000"
    echo -e "${YELLOW}⚠ Apple Team ID 자리표시자 사용 — 스토어 제출용 빌드에는 실제 값 필요${NC}"
fi
if [ -z "${MOBILE_RELEASE_ANDROID_CERT_SHA256_FINGERPRINTS:-}" ]; then
    DEBUG_KEYSTORE="$HOME/.android/debug.keystore"
    DEBUG_FP=""
    if [ -f "$DEBUG_KEYSTORE" ] && command -v keytool >/dev/null 2>&1; then
        DEBUG_FP=$(keytool -list -v -keystore "$DEBUG_KEYSTORE" -alias androiddebugkey -storepass android 2>/dev/null \
            | sed -n 's/.*SHA256: \([A-F0-9:]*\).*/\1/p' | head -1)
    fi
    if [ -n "$DEBUG_FP" ]; then
        echo -e "${GREEN}✓ Android 서명 지문: debug keystore에서 추출${NC}"
    else
        DEBUG_FP="$(printf '00:%.0s' $(seq 31))00"
        echo -e "${YELLOW}⚠ Android 서명 지문 자리표시자 사용 — 스토어 제출용 빌드에는 실제 값 필요${NC}"
    fi
    export MOBILE_RELEASE_ANDROID_CERT_SHA256_FINGERPRINTS="$DEBUG_FP"
fi

# 검증된 링크 생성 — prebuild 게이트가 /.well-known/ 생성물과 서명 신원의 일치를 검사한다
npm run verified-links:generate

CAPACITOR_BUILD=true \
NEXT_PUBLIC_API_BASE_URL_NATIVE="$API_URL" \
NEXT_PUBLIC_MOBILE_RELEASE_ARTIFACT="native" \
NEXT_PUBLIC_MOBILE_RELEASE_PLANE="$RELEASE_PLANE" \
NEXT_PUBLIC_MOBILE_RELEASE_FRONTEND_GIT_SHA="$FRONTEND_GIT_SHA" \
NEXT_PUBLIC_MOBILE_RELEASE_BACKEND_GIT_SHA="$PLACEHOLDER_SHA" \
NEXT_PUBLIC_MOBILE_RELEASE_BACKEND_IMAGE_DIGEST="$PLACEHOLDER_DIGEST" \
NEXT_PUBLIC_MOBILE_RELEASE_BACKEND_DEPLOYMENT_ID="emulator-unverified" \
NEXT_PUBLIC_MOBILE_RELEASE_BACKEND_DEPLOYED_AT_UTC="$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
NEXT_PUBLIC_MOBILE_RELEASE_CONTRACT_VERSION="mobile-release.v1" \
NEXT_PUBLIC_MOBILE_RELEASE_CONTRACT_SHA256="$CONTRACT_SHA256" \
NEXT_PUBLIC_MOBILE_RELEASE_FIREBASE_PROJECT_ID="zerotime-${RELEASE_PLANE}" \
NEXT_PUBLIC_MOBILE_RELEASE_PLATFORM="android" \
NEXT_PUBLIC_MOBILE_RELEASE_APP_VERSION="$APP_VERSION" \
NEXT_PUBLIC_MOBILE_RELEASE_BUILD_NUMBER="$BUILD_NUMBER" \
NEXT_PUBLIC_MOBILE_RELEASE_BUNDLE_ID="kr.zerotime.app" \
npm run build
echo -e "${GREEN}✓ 빌드 완료${NC}"

# 4. Capacitor 동기화
echo -e "\n${YELLOW}Capacitor 동기화 중...${NC}"
npx cap sync android
echo -e "${GREEN}✓ 동기화 완료${NC}"

# 5. Android SDK 확인 — 없으면 여기서 안내 후 종료 (빌드·sync는 이미 끝난 상태)
ANDROID_SDK="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
if [ ! -d "$ANDROID_SDK" ]; then
    echo -e "\n${RED}✗ Android SDK를 찾을 수 없습니다 (ANDROID_HOME 미설정, ${ANDROID_SDK} 없음)${NC}"
    echo -e "${YELLOW}설치 방법:${NC}"
    echo -e "  1. brew install --cask android-studio"
    echo -e "  2. Android Studio 첫 실행 마법사에서 SDK·platform-tools·emulator 설치"
    echo -e "  3. Device Manager에서 AVD(가상 기기) 생성"
    echo -e "  4. ~/.zshrc에 추가: export ANDROID_HOME=\"\$HOME/Library/Android/sdk\""
    echo -e "설치 후 이 스크립트를 다시 실행하면 이어서 진행됩니다."
    exit 1
fi
export ANDROID_HOME="$ANDROID_SDK"
export PATH="$ANDROID_SDK/platform-tools:$ANDROID_SDK/emulator:$PATH"

# gradle이 시스템 JDK와 안 맞을 수 있어 Android Studio 내장 JBR이 있으면 우선 사용한다
STUDIO_JBR="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
if [ -d "$STUDIO_JBR" ]; then
    export JAVA_HOME="$STUDIO_JBR"
fi

# 푸시(FCM) 설정 확인 — 없어도 debug 빌드·화면 테스트는 되지만 알림 플로우는 동작하지 않는다
if [ ! -f "android/app/src/dev/debug/google-services.json" ] && [ ! -f "android/app/src/dev/google-services.json" ]; then
    echo -e "${YELLOW}⚠ google-services.json 없음 — Firebase(푸시 알림)는 비활성 상태로 실행됩니다${NC}"
fi

# 6. 에뮬레이터 기동 (이미 떠 있으면 재사용)
if ! adb devices | grep -q "^emulator-.*device$"; then
    AVD="${ANDROID_AVD:-$(emulator -list-avds 2>/dev/null | head -1)}"
    if [ -z "$AVD" ]; then
        echo -e "${RED}✗ AVD가 없습니다 — Android Studio > Device Manager에서 가상 기기를 만드세요${NC}"
        exit 1
    fi
    echo -e "\n${YELLOW}에뮬레이터 기동 중... (${AVD})${NC}"
    emulator -avd "$AVD" >/dev/null 2>&1 &
    adb wait-for-device
    until [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; do
        sleep 2
    done
    echo -e "${GREEN}✓ 에뮬레이터 부팅 완료${NC}"
fi

# 7. 앱 빌드·설치·실행 — debug 빌드(provenance 게이트 없음), flavor는 plane과 일치시킨다
TARGET=$(adb devices | sed -n 's/^\(emulator-[0-9]*\)[[:space:]]*device$/\1/p' | head -1)
echo -e "\n${YELLOW}앱 빌드·설치 중... (${RELEASE_PLANE}Debug)${NC}"
npx cap run android --flavor "$RELEASE_PLANE" ${TARGET:+--target "$TARGET"}

echo -e "\n${GREEN}✓ Android 개발 환경 준비 완료${NC}"
echo -e "  • API: ${ENV_NAME} (${API_URL})"
echo -e "  • flavor: ${RELEASE_PLANE}Debug"
echo -e "${YELLOW}코드 수정 후에는 이 스크립트를 다시 실행하세요 (빌드 → sync → 재설치)${NC}"
