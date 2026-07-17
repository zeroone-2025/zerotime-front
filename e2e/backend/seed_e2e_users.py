"""
E2E 테스트 유저 시드 스크립트 (백엔드 컨테이너 안에서 실행).

로컬 DB에 로그인 E2E용 프리셋 유저 3종을 멱등하게 시드한다.
백엔드 repo 안이 아니라 프론트 worktree에 두고, 백엔드 코드(모델/세션)에는
컨테이너로 파이프해 접근한다:

    docker exec -i zerotime-api-local python - < e2e/backend/seed_e2e_users.py

stdout 마지막 줄에 프리셋별 결과를 JSON 한 줄로 출력한다(시크릿 없음: id/email/상태만).

프리셋(모두 person, account_state=active, auth_version=1 → 토큰 발급 가능):
  - onboarding_needed : 신규 가입 직후 상태 그대로(oauth_user.find_or_create_user 기준).
                        user_type=''(온보딩 미완료)/school=전북대 기본값, dept_code=NULL, admission_year=NULL.
  - onboarded_jbnu    : 온보딩 완료 전북대 유저. user_type/school/dept_code/admission_year 채움.
  - dept_skipped      : 온보딩은 진행했으나 학과를 건너뛴 유저.
                        user_type/school/admission_year 채움, dept_code=NULL.

멱등성: email로 조회해 없으면 생성(신원 컬럼 포함), 있으면 프로필 컬럼만 갱신한다.
account_subject/auth_version/actor_kind는 DB 트리거(trg_users_guard_identity_mutation)가
UPDATE를 막으므로 재실행 시 건드리지 않는다.
"""

import json
import sys
from uuid import uuid4

from app.databases import SessionLocal
from app.databases.connection import Base, engine
from app.databases.models import User, UserSubscription

try:
    from app.constants import DEFAULT_BOARD_CODES
except Exception:  # 상수 위치가 바뀌어도 시드는 계속되도록 방어
    DEFAULT_BOARD_CODES = []

# (email, preset key, 프로필 필드) — 신원 필드(account_subject 등)는 생성 시에만 세팅.
PRESETS = [
    {
        "email": "e2e-onboarding-needed@e2e.zerotime.kr",
        "preset": "onboarding_needed",
        "nickname": "E2E신규유저",
        "user_type": "",  # 신규 가입 상태(온보딩 미완료) — find_or_create_user SSOT 추종
        "school": "전북대",
        "dept_code": None,
        "admission_year": None,
    },
    {
        "email": "e2e-onboarded-jbnu@e2e.zerotime.kr",
        "preset": "onboarded_jbnu",
        "nickname": "E2E전북대유저",
        "user_type": "student",
        "school": "전북대",
        "dept_code": "dept_mechanical",  # departments 테이블의 실제 leaf 학과 코드
        "admission_year": 2021,
    },
    {
        "email": "e2e-dept-skipped@e2e.zerotime.kr",
        "preset": "dept_skipped",
        "nickname": "E2E학과건너뜀",
        "user_type": "student",
        "school": "전북대",
        "dept_code": None,  # 학과 선택 건너뜀
        "admission_year": 2023,
    },
]

PROFILE_FIELDS = ("nickname", "user_type", "school", "dept_code", "admission_year")


def _seed_default_subscriptions(db, user):
    if not DEFAULT_BOARD_CODES:
        return
    existing = {
        s.board_code
        for s in db.query(UserSubscription).filter(UserSubscription.user_id == user.id).all()
    }
    for board_code in DEFAULT_BOARD_CODES:
        if board_code not in existing:
            db.add(UserSubscription(user_id=user.id, board_code=board_code))


def upsert(db, spec):
    user = db.query(User).filter(User.email == spec["email"]).first()
    created = False
    if user is None:
        user = User(
            email=spec["email"],
            nickname=spec["nickname"],
            account_subject=str(uuid4()),  # 신원 컬럼 — 생성 시에만 세팅
            actor_kind="person",
            auth_version=1,
            account_state="active",
            is_active=True,
            user_type=spec["user_type"],
            school=spec["school"],
            dept_code=spec["dept_code"],
            admission_year=spec["admission_year"],
        )
        db.add(user)
        db.flush()  # user.id 확보
        _seed_default_subscriptions(db, user)
        created = True
    else:
        # 프로필 필드만 갱신(신원 컬럼은 트리거가 UPDATE 차단).
        for field in PROFILE_FIELDS:
            setattr(user, field, spec[field])
    db.commit()
    db.refresh(user)
    return {
        "preset": spec["preset"],
        "id": user.id,
        "email": user.email,
        "user_type": user.user_type,
        "school": user.school,
        "dept_code": user.dept_code,
        "admission_year": user.admission_year,
        "created": created,
    }


def _ensure_schema():
    """로컬 DB에 모델이 선언한 테이블 중 없는 것을 생성한다(멱등, 있는 테이블은 건드리지 않음).

    이 브랜치 base(origin/develop)의 로컬 alembic head에는 모델이 참조하는
    `keyword_subscription_boards` 테이블 마이그레이션이 없어, 그 상태로는
    GET /users/me/init 가 UndefinedTable 500 을 낸다(→ 프론트가 비로그인으로 처리).
    E2E 인프라가 자립하도록 여기서 create_all 로 보정한다. 백엔드 마이그레이션 갭은
    별도로 보고 대상이다(이 스크립트가 갭 자체를 고치지는 않는다).
    """
    Base.metadata.create_all(bind=engine)


def main():
    _ensure_schema()
    db = SessionLocal()
    try:
        results = [upsert(db, spec) for spec in PRESETS]
    finally:
        db.close()
    # 마지막 줄 = 기계 판독용 JSON (시크릿 없음)
    print(json.dumps({"seeded": results}, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:  # noqa: BLE001
        print(f"SEED_ERROR: {exc}", file=sys.stderr)
        sys.exit(1)
