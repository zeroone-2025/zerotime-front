#!/bin/bash

# JBNU Alarm App v1 - Local Development Setup Script
# 로컬 개발 환경 세팅 및 실행 스크립트

set -e  # 에러 발생 시 스크립트 중단

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 프로젝트 루트 디렉토리로 이동
cd "$(dirname "$0")"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}JBNU Alarm App v1 - Development Setup${NC}"
echo -e "${BLUE}========================================${NC}\n"

# 1. Node.js 버전 확인
echo -e "${YELLOW}[1/4] Node.js 버전 확인 중...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ Node.js가 설치되지 않았습니다${NC}"
    echo -e "${YELLOW}Node.js를 설치해주세요: https://nodejs.org/${NC}"
    exit 1
fi

NODE_VERSION=$(node -v)
echo -e "${GREEN}✓ Node.js 버전: ${NODE_VERSION}${NC}"

# 2. 의존성 확인 및 설치
echo -e "\n${YELLOW}[2/4] 의존성 확인 중...${NC}"
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}node_modules가 없습니다. 의존성을 설치합니다...${NC}"
    npm install
    echo -e "${GREEN}✓ 의존성 설치 완료${NC}"
else
    # package.json이 변경되었는지 확인
    if [ "package.json" -nt "node_modules" ]; then
        echo -e "${YELLOW}package.json이 변경되었습니다. 의존성을 업데이트합니다...${NC}"
        npm install
        echo -e "${GREEN}✓ 의존성 업데이트 완료${NC}"
    else
        echo -e "${GREEN}✓ 의존성이 이미 설치되어 있습니다${NC}"
    fi
fi

# 3. 환경 변수 설정
echo -e "\n${YELLOW}[3/4] 환경 변수 확인 중...${NC}"

if [ ! -f ".env.local" ]; then
    echo -e "${YELLOW}.env.local 파일이 없습니다. .env.sample을 복사합니다...${NC}"
    cp .env.sample .env.local
    echo -e "${GREEN}✓ .env.local 파일 생성 완료${NC}"
    
    # 로컬 IP 주소 자동 감지 (macOS)
    LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "192.168.x.x")
    
    if [ "$LOCAL_IP" != "192.168.x.x" ]; then
        echo -e "${GREEN}✓ 로컬 IP 주소 감지: ${LOCAL_IP}${NC}"
        # .env.local 파일의 YOUR_LOCAL_IP를 실제 IP로 교체
        sed -i '' "s/YOUR_LOCAL_IP/${LOCAL_IP}/g" .env.local
        echo -e "${GREEN}✓ .env.local에 로컬 IP 주소 자동 설정 완료${NC}"
    else
        echo -e "${YELLOW}⚠ 로컬 IP 주소를 자동으로 감지하지 못했습니다${NC}"
        echo -e "${YELLOW}⚠ .env.local 파일에서 YOUR_LOCAL_IP를 수동으로 설정해주세요${NC}"
    fi
else
    echo -e "${GREEN}✓ .env.local 파일이 이미 존재합니다${NC}"
fi

# 환경 변수 확인
if [ -f ".env.local" ]; then
    echo -e "\n${BLUE}현재 환경 변수 설정:${NC}"
    while IFS= read -r line; do
        # 빈 줄이나 주석이 아닌 경우만 출력
        if [[ ! -z "$line" && ! "$line" =~ ^[[:space:]]*# ]]; then
            echo -e "${GREEN}  • ${line}${NC}"
        fi
    done < .env.local
fi

# 4. 백엔드 API 서버 확인
echo -e "\n${YELLOW}[4/4] 백엔드 API 서버 확인 중...${NC}"

# .env.local에서 API URL 추출 (따옴표 제거)
API_URL=$(grep "NEXT_PUBLIC_API_BASE_URL_WEB" .env.local | cut -d'=' -f2 | tr -d '"')

if [ -z "$API_URL" ]; then
    API_URL="http://localhost:8080"
fi

# API 서버 health check
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${API_URL}/health" 2>/dev/null || echo "000")

if [ "$HTTP_STATUS" = "200" ]; then
    echo -e "${GREEN}✓ 백엔드 API 서버가 실행 중입니다 (${API_URL})${NC}"
else
    echo -e "${YELLOW}⚠ 백엔드 API 서버에 연결할 수 없습니다 (${API_URL})${NC}"
    echo -e "${YELLOW}⚠ 백엔드 서버를 먼저 실행해주세요:${NC}"
    echo -e "${YELLOW}   cd ../zerotime-back && ./run-dev.sh${NC}\n"
    
    read -p "계속 진행하시겠습니까? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${RED}개발 서버 시작을 취소합니다${NC}"
        exit 1
    fi
fi

# 5. Next.js 빌드 (iOS 동기화를 위해)
if [ -d "ios" ]; then
    echo -e "\n${YELLOW}Next.js 프로젝트를 빌드합니다...${NC}"
    npm run build
    echo -e "${GREEN}✓ Next.js 빌드 완료${NC}"
fi

# 6. Capacitor 프로젝트 동기화 (항상 실행)
if [ -d "ios" ]; then
    echo -e "\n${YELLOW}Capacitor 프로젝트를 동기화합니다...${NC}"
    npx cap sync ios
    echo -e "${GREEN}✓ Capacitor 동기화 완료${NC}"
fi

# 7. iOS 시뮬레이터 실행 옵션
echo -e "\n${YELLOW}iOS 시뮬레이터를 실행하시겠습니까? (y/N): ${NC}"
if [ -t 0 ]; then
    read -p "" -n 1 -r
    echo
else
    REPLY="n"
    echo
fi

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}iOS 시뮬레이터를 실행합니다...${NC}"
    
    # Xcode 프로젝트 열기 (백그라운드)
    if [ -d "ios/App/App.xcworkspace" ]; then
        echo -e "${GREEN}✓ Xcode를 실행합니다...${NC}"
        open ios/App/App.xcworkspace
    elif [ -d "ios/App/App.xcodeproj" ]; then
        echo -e "${GREEN}✓ Xcode를 실행합니다...${NC}"
        open ios/App/App.xcodeproj
    fi
    
    # 시뮬레이터 실행 (iPhone 17 Pro, 다른 기기로 변경 가능)
    echo -e "${GREEN}✓ iOS 시뮬레이터를 실행합니다...${NC}"
    xcrun simctl boot "iPhone 17 Pro" 2>/dev/null || echo -e "${YELLOW}⚠ 시뮬레이터가 이미 실행 중이거나 기기를 찾을 수 없습니다${NC}"
    open -a Simulator
    
    echo -e "${GREEN}✓ Xcode와 시뮬레이터가 실행되었습니다${NC}"
    echo -e "${YELLOW}Xcode에서 앱을 빌드하고 실행하세요 (⌘+R)${NC}\n"
    
    # 시뮬레이터가 준비될 때까지 잠시 대기
    sleep 2
fi

# 6. 개발 서버 실행
echo -e "\n${BLUE}========================================${NC}"
echo -e "${GREEN}✓ 모든 설정이 완료되었습니다!${NC}"
echo -e "${BLUE}========================================${NC}\n"
echo -e "${GREEN}프론트엔드 서버 주소: http://localhost:3000${NC}"
echo -e "${GREEN}백엔드 API 서버: ${API_URL}${NC}\n"
echo -e "${YELLOW}서버를 중지하려면 Ctrl+C를 누르세요${NC}\n"

# Next.js 개발 서버 실행
npm run dev

