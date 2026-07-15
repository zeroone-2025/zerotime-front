'use client';

import { useEffect, useMemo, useState } from 'react';

import { useUser } from '@/_lib/hooks/useUser';
import { useCareer } from '@/_lib/hooks/useCareer';
import { getAllDepartments } from '@/_lib/api';
import LoadingSpinner from '@/_components/ui/LoadingSpinner';

import EditSheet, { type EditSection } from './_components/EditSheet';
import ProfileHeader from './_components/view/ProfileHeader';
import LanguageScoreCard from './_components/view/LanguageScoreCard';
import CertificationCard from './_components/view/CertificationCard';
import ExperienceCard from './_components/view/ExperienceCard';
import AwardCard from './_components/view/AwardCard';
import EducationCard from './_components/view/EducationCard';
import WorkCard from './_components/view/WorkCard';
import SkillTagsCard from './_components/view/SkillTagsCard';
import MentorQnACard from './_components/view/MentorQnACard';
import ContactCard from './_components/view/ContactCard';
import PublicProfilePanel from './_components/PublicProfilePanel';

export default function FlowCareerPage() {
  const { user } = useUser();
  const { data: profile, isLoading } = useCareer();
  const [editing, setEditing] = useState<EditSection>(null);
  const [deptName, setDeptName] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.dept_code) {
      setDeptName(null);
      return;
    }
    getAllDepartments(true)
      .then((depts) => {
        const found = depts.find((d) => d.dept_code === user.dept_code);
        setDeptName(found?.dept_name || null);
      })
      .catch(() => setDeptName(null));
  }, [user?.dept_code]);

  const experiences = useMemo(
    () => (profile?.activities ?? []).filter((a) => a.kind === 'experience'),
    [profile?.activities],
  );
  const awards = useMemo(
    () => (profile?.activities ?? []).filter((a) => a.kind === 'award'),
    [profile?.activities],
  );

  if (editing) {
    return (
      <div className="h-full bg-white">
        <EditSheet
          section={editing}
          profile={profile ?? null}
          user={user ?? null}
          onClose={() => setEditing(null)}
        />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="space-y-4 px-4 pt-4 pb-12">
        <ProfileHeader
          user={user ?? null}
          deptName={deptName}
          isMentor={profile?.is_mentor}
          visibility={profile?.visibility ?? 'private'}
          summary={{
            languageScores: profile?.language_scores?.length ?? 0,
            certifications: profile?.certifications?.length ?? 0,
            experiences: experiences.length,
            awards: awards.length,
          }}
          onEdit={() => setEditing('profile')}
        />
        <PublicProfilePanel
          profile={profile ?? null}
          user={user ?? null}
          onEditProfile={() => setEditing('profile')}
        />

        {isLoading ? (
          <div className="flex h-[200px] items-center justify-center">
            <LoadingSpinner size="md" />
          </div>
        ) : (
          <>
            <LanguageScoreCard
              scores={profile?.language_scores ?? []}
              onEdit={() => setEditing('language_scores')}
            />
            <CertificationCard
              certifications={profile?.certifications ?? []}
              onEdit={() => setEditing('certifications')}
            />
            <ExperienceCard
              experiences={experiences}
              onEdit={() => setEditing('experiences')}
            />
            <AwardCard awards={awards} onEdit={() => setEditing('awards')} />
            <EducationCard
              educations={profile?.educations ?? []}
              onEdit={() => setEditing('educations')}
            />
            <WorkCard
              works={profile?.works ?? []}
              onEdit={() => setEditing('works')}
            />
            <SkillTagsCard
              tags={profile?.skill_tags ?? []}
              onEdit={() => setEditing('skills')}
            />
            {profile?.is_mentor && (
              <MentorQnACard
                qna={profile?.mentor_qna ?? null}
                onEdit={() => setEditing('mentor_qna')}
              />
            )}
            <ContactCard profile={profile ?? null} onEdit={() => setEditing('contact')} />
          </>
        )}
      </div>
    </div>
  );
}
