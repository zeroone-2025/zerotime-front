'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { useUserStats } from '@/_lib/hooks/useUserStats';
import { FiUsers } from 'react-icons/fi';
import GuestSchoolSelector from '@/_components/ui/GuestSchoolSelector';

interface UserStatsBannerProps {
    isLoggedIn: boolean;
    school?: string;
    onSignupClick?: () => void;
}

// 각 자릿수를 아래에서 위로 슬라이드하는 컴포넌트
function RollingDigit({ digit, delay }: { digit: string; delay: number }) {
    const [prevDigit, setPrevDigit] = useState(digit);
    const [isRolling, setIsRolling] = useState(false);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (digit !== prevDigit) {
            setIsRolling(true);
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
            timeoutRef.current = setTimeout(() => {
                setPrevDigit(digit);
                setIsRolling(false);
            }, 600 + delay);
        }
    }, [digit, delay]);

    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    // 쉼표 등 숫자가 아닌 문자는 그대로 표시
    if (!/\d/.test(digit)) {
        return <span>{digit}</span>;
    }

    return (
        <span
            className="inline-block overflow-hidden relative"
            style={{ width: '1ch', height: '1em', lineHeight: '1', textAlign: 'center' }}
        >
            {/* 이전 숫자 (위로 올라가며 사라짐) */}
            <span
                className="block"
                style={{
                    transition: `transform ${0.6 + delay}s cubic-bezier(0.16, 1, 0.3, 1), opacity ${0.4 + delay}s ease`,
                    transform: isRolling ? 'translateY(-100%)' : 'translateY(0)',
                    opacity: isRolling ? 0 : 1,
                }}
            >
                {prevDigit}
            </span>
            {/* 새 숫자 (아래에서 올라옴) */}
            <span
                className="block absolute top-0 left-0 right-0"
                style={{
                    transition: `transform ${0.6 + delay}s cubic-bezier(0.16, 1, 0.3, 1), opacity ${0.4 + delay}s ease`,
                    transform: isRolling ? 'translateY(0)' : 'translateY(100%)',
                    opacity: isRolling ? 1 : 0,
                }}
            >
                {digit}
            </span>
        </span>
    );
}

// 숫자 카운트업 + 롤링 애니메이션 결합
function AnimatedCount({ value }: { value: number }) {
    const [displayValue, setDisplayValue] = useState(0);
    const prevTargetRef = useRef(0);
    const startTimeRef = useRef<number | null>(null);
    const rafRef = useRef<number | null>(null);

    useEffect(() => {
        if (value === 0) return;

        const startValue = prevTargetRef.current;
        prevTargetRef.current = value;
        startTimeRef.current = null;
        const duration = startValue === 0 ? 3500 : 1500;

        const animate = (currentTime: number) => {
            if (startTimeRef.current === null) {
                startTimeRef.current = currentTime;
            }

            const elapsed = currentTime - startTimeRef.current;
            const progress = Math.min(elapsed / duration, 1);
            const easeProgress = 1 - Math.pow(1 - progress, 3);

            const current = Math.round(startValue + (value - startValue) * easeProgress);
            setDisplayValue(current);

            if (progress < 1) {
                rafRef.current = requestAnimationFrame(animate);
            } else {
                setDisplayValue(value);
            }
        };

        rafRef.current = requestAnimationFrame(animate);

        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, [value]);

    const formatted = displayValue.toLocaleString('ko-KR');
    const chars = formatted.split('');

    return (
        <span className="inline-flex items-baseline font-bold text-blue-600" style={{ fontVariantNumeric: 'tabular-nums' }} aria-label={`${displayValue}명`}>
            {chars.map((char, i) => (
                <RollingDigit
                    key={`${chars.length}-${i}`}
                    digit={char}
                    delay={i * 0.03}
                />
            ))}
            <span>명</span>
        </span>
    );
}

export default function UserStatsBanner({ isLoggedIn, school, onSignupClick }: UserStatsBannerProps) {
    const { data: stats, isLoading } = useUserStats(school);

    if (!isLoggedIn) {
        // 통계 API 로딩/실패 여부와 무관하게 학교 선택 드롭다운은 항상 보여야 한다 —
        // stats는 왼쪽 홍보 문구에만 필요하고, 드롭다운 기능 자체는 이 API와 무관하다.
        const statsReady = !isLoading && !!stats;
        return (
            <div className="mx-4 mb-3 flex items-center gap-3 px-4 py-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 w-[calc(100%-2rem)] animate-slideDown">
                {statsReady ? (
                    // 배너 전체가 아니라 유도 문구만 클릭되게 한다 — 사용자는 "나만 놓치고
                    // 있을 수도? →"만 버튼으로 인식하므로, 배너 오탭으로 의도치 않게 로그인
                    // 화면에 가는 것을 막는다. block+text-left로 기존 <p>와 동일 기하 유지.
                    <div className="flex items-start gap-3 text-left min-w-0 flex-1">
                        <FiUsers size={20} className="text-blue-600 mt-0.5 shrink-0" />
                        <div className="min-w-0">
                            <p className="text-sm text-gray-700">
                                벌써 <AnimatedCount value={stats.total_users} />의 {stats.school} 학생이 제로타임을 쓰고 있어요
                            </p>
                            <button onClick={onSignupClick} className="block text-left text-xs font-semibold text-blue-600 mt-1.5">
                                나만 놓치고 있을 수도? →
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="min-w-0 flex-1" />
                )}
                <GuestSchoolSelector />
            </div>
        );
    }

    if (isLoading || !stats) return null;

    return (
        <div className="mx-4 mb-3 px-4 py-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 animate-slideDown">
            <div className="flex items-start gap-3">
                <FiUsers size={20} className="text-blue-600 mt-0.5 shrink-0" />
                <p className="text-sm text-gray-700">
                    제로타임은 <AnimatedCount value={stats.total_users} />의 {stats.school} 학생과 함께하고 있어요
                </p>
            </div>
        </div>
    );
}
