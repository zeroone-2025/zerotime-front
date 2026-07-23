"""
E2E용 웹 refresh 토큰 발급 스크립트 (백엔드 컨테이너 안에서 실행).

시드된 유저의 account_subject로 백엔드 로그인과 동일한 방식의 웹 refresh 토큰을
발급한다(RefreshTokenService.create_refresh_token — Redis에 14일 TTL로 기록).
발급된 opaque 토큰 문자열만 stdout에 출력한다(개행/부가정보 없음).
SECRET_KEY 등 시크릿은 절대 출력하지 않는다 — 토큰만.

사용:
    docker exec -i zerotime-api-local python - <email> < e2e/backend/issue_web_refresh_token.py

이 토큰을 브라우저의 `refresh_token` 쿠키(path=/auth)로 심으면, 프론트 부팅 시
POST /auth/refresh 가 이를 교환해 access JWT를 메모리에 올린다(로그인 상태 복원).
"""

import sys

from app.databases import SessionLocal, get_redis
from app.databases.models import User
from app.services.refresh_token import RefreshTokenService


def main():
    if len(sys.argv) < 2 or not sys.argv[1].strip():
        print("USAGE: python - <email>", file=sys.stderr)
        sys.exit(2)
    email = sys.argv[1].strip()

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if user is None:
            print(f"USER_NOT_FOUND: {email}", file=sys.stderr)
            sys.exit(1)
        if not user.account_subject or not user.auth_version:
            print(f"USER_NOT_TOKEN_ELIGIBLE: {email}", file=sys.stderr)
            sys.exit(1)
        redis_client = get_redis()
        token = RefreshTokenService(redis_client).create_refresh_token(
            user.account_subject, auth_version=user.auth_version
        )
    finally:
        db.close()

    # 토큰만 출력(개행 없이) — 호출부에서 trim해 쿠키 값으로 사용
    sys.stdout.write(token)


if __name__ == "__main__":
    main()
