'use client';

import Link from 'next/link';

/** 튜토리얼 시작 화면 */
export default function StartScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-5 py-12">
      <p className="text-xs font-bold tracking-widest text-emerald-600">TIMELINE TUTORIAL</p>
      <h1 className="mt-2 text-3xl font-bold text-gray-900">타임라인 튜토리얼</h1>
      <p className="mt-3 text-[15px] leading-7 text-gray-600">
        실제 화면과 똑같은 연습 공간이에요. 동아리를 만들고, 부원을 초대하고, 시간을 제출하고,
        기록까지 남겨봅니다. 말풍선이 가리키는 버튼만 누르면 됩니다.
      </p>

      <div className="mt-10 flex flex-col gap-2">
        <button
          type="button"
          onClick={onStart}
          className="w-full bg-gray-900 py-4 text-center text-base font-bold text-white transition-all hover:bg-gray-800 active:scale-[0.99]"
        >
          튜토리얼 시작하기
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
