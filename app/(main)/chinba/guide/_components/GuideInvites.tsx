import { FiCopy, FiLink, FiRefreshCw, FiShare2, FiUsers } from 'react-icons/fi';

import { ChapterHeader, GuideTip, StepHeading } from './GuideBlocks';
import MockFrame from './MockFrame';

/**
 * 4장 — 링크와 초대
 * 동아리 초대링크(InviteSection)와 일정 전용 공유 링크(TeamJoinGate) 목업.
 */
export default function GuideInvites() {
  return (
    <section>
      <ChapterHeader
        no={4}
        id="invites"
        title="링크와 초대"
        subtitle="사람을 모으는 두 가지 방법, 동아리 초대링크와 일정 링크"
      />

      <StepHeading title="동아리 초대링크" />
      <p className="mt-4 text-[15px] leading-7 text-gray-700">
        동아리마다 고유한 초대 코드가 있습니다. 동아리 설정의 <strong>초대 링크</strong>{' '}
        섹션(또는 운영 패널의 <strong>[초대링크 복사]</strong>)에서 링크를 복사해 단톡방에
        붙이면, 받은 사람은 링크 한 번으로 가입이 끝납니다. 코드가 외부로 새어 나갔다면{' '}
        <strong>[초대 코드 재생성]</strong>으로 기존 링크를 무효화할 수 있습니다(재생성은
        회장·부회장만).
      </p>

      <MockFrame title="동아리 설정" caption="초대 링크 섹션: 복사·공유·재생성">
        <div className="space-y-3">
          <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
            <p className="mb-1 text-[11px] text-gray-400">초대 코드</p>
            <p className="break-all font-mono text-sm font-medium text-gray-700">a1b2c3d4e5</p>
          </div>
          <div className="flex gap-2">
            <span className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-medium text-gray-700">
              <FiCopy size={14} />
              링크 복사
            </span>
            <span className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gray-900 py-2.5 text-sm font-medium text-white">
              <FiShare2 size={14} />
              공유하기
            </span>
          </div>
          <span className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-gray-100 py-2.5 text-xs text-gray-400">
            <FiRefreshCw size={12} />
            초대 코드 재생성
          </span>
        </div>
      </MockFrame>

      <StepHeading title="일정 전용 공유 링크" />
      <p className="mt-4 text-[15px] leading-7 text-gray-700">
        모든 일정에는 그 일정만의 링크도 있습니다. 일정 화면 오른쪽 위의{' '}
        <FiLink className="inline text-gray-500" size={14} /> <strong>링크 복사</strong> /{' '}
        <FiShare2 className="inline text-gray-500" size={14} /> <strong>공유</strong> 버튼으로
        만들며, &ldquo;이번 회의 시간 제출해 주세요&rdquo;라고 일정 하나만 콕 집어 보낼 때
        씁니다. 아직 동아리에 가입하지 않은 사람이 이 링크를 열면 아래처럼 가입 안내
        화면이 먼저 나오는데, <strong>[가입하고 참여하기]</strong> 한 번이면 초대 코드 없이도
        그 동아리에 가입되면서 바로 일정에 참여합니다. 초대링크와 일정 링크 중 아무거나
        받아도 결국 합류할 수 있는 셈입니다.
      </p>

      <MockFrame title="조별과제 회의" caption="동아리 밖 사람이 일정 링크를 열었을 때: 가입과 참여가 한 번에">
        <div className="flex flex-col items-center px-2 py-4 text-center">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-gray-50">
            <FiUsers size={28} className="text-gray-400" />
          </div>
          <p className="text-lg font-bold text-gray-800">조별과제 회의</p>
          <p className="mt-1 text-sm text-gray-500">8/20(목) ~ 8/21(금)</p>
          <p className="mt-6 text-sm text-gray-700">
            이 일정은 <span className="font-bold text-gray-900">&lsquo;전북대 코딩 동아리&rsquo;</span>의
            일정입니다
          </p>
          <p className="mt-1 text-sm text-gray-500">참여하려면 동아리에 가입해야 해요</p>
          <div className="mt-8 flex w-full max-w-xs flex-col gap-2">
            <span className="w-full rounded-xl bg-gray-900 py-3 text-center text-base font-semibold text-white">
              가입하고 참여하기
            </span>
            <span className="w-full rounded-xl bg-gray-100 py-3 text-center text-base font-semibold text-gray-700">
              돌아가기
            </span>
          </div>
        </div>
      </MockFrame>

      <GuideTip>
        어떤 링크를 보낼지 헷갈린다면 이렇게 기억하세요. 사람을 <strong>모을 때는
        초대링크</strong>, 특정
        일정의 <strong>시간 제출을 받을 때는 일정 링크</strong>. 일정 링크로도 가입까지
        되므로, 신입에게 &ldquo;이번 회의부터 참여해&rdquo;라며 일정 링크 하나만 보내도
        됩니다.
      </GuideTip>
    </section>
  );
}
