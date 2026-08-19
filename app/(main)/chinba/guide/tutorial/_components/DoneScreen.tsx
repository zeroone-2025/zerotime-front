'use client';

import Link from 'next/link';

/** 튜토리얼 완료 화면 */
export default function DoneScreen({ onRestart }: { onRestart: () => void }) {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col items-center justify-center px-5 py-16 text-center">
      <p className="mb-6 text-7xl">🎉</p>
      <h1 className="text-2xl font-bold text-gray-900">튜토리얼 완료!</h1>
      <p className="mt-3 text-sm leading-relaxed text-gray-500">
        동아리 개설부터 시간 제출, 기록까지 전부 해봤어요. 이제 진짜 동아리를 만들 준비가
        됐습니다.
      </p>

      <div className="mt-10 flex w-full flex-col gap-2">
        <Link
          href="/chinba/"
          className="w-full rounded-xl bg-gray-900 py-4 text-center font-bold text-white transition-all hover:bg-gray-800"
        >
          타임라인 시작하기
        </Link>
        <button
          type="button"
          onClick={onRestart}
          className="w-full rounded-xl border border-gray-200 py-3 text-sm font-semibold text-gray-600 transition-all hover:border-gray-400"
        >
          처음부터 다시 해보기
        </button>
        <Link
          href="/chinba/guide/"
          className="w-full py-2 text-center text-sm font-medium text-gray-400 transition-all hover:text-gray-600"
        >
          설명서로 돌아가기
        </Link>
      </div>
    </div>
  );
}
