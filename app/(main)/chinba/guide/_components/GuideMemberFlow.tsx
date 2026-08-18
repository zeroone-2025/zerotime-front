import { Fragment } from 'react';

import { FiRotateCcw, FiUpload } from 'react-icons/fi';

import { ChapterHeader, GuideTip, StepHeading } from './GuideBlocks';
import MockFrame from './MockFrame';

/**
 * 2장 — 일반 사용자 플로우 (김철수 신입 부원 시점)
 * 초대링크로 가입 → 시간표 등록 → 안 되는 시간 제출.
 * 목업은 InviteClient, TimetableTab, MyScheduleTab+ChinbaScheduleGrid 복제.
 */
export default function GuideMemberFlow() {
  return (
    <section>
      <ChapterHeader
        no={2}
        id="member-flow"
        title="일반 사용자 플로우"
        subtitle="가입하고 내 시간 제출하기, 신입 부원 김철수를 따라갑니다"
      />

      <StepHeading no={1} title="초대링크로 가입하기" />
      <p className="mt-4 text-[15px] leading-7 text-gray-700">
        신입 부원 김철수는 단톡방에서 초대링크(<code className="rounded bg-gray-100 px-1 py-0.5 text-xs">
        zerotime.kr/invite?code=...</code>)를 받습니다. 링크를 열면 로그인 후 자동으로
        가입이 진행되고, &ldquo;참여 완료&rdquo; 화면에서 <strong>[팀으로 이동]</strong>을
        누르면 바로 동아리 화면입니다. 링크 대신 초대 코드만 받았다면 타임라인 홈의{' '}
        <strong>[초대코드]</strong> 버튼을 눌러 코드를 직접 입력해도 됩니다.
      </p>

      <MockFrame caption="초대링크를 열면 자동으로 가입이 진행된다">
        <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-4 py-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-50">
            <span className="text-3xl">🎉</span>
          </div>
          <div>
            <p className="text-lg font-bold text-gray-800">팀 참여 완료!</p>
            <p className="mt-1 text-sm text-gray-500">환영합니다</p>
          </div>
          <div className="w-full rounded-xl bg-gray-900 py-3 text-center text-sm font-medium text-white">
            팀으로 이동
          </div>
        </div>
      </MockFrame>

      <StepHeading no={2} title="내 시간표 등록하기" />
      <p className="mt-4 text-[15px] leading-7 text-gray-700">
        타임라인 하단의 <strong>MY</strong> 탭 오른쪽 위 <strong>[내 시간표]</strong> 버튼을
        누르면 시간표 화면이 열립니다. 시간표를 채우는 방법은 두 가지입니다.
      </p>
      <ol className="mt-3 list-decimal space-y-1.5 pl-6 text-[15px] leading-7 text-gray-700">
        <li>
          <strong>에브리타임 시간표 업로드</strong> : 에브리타임 시간표를 캡처한 이미지를
          올리면 AI가 분석해 수업을 자동으로 채워 줍니다. 인식이 애매한 수업에는
          &ldquo;확인필요&rdquo; 표시가 붙어 직접 고칠 수 있습니다.
        </li>
        <li>
          <strong>직접 추가</strong> : 알바나 과외처럼 시간표에 없는 고정 일정은 빈 칸을
          드래그해서 넣습니다.
        </li>
      </ol>
      <p className="mt-4 text-[15px] leading-7 text-gray-700">
        시간표는 한 번만 등록해 두면 앞으로 모든 일정 조율에 재사용됩니다.
      </p>

      <MockFrame title="내 시간표" caption="에브리타임 캡처를 올리면 AI가 자동으로 채워 준다">
        <div className="flex items-center justify-between pb-2">
          <span className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs font-medium text-gray-700">
            2학기 ▾
          </span>
          <span className="flex items-center gap-1 rounded-lg bg-gray-100 px-2.5 py-1.5 text-xs font-medium text-gray-600">
            <FiUpload size={12} />
            에브리타임 시간표 업로드
          </span>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-2">
          <div className="grid grid-cols-6 gap-px text-center">
            <div />
            {['월', '화', '수', '목', '금'].map((d) => (
              <div key={d} className="py-1 text-[10px] font-medium text-gray-400">
                {d}
              </div>
            ))}
            {['9시', '10시', '11시'].map((hour, row) => (
              <Fragment key={hour}>
                <div className="py-2 pr-1 text-right text-[10px] text-gray-400">
                  {hour}
                </div>
                {[0, 1, 2, 3, 4].map((col) => {
                  const isClass = (row === 0 && col === 1) || (row === 1 && (col === 1 || col === 3));
                  const isOrange = row === 2 && col === 0;
                  return (
                    <div
                      key={`${hour}-${col}`}
                      className={`h-8 rounded-sm border border-gray-100 ${
                        isClass
                          ? 'bg-blue-100'
                          : isOrange
                            ? 'border-orange-300 bg-orange-50'
                            : 'bg-white'
                      }`}
                    >
                      {row === 0 && col === 1 && (
                        <span className="text-[8px] font-medium text-blue-700">자료구조</span>
                      )}
                      {isOrange && (
                        <span className="text-[8px] font-medium text-orange-600">확인필요</span>
                      )}
                    </div>
                  );
                })}
              </Fragment>
            ))}
          </div>
          <p className="mt-2 text-center text-[10px] text-gray-300">
            드래그하여 내 고정 일정 추가/수정
          </p>
        </div>
      </MockFrame>

      <GuideTip>
        시간표는 <strong>학기별</strong>로 관리됩니다(1학기·여름학기·2학기·겨울학기).
        학기가 바뀌면 왼쪽 위 학기 선택에서 새 학기를 고르고 다시 업로드하세요. 등록된
        수업을 누르면 상세 확인·수정·삭제도 됩니다.
      </GuideTip>

      <StepHeading no={3} title="안 되는 시간 제출하기" />
      <p className="mt-4 text-[15px] leading-7 text-gray-700">
        임원진이 일정을 만들면 사이드바의 타임라인 목록과 MY 탭의 &ldquo;내 할일&rdquo;에
        새 일정이 나타납니다. 제출은 네 단계면 끝납니다.
      </p>
      <ol className="mt-3 list-decimal space-y-1.5 pl-6 text-[15px] leading-7 text-gray-700">
        <li>
          일정을 열어 <strong>내 일정</strong> 탭으로 갑니다.
        </li>
        <li>
          30분 단위 그리드에서 <strong>안 되는 시간을 빨갛게 칠합니다</strong>. 되는 시간을
          고르는 게 아니라, 안 되는 시간만 표시하면 나머지는 전부 가능으로 칩니다.
        </li>
        <li>
          <strong>[내 시간표 불러오기]</strong>를 누르면 등록해 둔 시간표의 수업 시간이
          자동으로 불가능 처리됩니다. 손으로 칠할 필요가 없습니다.
        </li>
        <li>
          <strong>[저장하기]</strong>를 눌러 제출합니다.
        </li>
      </ol>
      <p className="mt-4 text-[15px] leading-7 text-gray-700">
        드래그가 불편하면 오른쪽 위 탭에서 <strong>직접 입력</strong> 모드로 바꿔 시간
        구간을 목록으로 추가할 수도 있습니다.
      </p>

      <MockFrame title="조별과제 회의" caption="내 일정 탭: 빨간 칸이 내가 안 되는 시간">
        <div className="mb-3 flex items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-100 px-3 py-2.5">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold leading-tight text-emerald-900">
              불가능한 시간을 칠하세요
            </p>
            <p className="mt-0.5 text-[10px] text-emerald-700">빨간색이 불가능한 시간입니다</p>
          </div>
          <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[10px] font-medium text-gray-600">
            드래그 | 직접 입력
          </span>
        </div>
        <div className="mb-3 flex items-stretch gap-2">
          <span className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-[11px] font-medium text-gray-600">
            <FiUpload size={12} />
            내 시간표 불러오기
          </span>
          <span className="flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-[11px] font-medium text-red-500">
            <FiRotateCcw size={12} />
            초기화
          </span>
        </div>
        <div className="rounded-xl border border-gray-200 p-2">
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
            ['17시', false, true],
            ['', false, true],
            ['18시', false, false],
            ['', true, false],
          ].map(([label, red1, red2], i) => (
            <div key={i} className="flex">
              <div className="flex w-7 shrink-0 items-center justify-start">
                {label && <span className="-mt-2 text-[10px] text-gray-400">{label as string}</span>}
              </div>
              <div className={`h-[22px] flex-1 border-r border-t border-gray-100 ${red1 ? 'bg-red-400' : 'bg-white'}`} />
              <div className={`h-[22px] flex-1 border-t border-gray-100 ${red2 ? 'bg-red-400' : 'bg-white'}`} />
            </div>
          ))}
        </div>
        <div className="mt-3 border-t border-gray-100 pt-3">
          <div className="w-full rounded-xl bg-gray-900 py-3 text-center text-base font-semibold text-white">
            저장하기
          </div>
        </div>
      </MockFrame>

      <GuideTip>
        그리드를 빠르게 칠하는 법. <strong>날짜 머리글을 누르면 그 날 하루 전체</strong>가,{' '}
        <strong>왼쪽 &ldquo;N시&rdquo; 라벨을 누르면 모든 날짜의 그 시간대</strong>가 한 번에
        토글됩니다. 하루 종일 안 되는 날은 머리글 한 번이면 끝. 칠하다가 나가도 입력 중이던
        내용은 기기에 임시 저장되어 다시 열면 이어서 할 수 있습니다.
      </GuideTip>

      <p className="mt-6 text-[15px] leading-7 text-gray-700">
        동아리 초대 없이 <strong>일정 링크만</strong> 받은 경우에도 문제없습니다. 일정
        화면에서 가입까지 한 번에 해결됩니다(4장 참고). 김철수가 할 일은 시간표 한 번
        등록해 두고, 일정이 올라올 때마다 확인하고 저장하는 것뿐입니다. 단톡방 투표는 더
        이상 없습니다.
      </p>
      <p className="mt-4 text-[15px] leading-7 text-gray-700">
        동아리 없이도 쓸 수 있습니다. 타임라인 홈의 &ldquo;동아리 없이 잡은 일정&rdquo;
        섹션에서 <strong>[+ 일정 잡기]</strong>로 일정을 만들고 링크만 공유하면, 과제 팀이나
        친구 모임처럼 가벼운 약속도 같은 방식으로 조율됩니다.
      </p>
    </section>
  );
}
