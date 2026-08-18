import type { ReactNode } from 'react';

/** 설명서 공통 타이포그래피 블록 — 챕터/스텝/문단/팁의 위계와 간격을 한 곳에서 관리한다. */

export function ChapterHeader({
  no,
  title,
  subtitle,
  id,
}: {
  no: number;
  title: string;
  subtitle: string;
  id: string;
}) {
  return (
    <div id={id} className="mt-16 scroll-mt-6 border-t border-gray-100 pt-10">
      <p className="text-xs font-bold tracking-widest text-emerald-600">CHAPTER {no}</p>
      <h2 className="mt-1.5 text-2xl font-bold text-gray-900">{title}</h2>
      <p className="mt-1.5 text-sm text-gray-400">{subtitle}</p>
    </div>
  );
}

export function StepHeading({ no, title }: { no?: number; title: string }) {
  return (
    <div className="mt-12 flex items-center gap-2.5">
      {no !== undefined && (
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-900 text-sm font-bold text-white">
          {no}
        </span>
      )}
      <h3 className="text-lg font-bold text-gray-900">{title}</h3>
    </div>
  );
}

export function GuideP({ children }: { children: ReactNode }) {
  return <p className="mt-4 text-[15px] leading-7 text-gray-700">{children}</p>;
}

export function GuideTip({ label = '💡 팁', children }: { label?: string; children: ReactNode }) {
  return (
    <div className="mt-5 border-l-2 border-blue-300 bg-blue-50 px-4 py-3">
      <p className="text-xs font-bold text-blue-700">{label}</p>
      <div className="mt-1.5 text-sm leading-relaxed text-blue-900">{children}</div>
    </div>
  );
}
