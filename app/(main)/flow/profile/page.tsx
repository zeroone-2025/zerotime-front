'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { FiEdit3, FiLock, FiUser } from 'react-icons/fi';

import LoadingSpinner from '@/_components/ui/LoadingSpinner';
import { getAllDepartments } from '@/_lib/api';
import { usePublicCareer } from '@/_lib/hooks/useCareer';

import AwardCard from '../career/_components/view/AwardCard';
import CertificationCard from '../career/_components/view/CertificationCard';
import ContactCard from '../career/_components/view/ContactCard';
import EducationCard from '../career/_components/view/EducationCard';
import ExperienceCard from '../career/_components/view/ExperienceCard';
import LanguageScoreCard from '../career/_components/view/LanguageScoreCard';
import MentorQnACard from '../career/_components/view/MentorQnACard';
import SkillTagsCard from '../career/_components/view/SkillTagsCard';
import WorkCard from '../career/_components/view/WorkCard';

function admissionLabel(year: number | null | undefined): string | null {
  if (!year) return null;
  return `${String(year).slice(-2)}학번`;
}

function PublicFlowProfileInner() {
  const searchParams = useSearchParams();
  const rawUsername = searchParams.get('u') ?? '';
  const username = rawUsername.startsWith('@') ? rawUsername.slice(1) : rawUsername;
  const { data: profile, isLoading, error } = usePublicCareer(username || null);
  const [deptName, setDeptName] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.user.dept_code) {
      setDeptName(null);
      return;
    }
    getAllDepartments(true, profile.user.school ?? undefined)
      .then((depts) => {
        const found = depts.find((d) => d.dept_code === profile.user.dept_code);
        setDeptName(found?.dept_name || null);
      })
      .catch(() => setDeptName(null));
  }, [profile?.user.dept_code]);

  const experiences = useMemo(
    () => (profile?.activities ?? []).filter((a) => a.kind === 'experience'),
    [profile?.activities],
  );
  const awards = useMemo(
    () => (profile?.activities ?? []).filter((a) => a.kind === 'award'),
    [profile?.activities],
  );
  const admission = admissionLabel(profile?.user.admission_year);

  if (!username) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-50 px-5">
        <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-sm">
          <h1 className="text-base font-bold text-gray-900">프로필 주소가 올바르지 않습니다</h1>
          <p className="mt-1 text-sm text-gray-500">@아이디가 포함된 링크로 다시 접근해 주세요.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-50">
        <LoadingSpinner size="md" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-50 px-5">
        <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
            <FiLock size={22} />
          </div>
          <h1 className="mt-4 text-base font-bold text-gray-900">공개되지 않은 프로필입니다</h1>
          <p className="mt-1 text-sm text-gray-500">공개 설정이 켜진 이력만 볼 수 있어요.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="space-y-4 px-4 pt-4 pb-10">
        {profile.can_edit && profile.visibility === 'private' && (
          <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            비공개 상태의 미리보기입니다.
          </div>
        )}

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex items-center gap-4">
            {profile.user.profile_image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.user.profile_image}
                alt={profile.user.nickname || profile.user.username}
                className="h-16 w-16 rounded-full border border-gray-100 object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
                <FiUser size={28} />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-xl font-bold text-gray-900">
                  {profile.user.nickname || profile.name || profile.user.username}
                </h1>
                {profile.can_edit && (
                  <Link
                    href="/flow/career"
                    aria-label="이력 수정"
                    className="rounded-md p-1 text-gray-300 transition-colors hover:bg-gray-50 hover:text-gray-600"
                  >
                    <FiEdit3 size={14} />
                  </Link>
                )}
              </div>
              <p className="mt-0.5 truncate text-sm text-gray-500">@{profile.user.username}</p>
              <p className="mt-1 truncate text-xs text-gray-400">
                {[profile.user.school, deptName, admission].filter(Boolean).join(' · ')}
              </p>
            </div>
          </div>
        </section>

        {profile.language_scores.length > 0 && <LanguageScoreCard scores={profile.language_scores} />}
        {profile.certifications.length > 0 && <CertificationCard certifications={profile.certifications} />}
        {experiences.length > 0 && <ExperienceCard experiences={experiences} />}
        {awards.length > 0 && <AwardCard awards={awards} />}
        {profile.educations.length > 0 && <EducationCard educations={profile.educations} />}
        {profile.works.length > 0 && <WorkCard works={profile.works} />}
        {profile.skill_tags.length > 0 && <SkillTagsCard tags={profile.skill_tags} />}
        {profile.is_mentor && profile.mentor_qna && <MentorQnACard qna={profile.mentor_qna} />}
        {profile.visibility === 'public' && <ContactCard profile={profile} />}
      </div>
    </div>
  );
}

export default function PublicFlowProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center bg-gray-50">
          <LoadingSpinner size="md" />
        </div>
      }
    >
      <PublicFlowProfileInner />
    </Suspense>
  );
}
