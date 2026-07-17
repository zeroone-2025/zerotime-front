import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: '개인정보처리방침 | 제로타임',
  description: '제로타임 개인정보 처리 현황과 계정 삭제 안내',
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl overflow-y-auto px-5 py-12 text-gray-900">
      <Link href="/" className="text-sm font-semibold text-blue-600 hover:underline">
        제로타임 홈으로
      </Link>
      <h1 className="mt-5 text-3xl font-bold tracking-tight">개인정보처리방침</h1>
      <p className="mt-3 text-sm leading-6 text-gray-600">
        이 방침은 제로타임이 현재 제공하거나 출시를 위해 준비 중인 기능에서 처리될 수 있는 개인정보를
        설명합니다. 운영 환경의 보관·암호화·제공업체 설정처럼 아직 확인되지 않은 사항은 사실로 단정하지
        않고 아래에 확인 필요 사항으로 표시합니다.
      </p>

      <section className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-5">
        <h2 className="text-lg font-bold text-amber-950">운영 책임자와 시행일</h2>
        <dl className="mt-3 space-y-2 text-sm leading-6 text-amber-900">
          <div>
            <dt className="font-semibold">개인정보 처리자 및 문의처</dt>
            <dd>출시 전 운영 책임자 확정 필요</dd>
          </div>
          <div>
            <dt className="font-semibold">시행일</dt>
            <dd>운영 책임자 승인 후 확정(현재 미확정)</dd>
          </div>
        </dl>
        <p className="mt-3 text-sm leading-6 text-amber-900">
          운영 책임자, 연락처, 법적 처리 근거, 제공·위탁 및 국외 처리 고지는 출시 전에 검토·승인되어야
          합니다.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-bold">1. 처리하는 정보와 이용 목적</h2>
        <div className="mt-4 space-y-4 text-sm leading-6 text-gray-700">
          <div>
            <h3 className="font-semibold text-gray-900">계정 및 소셜 로그인 정보</h3>
            <p>
              사용자 ID, 역할, 아이디·닉네임·이메일, 학교·학과·입학연도, 선택한 소셜 로그인 제공업체의
              식별자와 프로필·이메일 주장값을 계정 생성, 로그인, 계정·구독 소유 확인 및 권한 관리에
              사용합니다. 소셜 로그인 제공업체는 Google, Apple, Naver, Kakao입니다.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">공지 이용 설정과 이용 기록</h3>
            <p>
              구독 게시판·그룹·키워드, 읽음·즐겨찾기·조회 상태와 키워드 알림 확인 시점은 개인화한
              공지·키워드 구독, 읽음·즐겨찾기 상태, 공지 조회 집계에 사용합니다. 게스트의 일부 구독 설정은
              기기 브라우저 저장소에 저장될 수 있습니다.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">선택 기능 정보</h3>
            <p>
              이용자가 선택해 입력하는 프로필 사진, 커리어 프로필의 이름·연락처·학력·경력·기술·자격·활동·언어
              점수·멘토 문답 및 공개 범위는 프로필 표시와 멘토 기능에 사용될 수 있습니다. 시간표의 학기,
              과목·교수·장소·시간과 선택적으로 올린 시간표 이미지는 개인 시간표 관리, 이미지 분석 및 과목
              연결에 사용될 수 있습니다.
            </p>
            <p className="mt-2">
              친해지길 바래 및 팀 기능에서는 일정 가능·불가 시간, 참여자·팀원·초대·그룹·활동·점수·구독 및
              결제 이력 관련 정보가 일정 조율, 팀 운영, 활동·순위 및 구독 관리에 사용될 수 있습니다. 팀과
              공유하는 정보의 범위와 삭제 시 소유권 처리 기준은 별도 승인이 필요합니다.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">기기·알림 및 운영 정보</h3>
            <p>
              모바일 기능에서는 설치 식별자, 알림 등록 토큰, 환경·제공업체 메타데이터 및 전송 식별자를
              다룰 수 있습니다. Firebase Cloud Messaging(FCM)은 활성 계정·권한·세대 확인 뒤의{' '}
              <strong>데이터 전용</strong> 알림 전송에만 사용하도록 설계되어 있으며, 전송 내용만으로 운영체제에
              알림을 자동 표시하지 않고 앱이 별도로 권한을 확인한 뒤 표시합니다. 로그에는 오류, 요청 주소,
              예외 등에 식별 정보가 포함될 가능성이 있어 운영·장애 대응·보안 진단을 위해 최소화 검토 대상입니다.
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">공개 출처 콘텐츠</h3>
            <p>
              공지, 학과·강좌·기업 정보 등은 공지 통합과 콘텐츠 제공을 위해 처리됩니다. 원문 출처와 이름이
              포함된 공개 콘텐츠의 이용 범위·보관 기준은 별도 출처 및 법률 검토가 필요합니다.
            </p>
          </div>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-bold">2. 처리·공유되는 제공업체</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-gray-700">
          <li>Google, Apple, Naver, Kakao: 소셜 로그인과 제공업체 재인증·해지 절차에 관여합니다.</li>
          <li>Firebase Cloud Messaging: 모바일 데이터 전용 알림의 전송 처리에 관여합니다.</li>
          <li>Google Gemini: 이용자가 선택한 시간표 이미지 분석 요청을 처리할 수 있습니다.</li>
          <li>Slack: 운영자 온보딩 알림 및 운영 보고에 사용된 이력이 있어, 채널 구성원·보관·내보내기 설정을 확인해야 합니다.</li>
          <li>호스팅, 백업, 로그 수집, 이미지 저장 또는 CDN의 실제 운영 구성은 출시 전 확인 대상입니다.</li>
        </ul>
        <p className="mt-3 text-sm leading-6 text-gray-700">
          각 제공업체의 처리자 계약, 보관·삭제 조건, 관리 콘솔 설정, 수신자, 국가·이전 시점·방법을 현재
          소스만으로 확인하지 못했습니다. 따라서 국외 처리 또는 제공업체의 보관·암호화·삭제를 이미 검증하거나
          계약했다고 주장하지 않습니다. 필요한 고지·동의·계약 및 제공업체별 삭제·철회 절차는 출시 전 확정합니다.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-bold">3. 보관, 삭제 및 계정 삭제</h2>
        <p className="mt-4 text-sm leading-6 text-gray-700">
          현재 소스에서 계정, 프로필, 이용 기록, 팀·결제 관련 자료, 파일, 로그별 실제 보관 기간이 모두
          검증된 것은 아닙니다. 운영 백업은 최대 7일, 로그는 최대 29일, 삭제·출시 증빙은 최대 90일을 관리
          기준으로 계획하고 있으나, 실제 백업·스냅샷·로그 수집기의 보관과 삭제는 운영 검증 전에는 확정된
          사실로 보지 않습니다.
        </p>
        <p className="mt-3 text-sm leading-6 text-gray-700">
          회원 탈퇴는 로그인 후 <a href="/profile/" className="font-semibold text-blue-600 hover:underline">프로필</a>에서
          요청할 수 있습니다. 현재 탈퇴 요청은 계정 접근을 즉시 비활성화합니다. 계정과 연결된 개인정보의
          최종 삭제·보관 및 복구 정책은 재설계 중이며, 확정 전에는 별도의 삭제 예정일이나 취소 절차를
          보장하지 않습니다.
        </p>
        <p className="mt-3 text-sm leading-6 text-gray-700">
          계정 삭제 후에도 오프라인·종료된 기기의 운영체제 알림이나 제공업체 원본이 즉시 사라졌다고 주장하지
          않습니다. 연결 가능한 기기는 다음 실행·연결 시 접근을 닫고 정리해야 하며, 제공업체 영역은 각
          제공업체의 철회·삭제 요청과 확인이 별도로 필요합니다. 법정 보관을 위한 별도 보관소는 아직 승인되지
          않았으며, 승인 전에는 일반 계정 정보를 그곳에 보관하지 않습니다.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-bold">4. 이용자의 권리</h2>
        <p className="mt-4 text-sm leading-6 text-gray-700">
          이용자는 자신의 정보에 대한 열람, 정정, 삭제, 처리 제한·철회 요청을 할 수 있으며 회원 탈퇴는
          로그인 후 프로필에서 요청합니다. 다만 공식 접수 담당자와 처리 기한은{' '}
          <strong>출시 전 운영 책임자 확정 필요</strong> 상태입니다. 운영 책임자 승인 전에는 이 문서가 법률상
          완결된 권리 행사 창구 또는 처리 기한을 보장한다고 주장하지 않습니다.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-bold">5. 안전성 관리</h2>
        <p className="mt-4 text-sm leading-6 text-gray-700">
          서비스는 권한별 접근 제한, 세션 철회, 삭제 요청 후 접근 차단, 로그 최소화와 복구 시 삭제 상태 확인을
          목표로 관리합니다. 그러나 데이터베이스·백업·Redis·파일·로그·기기 캐시의 저장 시 암호화, 전송 보안,
          접근 제어, 백업 제외 및 제공업체 설정은 배포 환경 검증이 남아 있습니다. 이 방침은 그러한 보안 조치가
          이미 검증되었거나 모든 정보가 암호화되어 있다고 주장하지 않습니다.
        </p>
      </section>

      <section className="mt-8 rounded-xl border border-gray-200 p-5">
        <h2 className="text-xl font-bold">6. 방침 변경</h2>
        <p className="mt-3 text-sm leading-6 text-gray-700">
          처리 항목, 제공업체, 보관 기준, 권리 행사 창구 또는 법적 근거가 확정·변경되면 시행 전 이 페이지와
          서비스 내 공지로 알립니다. 이 방침의 시행일과 변경 고지 기간은 운영 책임자·법률 검토 승인 후
          확정합니다.
        </p>
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm font-semibold text-blue-600">
          <a href="/terms/" className="hover:underline">이용약관</a>
          <a href="/profile/" className="hover:underline">회원 탈퇴</a>
        </div>
      </section>
    </main>
  );
}
