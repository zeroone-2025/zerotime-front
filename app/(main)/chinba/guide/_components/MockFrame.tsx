import type { ReactNode } from 'react';

interface MockFrameProps {
  title?: string;
  caption?: string;
  children: ReactNode;
}

/**
 * 설명서 전용 화면 목업 프레임.
 * 실제 앱 화면의 마크업(Tailwind 클래스)을 복제해 "코드로 그린 스크린샷"처럼 보여준다.
 * - pointer-events-none: 버튼 마크업이 들어 있어도 그림일 뿐 클릭되지 않는다.
 * - 실제 컴포넌트를 import하지 않는다(훅·데이터 바인딩 때문) — 클래스 문자열만 복제.
 */
export default function MockFrame({ title, caption, children }: MockFrameProps) {
  return (
    <figure className="my-7">
      <div
        role="img"
        aria-label={caption || title || '앱 화면 예시'}
        className="pointer-events-none select-none overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
      >
        {title && (
          <div className="border-b border-gray-100 px-4 py-3 text-center text-sm font-bold text-gray-800">
            {title}
          </div>
        )}
        <div className="p-4">{children}</div>
      </div>
      {caption && (
        <figcaption className="mt-2 text-center text-xs text-gray-400">{caption}</figcaption>
      )}
    </figure>
  );
}
