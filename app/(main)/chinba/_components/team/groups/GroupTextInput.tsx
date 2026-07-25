'use client';

import { useState } from 'react';

import LoadingSpinner from '@/_components/ui/LoadingSpinner';

interface GroupTextInputProps {
  onParse: (text: string) => void;
  isParsing: boolean;
  onBack?: () => void;
}

export default function GroupTextInput({ onParse, isParsing, onBack }: GroupTextInputProps) {
  const [text, setText] = useState('');

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 px-4 py-4">
        <label className="block text-sm font-bold text-gray-700 mb-2">
          조 편성 텍스트 입력
        </label>
        <p className="text-xs text-gray-400 mb-3">
          엑셀, 카톡, 메모장 등 어떤 형식이든 OK
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`예시:\n1조: 홍길동(조장), 김철수, 이영희\n2조: 박지민(조장), 최수진, 정민호\n\n또는 엑셀에서 복사한 표 형식도 가능합니다.`}
          className="w-full h-64 rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-800 placeholder-gray-400 outline-none focus:border-gray-900 transition-colors resize-none"
          autoFocus
        />
      </div>

      <div className="shrink-0 px-4 py-3 pb-safe border-t border-gray-100 flex gap-2">
        {onBack && (
          <button
            onClick={onBack}
            disabled={isParsing}
            className="flex-1 rounded-lg border border-gray-200 px-6 py-3 text-base font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            돌아가기
          </button>
        )}
        <button
          onClick={() => onParse(text)}
          disabled={!text.trim() || isParsing}
          className="flex-1 rounded-lg bg-gray-900 px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isParsing ? (
            <span className="flex items-center justify-center gap-2">
              <LoadingSpinner size="sm" color="white" />
              분석 중...
            </span>
          ) : (
            'AI로 분석하기'
          )}
        </button>
      </div>
    </div>
  );
}
