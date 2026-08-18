import { FiCheckCircle, FiLink, FiShare2, FiTrash2 } from 'react-icons/fi';
import { LuCalendar, LuClock, LuTrophy } from 'react-icons/lu';

import { ChapterHeader, GuideTip, StepHeading } from './GuideBlocks';
import MockFrame from './MockFrame';

/**
 * 5장 — 기록과 랭킹
 * 완료 처리(ChinbaEventDetailBody 헤더)·활동 기록 폼·ActivityCard·조별 랭킹(RankingBar) 목업.
 * 랭킹은 구현 완료·현재 비노출 상태(features.ts의 CHINBA_RANKING_TAB_VISIBLE=false).
 */
export default function GuideRecordsRanking() {
  return (
    <section>
      <ChapterHeader
        no={5}
        id="records-ranking"
        title="기록과 랭킹"
        subtitle="모임이 끝난 뒤, 활동을 남기고 언젠가 순위를 겨루기"
      />

      <StepHeading title="일정 완료 처리하기" />
      <p className="mt-4 text-[15px] leading-7 text-gray-700">
        기록은 일정을 <strong>완료 처리</strong>하는 데서 시작합니다. 순서는 세 단계입니다.
      </p>
      <ol className="mt-3 list-decimal space-y-1.5 pl-6 text-[15px] leading-7 text-gray-700">
        <li>
          일정 화면 오른쪽 위의 <strong>초록 체크 아이콘</strong>을 누릅니다. 일정을 만든
          사람에게만 보입니다.
        </li>
        <li>
          확인 팝업을 지나면 동아리의 <strong>기록 탭</strong>으로 이동하고, 기록 폼이
          자동으로 열립니다.
        </li>
        <li>
          <strong>[기록하기]</strong> 또는 <strong>[기록하지 않기]</strong>를 누르는 순간
          일정 완료가 확정됩니다. 그냥 창을 닫으면 일정은 진행중 상태로 남습니다.
        </li>
      </ol>

      <MockFrame caption="일정 화면 오른쪽 위 아이콘들. 초록 체크가 완료 처리 버튼">
        <div className="border-b border-gray-100 pb-2">
          <div className="flex items-center justify-between">
            <p className="truncate text-[11px] text-gray-500">8/20(목) ~ 8/21(금)</p>
            <div className="flex shrink-0 items-center gap-1">
              <span className="rounded-full bg-emerald-50 p-2 text-emerald-600">
                <FiCheckCircle size={18} />
              </span>
              <span className="rounded-full p-2 text-gray-600">
                <FiLink size={17} />
              </span>
              <span className="rounded-full p-2 text-gray-600">
                <FiShare2 size={18} />
              </span>
              <span className="rounded-full p-2 text-red-500">
                <FiTrash2 size={16} />
              </span>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-1 pt-1.5 text-center text-[10px] text-gray-400">
          <span className="w-9 text-emerald-600">완료</span>
          <span className="w-9">링크</span>
          <span className="w-9">공유</span>
          <span className="w-9 text-red-400">삭제</span>
        </div>
      </MockFrame>

      <p className="mt-4 text-[15px] leading-7 text-gray-700">
        날짜가 다 지난 일정은 자동으로 &ldquo;지난 일정&rdquo;이 되지만, 그때도 같은 체크
        아이콘으로 완료 처리하고 기록을 남길 수 있습니다.
      </p>

      <StepHeading title="활동 기록하기" />
      <p className="mt-4 text-[15px] leading-7 text-gray-700">
        기록 폼에는 제목·날짜·시간에 더해 무엇을 했는지, 회식비 같은 사용 금액, 누가
        참여했는지까지 남길 수 있습니다. 참여 인원은 멤버 목록에서 골라 칩으로 추가합니다.
        완료 흐름이 아니어도 기록 탭의 <strong>[+ 활동 기록하기]</strong> 버튼으로 언제든
        직접 열 수 있습니다(임원진 전용).
      </p>

      <MockFrame title="활동 기록하기" caption="일정 완료 흐름에서 자동으로 열리는 기록 폼">
        <div className="space-y-3">
          <div className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800">
            조별과제 회의
          </div>
          <div className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800">
            2026-08-20
          </div>
          <div className="flex gap-2">
            <div className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800">
              18:00
            </div>
            <div className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800">
              19:00
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-gray-500">활동 설명 (선택)</p>
            <div className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800">
              발표 자료 초안 완성, 역할 분담
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-gray-500">사용 금액 (선택)</p>
            <div className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800">
              24,000
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-gray-500">참여 인원 (선택) · 총 3명</p>
            <div className="flex flex-wrap gap-1.5">
              {['홍길동', '김철수', '이영희'].map((name) => (
                <span
                  key={name}
                  className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white py-1 pl-2.5 pr-1.5 text-xs text-gray-600"
                >
                  {name} <span className="text-gray-300">&times;</span>
                </span>
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <span className="flex-1 rounded-lg bg-gray-200 py-2 text-center text-sm font-medium text-gray-600">
              기록하지 않기
            </span>
            <span className="flex-1 rounded-lg bg-gray-900 py-2 text-center text-sm font-medium text-white">
              기록하기
            </span>
          </div>
        </div>
      </MockFrame>

      <p className="mt-4 text-[15px] leading-7 text-gray-700">
        기록된 활동은 기록 탭에 카드로 쌓입니다. 언제, 무엇을, 얼마를 쓰고, 누구와 했는지가
        한 장에 정리되어 동아리의 활동 역사가 됩니다. 조 필터와 함께 보면 조별 활동 내역만
        골라 볼 수도 있습니다.
      </p>

      <MockFrame caption="기록 탭에 쌓이는 활동 카드">
        <div className="rounded-xl border border-gray-100 bg-white p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-bold text-gray-800">조별과제 회의</p>
              <div className="mt-1 flex items-center gap-2 text-[11px] text-gray-400">
                <span className="inline-flex items-center gap-0.5">
                  <LuCalendar size={11} /> 2026-08-20
                </span>
                <span className="inline-flex items-center gap-0.5">
                  <LuClock size={11} /> 18:00~19:00
                </span>
              </div>
            </div>
            <span className="shrink-0 rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-medium text-gray-500">
              1조
            </span>
          </div>
          <p className="mt-2 text-xs text-gray-600">발표 자료 초안 완성, 역할 분담</p>
          <div className="mt-2 flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-2.5 py-1 text-xs text-gray-600">
              💸 24,000원
            </span>
            <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
              기록: 홍길동
            </span>
          </div>
        </div>
      </MockFrame>

      <GuideTip>
        사용 금액과 용도 메모를 꾸준히 남기면 기록 탭이 그대로 <strong>간단한 회계
        장부</strong>가 됩니다. 학기말 결산 때 카드 내역을 뒤지지 않아도 됩니다.
      </GuideTip>

      <StepHeading title="랭킹 (추후 업데이트 예정)" />
      <p className="mt-4 text-[15px] leading-7 text-gray-700">
        기록이 쌓이면 그 데이터로 <strong>조별 랭킹</strong>이 만들어집니다. 활동 횟수와
        점수를 합산해 조끼리 순위를 겨루는 기능으로, 순위 변동(↑↓)과 내 조의 참여율까지
        보여줍니다. 아래와 같은 모습으로 이미 만들어져 있지만 <strong>지금은 잠시 꺼 둔
        상태</strong>이며, 추후 업데이트로 공개될 예정입니다. 지금 남기는 활동 기록은
        그대로 랭킹에 반영되니, 미리 부지런히 기록해 두면 공개되는 날 우리 조가 1등으로
        시작할 수도 있습니다.
      </p>

      <MockFrame title="랭킹" caption="조별 랭킹: 구현 완료, 추후 업데이트로 공개 예정">
        <div className="mb-3 flex items-center gap-2">
          <LuTrophy size={16} className="text-yellow-500" />
          <span className="text-sm font-bold text-gray-800">조별 랭킹</span>
        </div>
        <div className="space-y-2">
          {[
            { rank: 1, name: '1조', change: '↑1', changeClass: 'text-green-500', count: 8, score: 120, bar: 'bg-yellow-400', width: 'w-full' },
            { rank: 2, name: '2조', change: '↓1', changeClass: 'text-red-500', count: 6, score: 95, bar: 'bg-gray-400', width: 'w-4/5' },
            { rank: 3, name: '3조', change: '', changeClass: '', count: 4, score: 60, bar: 'bg-amber-600', width: 'w-1/2' },
          ].map(({ rank, name, change, changeClass, count, score, bar, width }) => (
            <div key={rank} className="rounded-lg border border-gray-100 bg-white p-3">
              <div className="mb-1.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-5 text-center text-xs font-bold text-gray-400">{rank}</span>
                  <span className="text-sm font-semibold text-gray-800">{name}</span>
                  {change && (
                    <span className={`ml-1 text-[10px] font-medium ${changeClass}`}>{change}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">{count}회</span>
                  <span className="text-sm font-bold text-gray-800">{score}점</span>
                </div>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                <div className={`h-full rounded-full ${bar} ${width}`} />
              </div>
            </div>
          ))}
        </div>
      </MockFrame>
    </section>
  );
}
