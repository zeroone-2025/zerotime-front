import { FiCheck, FiClock, FiPlus, FiTrash2, FiXCircle } from 'react-icons/fi';

import { ChapterHeader, GuideTip, StepHeading } from './GuideBlocks';
import MockFrame from './MockFrame';

/**
 * 1장 — 동아리 임원진 플로우 (홍길동 회장 시점)
 * 동아리 만들기 → 조 편성 → 일정 잡기 → 시간 조율.
 * 목업 마크업은 실제 화면(TeamCreateView, GroupInlineEditor, GroupTextInput,
 * DateSelector, ChinbaHeatmapGrid, TeamScheduleTab)의 클래스를 복제한 것이다.
 */
export default function GuideExecFlow() {
  return (
    <section>
      <ChapterHeader
        no={1}
        id="exec-flow"
        title="임원진 플로우"
        subtitle="동아리 개설부터 일정 확정까지, 회장 홍길동을 따라갑니다"
      />

      <StepHeading no={1} title="동아리 만들기" />
      <p className="mt-4 text-[15px] leading-7 text-gray-700">
        코딩 동아리 회장 홍길동은 타임라인 홈에서 &ldquo;타임라인 동아리 선택&rdquo; 카드
        오른쪽 위의 <strong>[+ 만들기]</strong> 버튼을 누릅니다. 동아리 이름을 입력하고
        카테고리를 하나 고르면 끝입니다. 카테고리는 선택 사항이라 건너뛰어도 됩니다.{' '}
        <strong>[만들기]</strong>를 누르는 순간 동아리가 생성되고, 초대 코드도 자동으로
        발급됩니다.
      </p>

      <MockFrame title="동아리 만들기" caption="동아리 이름과 카테고리만 정하면 개설 완료">
        <div className="mb-6">
          <label className="mb-2 block text-sm font-bold text-gray-700">동아리 이름</label>
          <div className="relative">
            <div className="w-full rounded-xl border border-gray-200 px-4 py-3 pr-10 text-sm text-gray-800">
              전북대 코딩 동아리
            </div>
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300">
              <FiXCircle size={18} />
            </span>
          </div>
          <p className="mt-1 text-right text-[11px] text-gray-400">10/50</p>
        </div>
        <div className="mb-6">
          <label className="mb-2 block text-sm font-bold text-gray-700">
            카테고리
            <span className="ml-1 text-xs font-normal text-gray-400">(선택)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-gray-900 bg-gray-900 px-4 py-2 text-sm font-medium text-white">
              동아리
            </span>
            {['학과', '스터디', '연구실', '학회', '기타'].map((label) => (
              <span
                key={label}
                className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600"
              >
                {label}
              </span>
            ))}
          </div>
        </div>
        <div className="border-t border-gray-100 px-0 pt-3">
          <div className="w-full rounded-xl bg-gray-900 py-3 text-center text-base font-semibold text-white">
            만들기
          </div>
        </div>
      </MockFrame>

      <GuideTip>
        동아리를 갓 만들면 일정 탭 맨 위에 <strong>셋업 가이드 카드</strong>가 떠서 다음
        순서를 안내합니다. 초대링크로 회원을 초대하고, 조를 편성하라는 두 단계입니다.
        멤버와 조가 채워지면 카드는 자연스럽게 사라집니다.
      </GuideTip>

      <StepHeading no={2} title="그룹 만들고 조 편성하기" />
      <p className="mt-4 text-[15px] leading-7 text-gray-700">
        동아리가 만들어지면 운영 패널이나 설정 페이지에서 <strong>[조 / 그룹 관리]</strong>로
        들어가 <strong>그룹세트</strong>부터 하나 만듭니다. 그룹세트는 조 편성의 묶음
        단위입니다. 예를 들어 &ldquo;스터디&rdquo; 그룹세트와 &ldquo;MT&rdquo; 그룹세트를
        따로 만들면, 같은 멤버를 목적에 따라 다른 조로 나눠 둘 수 있습니다.
      </p>
      <p className="mt-4 text-[15px] leading-7 text-gray-700">
        그룹세트 이름을 정하면 편성 방식을 고릅니다.
      </p>
      <ol className="mt-3 list-decimal space-y-1.5 pl-6 text-[15px] leading-7 text-gray-700">
        <li>
          <strong>직접 선택하기</strong> : 멤버를 눌러 조에 배정합니다.
        </li>
        <li>
          <strong>텍스트 붙여넣기 (AI)</strong> : 엑셀·카톡 명단을 붙여넣어 자동 분석합니다.
        </li>
      </ol>

      <p className="mt-6 text-[15px] leading-7 text-gray-700">
        <strong>직접 선택하기</strong>를 고르면 아래 편성 화면이 열립니다. <strong>[+ 새 조
        추가]</strong>로 조를 만들고, 조 카드의 <strong>[+ 멤버 추가]</strong>를 눌러 멤버를
        골라 담습니다. 멤버는 알약(칩)으로 표시되며 <strong>조장은 검은 칩에 ★</strong>가
        붙습니다. 칩을 누르면 하단에 <strong>[조장 지정] [이동] [미배정으로]</strong> 버튼이
        떠서 그 자리에서 조를 옮기거나 조장을 바꿀 수 있습니다. 아직 조에 못 들어간 사람은
        아래 점선 카드 &ldquo;미배정 멤버&rdquo;에 모여 있습니다. 모든 조에 멤버와 조장이
        채워지면 <strong>[저장하기]</strong>가 활성화됩니다.
      </p>

      <MockFrame title="조 편성" caption="검은 칩(★)이 조장, 점선 카드는 아직 배정되지 않은 멤버">
        <div className="space-y-3">
          <div className="rounded-xl border border-gray-200 p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-bold text-gray-800">1조</span>
              <span className="p-1 text-gray-300">
                <FiTrash2 size={14} />
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <span className="inline-flex items-center rounded-full bg-gray-900 px-2.5 py-1 text-xs font-medium text-white">
                홍길동 ★
              </span>
              <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                김철수
              </span>
              <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                이영희
              </span>
            </div>
            <p className="mt-2 text-xs font-medium text-gray-400">
              <FiPlus className="mr-0.5 inline" size={12} />
              멤버 추가
            </p>
          </div>
          <div className="rounded-xl border border-dashed border-gray-300 p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500">미배정 멤버</span>
              <span className="text-[11px] text-gray-400">눌러서 조에 배정</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <span className="rounded-full bg-gray-50 px-2.5 py-1 text-xs text-gray-500">최수진</span>
              <span className="rounded-full bg-gray-50 px-2.5 py-1 text-xs text-gray-500">정민호</span>
            </div>
          </div>
        </div>
      </MockFrame>

      <p className="mt-4 text-[15px] leading-7 text-gray-700">
        이미 엑셀이나 카톡 공지에 조 명단이 있다면 <strong>텍스트 붙여넣기 (AI)</strong>가
        빠릅니다. 명단을 통째로 붙여넣고 <strong>[AI로 분석하기]</strong>를 누르면 조와
        조장을 자동으로 인식해 편성 화면에 채워 줍니다. 결과를 확인하고 어긋난 부분만
        고치면 됩니다.
      </p>

      <MockFrame title="조 편성" caption="텍스트 붙여넣기: 카톡 명단을 그대로 붙여넣으면 된다">
        <label className="mb-2 block text-sm font-bold text-gray-700">조 편성 텍스트 입력</label>
        <p className="mb-3 text-xs text-gray-400">엑셀, 카톡, 메모장 등 어떤 형식이든 OK</p>
        <div className="h-28 w-full whitespace-pre-line rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-800">
          {'1조: 홍길동(조장), 김철수, 이영희\n2조: 박지민(조장), 최수진, 정민호'}
        </div>
        <div className="mt-3 flex gap-2 border-t border-gray-100 pt-3">
          <div className="flex-1 rounded-lg border border-gray-200 px-6 py-3 text-center text-base font-semibold text-gray-700">
            돌아가기
          </div>
          <div className="flex-1 rounded-lg bg-gray-900 px-6 py-3 text-center text-base font-semibold text-white">
            AI로 분석하기
          </div>
        </div>
      </MockFrame>

      <StepHeading no={3} title="조별로 일정 잡기" />
      <p className="mt-4 text-[15px] leading-7 text-gray-700">
        동아리 화면의 일정 탭에서 <strong>[+ 일정 잡기]</strong>를 누릅니다(임원진 전용).
        대상 조를 고르고 모임 이름을 적은 뒤, 달력에서 <strong>후보 날짜를 클릭하거나
        드래그</strong>해 여러 날을 한 번에 선택합니다. 아직 &ldquo;몇 시&rdquo;는 정하지
        않습니다. 시간은 멤버들이 되는 시간을 제출한 뒤 자연스럽게 정해집니다.
      </p>

      <MockFrame title="일정 잡기" caption="후보 날짜 선택: 검은 칸이 선택된 날, 드래그로 여러 날을 한 번에">
        <div className="mx-auto w-full max-w-[26rem]">
          <div className="mb-3 flex items-center justify-between">
            <span className="p-1.5 text-gray-300">&#8249;</span>
            <span className="text-sm font-bold text-gray-800">2026년 8월</span>
            <span className="p-1.5 text-gray-500">&#8250;</span>
          </div>
          <div className="mb-1 grid grid-cols-7">
            {['일', '월', '화', '수', '목', '금', '토'].map((d) => (
              <div key={d} className="flex h-8 items-center justify-center text-[11px] font-medium text-gray-400">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {[16, 17, 18].map((d) => (
              <div key={d} className="flex aspect-square items-center justify-center rounded-lg text-sm font-medium text-gray-200">
                {d}
              </div>
            ))}
            <div className="flex aspect-square items-center justify-center rounded-lg bg-blue-50 text-sm font-medium text-blue-700">
              19
            </div>
            <div className="flex aspect-square items-center justify-center rounded-lg bg-gray-900 text-sm font-medium text-white">
              20
            </div>
            <div className="flex aspect-square items-center justify-center rounded-lg bg-gray-900 text-sm font-medium text-white">
              21
            </div>
            <div className="flex aspect-square items-center justify-center rounded-lg text-sm font-medium text-gray-700">
              22
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <span className="inline-flex items-center gap-0.5 rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600">
              8/20(목) <span className="ml-0.5 text-gray-400">&times;</span>
            </span>
            <span className="inline-flex items-center gap-0.5 rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600">
              8/21(금) <span className="ml-0.5 text-gray-400">&times;</span>
            </span>
          </div>
        </div>
      </MockFrame>

      <GuideTip>
        조를 여러 개 선택하면 <strong>합동 일정</strong>이 됩니다. 아무 조도 선택하지 않으면
        전체 동아리 대상 일정이 됩니다. 정기총회처럼 모두가 모여야 할 때 쓰세요.
      </GuideTip>

      <StepHeading no={4} title="모두의 시간이 모이면" />
      <p className="mt-4 text-[15px] leading-7 text-gray-700">
        일정이 만들어지면 조원들이 각자 안 되는 시간을 제출합니다(방법은 2장에서). 제출이
        쌓이면 <strong>전체 일정</strong> 탭에 30분 단위 히트맵이 그려집니다. 읽는 법은
        간단합니다.
      </p>
      <ol className="mt-3 list-decimal space-y-1.5 pl-6 text-[15px] leading-7 text-gray-700">
        <li>
          <strong>칸의 색</strong> : 진한 초록일수록 되는 사람이 많고, 빨간색은 전원
          불가입니다.
        </li>
        <li>
          <strong>칸의 숫자</strong> : 그 시간에 가능한 인원 수입니다.
        </li>
        <li>
          <strong>칸을 누르면</strong> : 누가 안 되는지 이름까지 보여줍니다.
        </li>
      </ol>
      <p className="mt-4 text-[15px] leading-7 text-gray-700">
        위쪽 참여자 알약에서 초록 체크가 붙은 사람은 제출을 마친 사람입니다. 알약을 누르면
        그 사람의 불가능 시간만 히트맵 위에 강조됩니다. 아래 <strong>추천 시간</strong>에는
        가장 많은 인원이 가능한 상위 후보가 자동으로 정리되므로, 회장은 여기서 골라
        공지하면 됩니다.
      </p>

      <MockFrame title="조별과제 회의" caption="전체 일정 탭: 히트맵 색이 진할수록 가능 인원이 많다">
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-bold text-gray-500">참여자 (3/4 제출)</span>
          {['홍길동', '김철수', '이영희'].map((name) => (
            <span
              key={name}
              className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-700"
            >
              <FiCheck size={10} />
              {name}
            </span>
          ))}
          <span className="flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-400">
            박지민
          </span>
        </div>
        <div>
          <div className="flex">
            <div className="w-7 shrink-0" />
            {['목 8/20', '금 8/21'].map((label) => (
              <div key={label} className="flex flex-1 flex-col items-center justify-center py-1">
                <span className="text-[10px] text-gray-400">{label.split(' ')[0]}</span>
                <span className="text-xs font-medium text-gray-700">{label.split(' ')[1]}</span>
              </div>
            ))}
          </div>
          {[
            ['18시', 'bg-[#21a278]', '4', 'bg-[#62c784]', '3'],
            ['', 'bg-[#21a278]', '4', 'bg-[#a3ec8f]', '2'],
            ['19시', 'bg-[#41b47e]', '3', 'bg-[#c4fe95]', '1'],
            ['', 'bg-[#62c784]', '3', 'bg-red-500', ''],
          ].map(([label, c1, n1, c2, n2], i) => (
            <div key={i} className="flex">
              <div className="flex w-7 shrink-0 items-center justify-start">
                {label && <span className="-mt-2 text-[10px] text-gray-400">{label}</span>}
              </div>
              <div className={`flex h-[22px] flex-1 items-center justify-center border-r border-t border-gray-100 ${c1}`}>
                {n1 && <span className="text-[9px] font-bold text-gray-800">{n1}</span>}
              </div>
              <div className={`flex h-[22px] flex-1 items-center justify-center border-t border-gray-100 ${c2}`}>
                {n2 && <span className="text-[9px] font-bold text-gray-800">{n2}</span>}
              </div>
            </div>
          ))}
          <div className="mt-3 flex items-center justify-center gap-2 px-2">
            <span className="text-[10px] text-gray-400">가능</span>
            <div className="h-3 w-4 rounded-sm bg-[#21a278]" />
            <div className="h-3 w-4 rounded-sm bg-[#41b47e]" />
            <div className="h-3 w-4 rounded-sm bg-[#62c784]" />
            <div className="h-3 w-4 rounded-sm bg-[#a3ec8f]" />
            <div className="h-3 w-4 rounded-sm bg-[#c4fe95]" />
            <div className="h-3 w-4 rounded-sm bg-red-500" />
            <span className="text-[10px] text-gray-400">불가</span>
          </div>
        </div>
        <div className="mt-4">
          <h4 className="mb-2 text-xs font-bold text-gray-500">추천 시간</h4>
          <div className="space-y-2">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
              <div className="flex items-center gap-1.5">
                <FiClock size={14} className="text-emerald-600" />
                <span className="text-sm font-bold text-emerald-700">8/20(목) 18:00~19:00</span>
              </div>
              <p className="mt-1 text-xs text-emerald-600">4명 전원 가능</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
              <div className="flex items-center gap-1.5">
                <FiClock size={14} className="text-amber-600" />
                <span className="text-sm font-bold text-amber-700">8/21(금) 18:00~18:30</span>
              </div>
              <p className="mt-1 text-xs text-amber-600">3/4명 가능</p>
            </div>
          </div>
        </div>
      </MockFrame>

      <p className="mt-4 text-[15px] leading-7 text-gray-700">
        모임을 마쳤다면 일정 화면 오른쪽 위의 <strong>완료 처리</strong>(초록 체크 아이콘)를
        누릅니다. 동아리 일정이라면 곧바로 기록 화면으로 이어집니다. 완료 처리와 기록이
        어떻게 이어지는지는 5장에서 자세히 다룹니다.
      </p>
    </section>
  );
}
