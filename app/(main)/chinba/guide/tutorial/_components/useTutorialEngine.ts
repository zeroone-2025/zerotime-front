'use client';

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';

import { initialTutorialState, tutorialReducer } from './state';
import type { TutorialAction, TutorialState, TutorialStep } from './types';

export interface TutorialToastItem {
  id: number;
  message: string;
  type: 'success' | 'info';
}

export interface TutorialEngine {
  state: TutorialState;
  dispatch: React.Dispatch<TutorialAction>;
  step: TutorialStep | null;
  stepIndex: number;
  totalSteps: number;
  /** 장면 전환 애니메이션 중 — 스포트라이트·말풍선 표시 지연용 */
  transitioning: boolean;
  /** 오버레이(대상 외) 클릭 시 증가 — 말풍선 pulse 재생 트리거 */
  nudgeKey: number;
  toasts: TutorialToastItem[];
  isDone: boolean;
  completeStep: () => void;
  nudge: () => void;
  pushToast: (message: string, type?: 'success' | 'info') => void;
}

const SCENE_TRANSITION_MS = 350;
const SCRIPT_TAIL_MS = 700; // 마지막 연출 후 다음 스텝까지 여유
const STATE_ADVANCE_DELAY_MS = 500; // 조건 충족을 눈으로 확인할 시간

/**
 * 튜토리얼 스텝 엔진.
 * - click/next: completeStep() 호출 → onComplete 디스패치 → (script 있으면 연출 후) 다음 스텝
 * - auto: 스텝 진입 시 script 실행 → 끝나면 자동 진행
 * - state: 상태 조건 충족을 감지해 자동 진행
 * 모든 setTimeout은 ref에 모아 스텝 전환·언마운트 시 일괄 해제한다.
 */
export function useTutorialEngine(steps: TutorialStep[]): TutorialEngine {
  const [state, dispatch] = useReducer(tutorialReducer, initialTutorialState);
  const [stepIndex, setStepIndex] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const [nudgeKey, setNudgeKey] = useState(0);
  const [toasts, setToasts] = useState<TutorialToastItem[]>([]);

  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  // 토스트 제거 타이머는 스텝 전환과 무관하게 살아 있어야 한다 — timersRef와 분리
  const toastTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const toastIdRef = useRef(0);
  const completedRef = useRef(false); // 현재 스텝의 완료 처리 중복 방지
  const prevSceneRef = useRef<string | null>(null);

  const isDone = stepIndex >= steps.length;
  const step = isDone ? null : steps[stepIndex];

  const schedule = useCallback((fn: () => void, delay: number) => {
    timersRef.current.push(setTimeout(fn, delay));
  }, []);

  const clearStepTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  // 언마운트 시 모든 타이머 해제
  useEffect(
    () => () => {
      clearStepTimers();
      toastTimersRef.current.forEach(clearTimeout);
      toastTimersRef.current = [];
    },
    [clearStepTimers],
  );

  const pushToast = useCallback((message: string, type: 'success' | 'info' = 'info') => {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev.slice(-3), { id, message, type }]);
    toastTimersRef.current.push(
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000),
    );
  }, []);

  const advance = useCallback(() => {
    setStepIndex((i) => i + 1);
  }, []);

  const runScript = useCallback(
    (script: NonNullable<TutorialStep['script']>, onEnd?: () => void) => {
      let maxDelay = 0;
      for (const item of script) {
        maxDelay = Math.max(maxDelay, item.delayMs);
        schedule(() => {
          if (item.action) dispatch(item.action);
          if (item.toast) pushToast(item.toast.message, item.toast.type);
        }, item.delayMs);
      }
      if (onEnd) schedule(onEnd, maxDelay + SCRIPT_TAIL_MS);
    },
    [schedule, pushToast],
  );

  const completeStep = useCallback(() => {
    if (!step || completedRef.current) return;
    if (step.advance.kind === 'click' || step.advance.kind === 'next') {
      if (step.advance.enabledWhen && !step.advance.enabledWhen(state)) {
        setNudgeKey((k) => k + 1);
        return;
      }
    }
    completedRef.current = true;
    step.onComplete?.forEach(dispatch);
    if (step.script && step.advance.kind !== 'auto') {
      runScript(step.script, advance);
    } else {
      advance();
    }
  }, [step, state, runScript, advance]);

  const nudge = useCallback(() => setNudgeKey((k) => k + 1), []);

  // 스텝 진입: 타이머 정리, 장면 전환 감지, auto script 시작, 대상 스크롤
  useEffect(() => {
    if (!step) return;
    completedRef.current = false;
    clearStepTimers();

    const sceneChanged = prevSceneRef.current !== null && prevSceneRef.current !== step.scene;
    prevSceneRef.current = step.scene;
    if (sceneChanged) {
      setTransitioning(true);
      schedule(() => setTransitioning(false), SCENE_TRANSITION_MS);
    }

    if (step.target) {
      const targetId = step.target;
      schedule(
        () => {
          document
            .getElementById(`tut-${targetId}`)
            ?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        },
        sceneChanged ? SCENE_TRANSITION_MS + 50 : 80,
      );
    }

    if (step.advance.kind === 'auto' && step.script) {
      // 장면 전환이 끝난 뒤 연출 시작
      const startDelay = sceneChanged ? SCENE_TRANSITION_MS + 200 : 200;
      schedule(() => {
        completedRef.current = true;
        runScript(step.script!, advance);
      }, startDelay);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex]);

  // state 조건 스텝: 조건 충족 감지 → 잠시 후 자동 진행
  useEffect(() => {
    if (!step || completedRef.current) return;
    if (step.advance.kind !== 'state') return;
    if (!step.advance.when(state)) return;
    completedRef.current = true;
    const timer = setTimeout(() => {
      step.onComplete?.forEach(dispatch);
      if (step.script) {
        runScript(step.script, advance);
      } else {
        advance();
      }
    }, STATE_ADVANCE_DELAY_MS);
    timersRef.current.push(timer);
  }, [step, state, runScript, advance]);

  return {
    state,
    dispatch,
    step,
    stepIndex,
    totalSteps: steps.length,
    transitioning,
    nudgeKey,
    toasts,
    isDone,
    completeStep,
    nudge,
    pushToast,
  };
}
