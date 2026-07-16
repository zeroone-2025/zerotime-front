import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: '이용약관 | 제로타임',
  description: '제로타임 서비스 이용약관',
};

export default function TermsPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl overflow-y-auto px-5 py-12 text-gray-900">
      <Link href="/" className="text-sm font-semibold text-blue-600 hover:underline">
        제로타임 홈으로
      </Link>
      <h1 className="mt-5 text-3xl font-bold tracking-tight">이용약관</h1>
      <section className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900">
        <p>
          시행일: 운영 책임자 승인 후 확정(현재 미확정). 운영 주체, 공식 연락처, 준거법과 관할은{' '}
          <strong>출시 전 운영 책임자 확정 필요</strong> 상태입니다. 아래 내용은 출시 전 검토를 위한 공개
          약관 초안이며, 미확정 사항을 확정된 법적 고지로 주장하지 않습니다.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-bold">1. 서비스의 범위</h2>
        <p className="mt-3 text-sm leading-6 text-gray-700">
          제로타임은 전북대학교 관련 공지와 학과·강좌·기업 등 공개 출처 콘텐츠를 찾아보기 쉽게 제공하고,
          구독·키워드·읽음·즐겨찾기, 일정 조율·팀, 커리어, 시간표 등 이용자가 선택하는 기능을 제공합니다.
          기능별 제공 여부와 범위는 서비스 화면 및 운영 정책에 따라 달라질 수 있습니다.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-bold">2. 게스트와 계정 이용</h2>
        <p className="mt-3 text-sm leading-6 text-gray-700">
          공지 열람과 일부 구독 설정은 게스트로 이용할 수 있으며, 게스트 설정은 이용자 기기에 저장될 수
          있습니다. 프로필, 계정에 연결된 구독, 팀·일정, 커리어, 개인 시간표 등 계정 소유·공유가 필요한
          기능은 로그인 후 제공될 수 있습니다. 계정 로그인에는 Google, Apple, Naver, Kakao 같은 외부
          제공업체를 사용할 수 있으며, 이용자는 정확한 계정 정보를 유지하고 자신의 접근 수단을 관리해야 합니다.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-bold">3. 공지와 출처 정보의 정확성</h2>
        <p className="mt-3 text-sm leading-6 text-gray-700">
          제로타임은 공지와 공개 출처 정보를 편리하게 확인하도록 돕는 서비스입니다. 원문 게시자와 원문 링크의
          내용이 우선하며, 공지의 게시·수정·삭제 시점, 누락, 분류, 링크 연결 또는 최신성이 항상 완전하거나
          즉시 반영된다고 보장하지 않습니다. 학사, 장학, 취업, 결제 등 중요한 판단은 반드시 원문과 해당 기관의
          안내를 확인해야 합니다.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-bold">4. 금지 행위</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-gray-700">
          <li>타인의 계정·개인정보·접근 수단을 무단으로 사용하거나 수집하는 행위</li>
          <li>서비스, API, 알림 또는 계정 기능을 비정상적으로 호출·우회·방해하는 행위</li>
          <li>팀·프로필·커리어·공지 기능을 통해 허위 정보, 권리 침해 정보, 불법·유해한 내용을 게시하거나 전송하는 행위</li>
          <li>공지·콘텐츠를 출처나 권리자의 허용 범위를 넘어 복제·배포·상업적으로 이용하는 행위</li>
          <li>관련 법령, 이 약관 또는 서비스 내 별도 안내를 위반하는 행위</li>
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-bold">5. 이용 제한, 정지 및 삭제</h2>
        <p className="mt-3 text-sm leading-6 text-gray-700">
          운영 주체는 보안, 권리 보호, 서비스 안정성 또는 금지 행위 대응을 위해 필요한 범위에서 계정이나
          기능 이용을 제한·정지·삭제할 수 있습니다. 실제 판단 기준, 통지 절차, 이의 제기 창구와 담당자는
          출시 전 운영 책임자 확정 필요 상태이며, 확정 전에는 해당 절차가 마련되었다고 주장하지 않습니다.
        </p>
        <p className="mt-3 text-sm leading-6 text-gray-700">
          이용자는 로그인 후 <a href="/profile/" className="font-semibold text-blue-600 hover:underline">프로필</a>에서
          회원 탈퇴를 요청할 수 있습니다. 현재 탈퇴 요청은 계정 접근을 즉시 비활성화하며, 개인정보의
          최종 삭제·보관 및 복구 정책은 재설계 중입니다.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-bold">6. 지식재산권과 콘텐츠 권리</h2>
        <p className="mt-3 text-sm leading-6 text-gray-700">
          제로타임의 서비스 구성, 상표, 디자인, 소프트웨어와 운영자가 권리를 보유한 콘텐츠의 권리는 해당
          권리자에게 있습니다. 학교 공지와 외부 출처 콘텐츠의 권리는 원 저작자·게시자 또는 해당 권리자에게
          남을 수 있습니다. 이용자는 법령과 권리자의 허용 범위에서만 이를 이용해야 합니다.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-bold">7. 서비스 제공과 책임의 한계</h2>
        <p className="mt-3 text-sm leading-6 text-gray-700">
          서비스는 네트워크, 외부 제공업체, 원문 출처, 기기·운영체제, 점검 또는 예기치 못한 장애로
          중단·변경·종료될 수 있습니다. 제로타임은 원문 출처의 오류·변경, 이용자의 입력·공유, 제3자 서비스,
          이용자의 미확인으로 발생한 결과를 보증하지 않습니다. 다만 적용 법령상 제한할 수 없는 책임까지
          배제하려는 것은 아닙니다.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-bold">8. 약관 변경</h2>
        <p className="mt-3 text-sm leading-6 text-gray-700">
          서비스 범위, 운영 정책 또는 법령 변화로 약관을 변경할 필요가 있으면 시행 전 이 페이지와 서비스 내
          공지로 알립니다. 변경 고지 기간, 동의 방식과 적용 기준은 운영 책임자와 법률 검토 승인 후 확정합니다.
        </p>
      </section>

      <section className="mt-8 rounded-xl border border-gray-200 p-5">
        <h2 className="text-xl font-bold">9. 준거법·관할 및 문의</h2>
        <p className="mt-3 text-sm leading-6 text-gray-700">
          준거법, 분쟁 관할, 운영 주체와 공식 문의처는 <strong>출시 전 운영 책임자 확정 필요</strong> 상태입니다.
          확정 전에는 특정 국가의 법, 법원 또는 연락처를 적용 대상으로 단정하지 않습니다.
        </p>
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm font-semibold text-blue-600">
          <a href="/privacy/" className="hover:underline">개인정보처리방침</a>
          <a href="/profile/" className="hover:underline">회원 탈퇴</a>
        </div>
      </section>
    </main>
  );
}
