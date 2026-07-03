#!/bin/bash

# JBNU Alarm App v1 - iOS Development Script
# iOS 시뮬레이터 실행 및 환경 설정 스크립트

set -e  # 에러 발생 시 스크립트 중단

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 프로젝트 루트 디렉토리로 이동
cd "$(dirname "$0")"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}JBNU Alarm App v1 - iOS Development${NC}"
echo -e "${BLUE}========================================${NC}\n"

# 1. 환경 선택
echo -e "${CYAN}[1/5] API 환경을 선택하세요:${NC}\n"
echo -e "  ${GREEN}1)${NC} 로컬 개발 서버 (http://localhost:8080)"
echo -e "  ${GREEN}2)${NC} 개발 서버 (https://dev-api.zerotime.kr)"
echo -e "  ${GREEN}3)${NC} 프로덕션 서버 (https://api.zerotime.kr)"
echo ""
read -p "선택 (1-3): " env_choice

case $env_choice in
    1)
        API_URL="http://localhost:8080"
        ENV_NAME="로컬"
        ;;
    2)
        API_URL="https://dev-api.zerotime.kr"
        ENV_NAME="개발"
        ;;
    3)
        API_URL="https://api.zerotime.kr"
        ENV_NAME="프로덕션"
        ;;
    *)
        echo -e "${RED}✗ 잘못된 선택입니다${NC}"
        exit 1
        ;;
esac

echo -e "${GREEN}✓ ${ENV_NAME} 환경 선택됨: ${API_URL}${NC}\n"

# 2. .env.local 파일 업데이트
echo -e "${YELLOW}[2/5] 환경 변수 설정 중...${NC}"

if [ ! -f ".env.local" ]; then
    echo -e "${YELLOW}.env.local 파일이 없습니다. .env.sample을 복사합니다...${NC}"
    cp .env.sample .env.local
fi

# .env.local 파일에서 NEXT_PUBLIC_API_BASE_URL_NATIVE 업데이트
if grep -q "NEXT_PUBLIC_API_BASE_URL_NATIVE" .env.local; then
    # 기존 값 업데이트 (macOS sed 문법)
    sed -i '' "s|NEXT_PUBLIC_API_BASE_URL_NATIVE=.*|NEXT_PUBLIC_API_BASE_URL_NATIVE=\"${API_URL}\"|" .env.local
else
    # 없으면 추가
    echo "NEXT_PUBLIC_API_BASE_URL_NATIVE=\"${API_URL}\"" >> .env.local
fi

echo -e "${GREEN}✓ API URL 설정 완료: ${API_URL}${NC}"

# 3. Next.js 빌드
echo -e "\n${YELLOW}[3/5] Next.js 프로젝트를 빌드합니다...${NC}"
npm run build
echo -e "${GREEN}✓ Next.js 빌드 완료${NC}"

# 4. Capacitor 동기화
echo -e "\n${YELLOW}[4/5] Capacitor 프로젝트를 동기화합니다...${NC}"
npx cap sync ios
echo -e "${GREEN}✓ Capacitor 동기화 완료${NC}"

# 5. Xcode 및 시뮬레이터 실행
echo -e "\n${YELLOW}[5/5] iOS 개발 환경을 실행합니다...${NC}"

# Xcode 프로젝트 열기
if [ -d "ios/App/App.xcworkspace" ]; then
    echo -e "${GREEN}✓ Xcode를 실행합니다...${NC}"
    open ios/App/App.xcworkspace
elif [ -d "ios/App/App.xcodeproj" ]; then
    echo -e "${GREEN}✓ Xcode를 실행합니다...${NC}"
    open ios/App/App.xcodeproj
else
    echo -e "${RED}✗ Xcode 프로젝트를 찾을 수 없습니다${NC}"
    exit 1
fi

# 시뮬레이터 실행 (iPhone 17 Pro)
echo -e "${GREEN}✓ iOS 시뮬레이터를 실행합니다...${NC}"
xcrun simctl boot "iPhone 17 Pro" 2>/dev/null || echo -e "${YELLOW}⚠ 시뮬레이터가 이미 실행 중이거나 기기를 찾을 수 없습니다${NC}"
open -a Simulator

# 완료 메시지
echo -e "\n${BLUE}========================================${NC}"
echo -e "${GREEN}✓ iOS 개발 환경 준비 완료!${NC}"
echo -e "${BLUE}========================================${NC}\n"
echo -e "${CYAN}환경 정보:${NC}"
echo -e "  • API 환경: ${ENV_NAME}"
echo -e "  • API URL: ${API_URL}"
echo -e "  • 시뮬레이터: iPhone 17 Pro\n"
echo -e "${YELLOW}Xcode에서 앱을 빌드하고 실행하세요 (⌘+R)${NC}\n"
