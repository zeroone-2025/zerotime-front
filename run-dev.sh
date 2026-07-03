#!/bin/bash

# ZeroTime Front — 웹 개발 서버 실행 (크로스 플랫폼: macOS/Linux)
# 역할: 의존성 확인 → .env.local 준비(localhost 고정) → 백엔드 확인 → next dev
#
# iOS 관심사(빌드, cap sync, 시뮬레이터, 실기기용 LAN IP 주입)는 전부 ./run-ios.sh 몫이다 —
# 이 스크립트에 다시 들이지 않는다. 하네스의 ./dev.sh front가 이 스크립트로 위임한다.

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

cd "$(dirname "$0")"

# 1. Node.js 확인
if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ Node.js가 설치되지 않았습니다${NC}"
    echo -e "${YELLOW}Node.js를 설치해주세요: https://nodejs.org/${NC}"
    exit 1
fi

# 2. 의존성 설치 (없거나 package.json이 더 새것일 때만)
if [ ! -d node_modules ] || [ package.json -nt node_modules ]; then
    echo -e "${YELLOW}의존성 설치 중...${NC}"
    npm install
fi

# 3. .env.local 준비 — 웹 개발은 localhost 기준
#    (실기기 테스트용 LAN IP는 run-ios.sh가 빌드 시점에 주입하므로 여기서 감지하지 않는다)
if [ ! -f .env.local ]; then
    cp .env.sample .env.local
    # sed -i.bak + rm: GNU(Linux)·BSD(macOS) sed 모두에서 동작하는 in-place 방식
    sed -i.bak "s/YOUR_LOCAL_IP/localhost/g" .env.local && rm -f .env.local.bak
    echo -e "${GREEN}✓ .env.local 생성 (API: localhost 기준)${NC}"
fi

# 4. 백엔드 확인 — 경고만 하고 막지 않는다 (next dev 자체는 백엔드 없이도 뜨고,
#    ./dev.sh 풀스택에서는 백엔드가 옆 패널에서 아직 뜨는 중일 수 있다)
if curl -sf -o /dev/null http://localhost:8080/health 2>/dev/null; then
    echo -e "${GREEN}✓ 백엔드 API 서버 실행 중 (http://localhost:8080)${NC}"
else
    echo -e "${YELLOW}⚠ 백엔드 응답 없음 — 필요하면 ../zerotime-back/run-dev.sh (또는 하네스 ./dev.sh back)${NC}"
fi

# 5. 개발 서버 실행
echo -e "${GREEN}프론트엔드: http://localhost:3000${NC}"
echo -e "${YELLOW}iOS 개발은 ./run-ios.sh (macOS)${NC}\n"
exec npm run dev
