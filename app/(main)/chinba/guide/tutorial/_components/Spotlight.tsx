'use client';

import type { ReactNode } from 'react';

import SpeechBubble from './SpeechBubble';
import type { TutorialEngine } from './useTutorialEngine';

/**
 * 스포트라이트 오버레이 — 뷰포트 전체(실제 사이드바 포함)를 어둡게 덮어
 * 아래 요소의 클릭을 전부 차단한다. 대상은 TutorialTarget이 z-[90]으로 승격.
 * 오버레이 클릭 = "여기가 아니에요" → 말풍선 재생(nudge).
 */
export function TutorialOverlay({ engine }: { engine: TutorialEngine }) {
  const { step, transitioning } = engine;
  if (!step || transitioning || step.overlay === false) return null;
  return (
    <div
      className="fixed inset-0 z-[80] bg-black/40 animate-fadeIn"
      aria-hidden
      onClick={engine.nudge}
    />
  );
}

interface TutorialTargetProps {
  id: string;
  engine: TutorialEngine;
  className?: string;
  children: ReactNode;
}

/**
 * 스포트라이트 대상 래퍼.
 * active면 오버레이(z-80) 위로 승격(z-90)되고 파란 링 + 흰 배경으로 강조된다.
 * advance가 click이면 래퍼 클릭이 곧 스텝 완료다.
 */
export function TutorialTarget({ id, engine, className = '', children }: TutorialTargetProps) {
  const { step, transitioning } = engine;
  const active = !!step && step.target === id && !transitioning;
  const isClick = active && step.advance.kind === 'click';
  const bubble = active ? step.bubble : null;
  const showNext = active && step.advance.kind === 'next';
  const nextEnabled =
    active && (step.advance.kind === 'next' || step.advance.kind === 'click')
      ? (step.advance.enabledWhen?.(engine.state) ?? true)
      : true;

  return (
    <div
      id={`tut-${id}`}
      onClick={isClick ? () => engine.completeStep() : undefined}
      className={`${
        active
          ? `relative z-[90] rounded-xl bg-white ring-4 ring-blue-400/60 ${isClick ? 'cursor-pointer' : ''}`
          : 'relative'
      } ${className}`}
    >
      {children}
      {bubble && (
        <SpeechBubble
          content={bubble.content}
          placement={bubble.placement}
          align={bubble.align}
          nudgeKey={engine.nudgeKey}
          showNext={showNext}
          nextEnabled={nextEnabled}
          onNext={engine.completeStep}
        />
      )}
    </div>
  );
}
