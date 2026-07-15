'use client';

import { useState, useEffect, useRef, type KeyboardEvent } from 'react';

import { useQueryClient } from '@tanstack/react-query';
import { FiCalendar, FiCheck, FiX } from 'react-icons/fi';

import UserInfoForm, { UserInfoFormData } from '@/_components/auth/UserInfoForm';
import FullPageModal from '@/_components/layout/FullPageModal';
import Logo from '@/_components/ui/Logo';
import {
  completeOnboarding,
  saveCareerContact,
  saveCareerEducations,
  saveCareerMentorQnA,
  saveCareerSkills,
  saveCareerWorks,
} from '@/_lib/api';
import { GUEST_DEFAULT_BOARDS } from '@/_lib/constants/boards';
import { MAJOR_PRESETS } from '@/_lib/constants/presets';
import { clearPendingOnboarding, savePendingOnboarding, loadPendingOnboarding } from '@/_lib/onboarding/pendingSubmission';
import type { PendingOnboardingSubmission } from '@/_lib/onboarding/pendingSubmission';
import { useUserStore } from '@/_lib/store/useUserStore';
import type {
  CareerContactUpdate,
  CareerEducationsUpdate,
  CareerMentorQnAUpdate,
  CareerSkillsUpdate,
  CareerWorksUpdate,
  Education,
  MentorQnA,
  WorkExperience,
} from '@/_types/career';
import type { OnboardingRequest } from '@/_types/user';

import ReviewSummary from './onboarding/ReviewSummary';

interface OnboardingModalProps {
  isOpen: boolean;
  onComplete: (categories: string[], options?: { redirectTo?: string }) => void;
  onShowToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
  isLoggedIn?: boolean;
  onRequireLogin?: (pendingData: PendingOnboardingSubmission) => void;
  onSeniorCompleted?: () => void;
}

type UserType = 'student' | 'senior';
type VisibilityType = 'public' | 'career_only';
type EducationDegreeType = Education['degree'];
type EducationStatusType = Education['status'];
type SeniorStepKey =
  | 'basic'
  | 'contact'
  | 'skills'
  | 'works'
  | 'senior-qna'
  | 'review';
type ReviewEditableStepKey = Exclude<SeniorStepKey, 'review'>;

interface SeniorStep {
  key: SeniorStepKey;
  title: string;
  description: string;
  optional?: boolean;
}

const SENIOR_STEPS: SeniorStep[] = [
  {
    key: 'basic',
    title: '학력 정보',
    description: '학력 정보를 입력해 주세요',
  },
  {
    key: 'contact',
    title: '연락 정보',
    description: '연락처와 공개 범위를 설정해 주세요',
  },
  {
    key: 'skills',
    title: '직무 키워드',
    description: '경험한 직무 키워드를 입력해 주세요',
  },
  {
    key: 'works',
    title: '경력',
    description: '회사와 직무 경험을 입력해 주세요',
  },
  {
    key: 'senior-qna',
    title: '선배님 Q&A',
    description: '후배들을 위한 조언을 남겨 주세요',
  },
  {
    key: 'review',
    title: '최종 확인',
    description: '입력한 내용을 확인하고 완료해 주세요',
  },
];
const SENIOR_QNA_STEP_INDEX = SENIOR_STEPS.findIndex((step) => step.key === 'senior-qna');

const EMPLOYMENT_OPTIONS: WorkExperience['employment_type'][] = [
  'full_time',
  'contract',
  'intern',
  'freelance',
  'part_time',
];
const EMPLOYMENT_LABELS: Record<WorkExperience['employment_type'], string> = {
  full_time: '정규직',
  contract: '계약직',
  intern: '인턴',
  freelance: '프리랜서',
  part_time: '파트타임',
};
const EDUCATION_DEGREE_OPTIONS: EducationDegreeType[] = [
  'middle_school',
  'high_school',
  'associate',
  'bachelor',
  'master',
  'doctor',
];
const EDUCATION_DEGREE_LABELS: Record<EducationDegreeType, string> = {
  middle_school: '중졸',
  high_school: '고졸',
  associate: '전문학사',
  bachelor: '학사',
  master: '석사',
  doctor: '박사',
};
const EDUCATION_STATUS_OPTIONS: EducationStatusType[] = ['enrolled', 'leave', 'graduated', 'completed'];
const EDUCATION_STATUS_LABELS: Record<EducationStatusType, string> = {
  enrolled: '재학',
  leave: '휴학',
  graduated: '졸업',
  completed: '수료',
};
const GRADUATION_REQUIRED_STATUSES: EducationStatusType[] = ['graduated', 'completed'];

const YEAR_REGEX = /^\d{4}$/;
const GRADUATION_YEAR_OPTIONS = Array.from({ length: 47 }, (_, i) => (2026 - i).toString());
const ADMISSION_YEAR_OPTIONS = Array.from({ length: 17 }, (_, i) => (26 - i).toString());
const SKILL_TAG_CLASS = 'border-sky-200 bg-sky-50 text-sky-800 hover:border-sky-300';

const createEmptyWork = (isCurrent = false): Omit<WorkExperience, 'id'> => ({
  start_date: '',
  end_date: null,
  is_current: isCurrent,
  company: '',
  position: '',
  employment_type: 'full_time',
  region: '',
});

const createEmptySeniorQna = (): MentorQnA => ({
  targeted_capital: null,
  reason_for_local: null,
  helpful_organizations: null,
  local_advantages: null,
  local_disadvantages: null,
  advice_for_juniors: null,
});

const toLocalUserType = (userType: OnboardingRequest['user_type']): UserType =>
  userType === 'mentor' ? 'senior' : 'student';

const toApiUserType = (userType: UserType): OnboardingRequest['user_type'] =>
  userType === 'senior' ? 'mentor' : 'student';

const ONBOARDING_DRAFT_STORAGE_KEY = 'onboarding_draft_v1';

interface OnboardingDraftState {
  version: 1;
  step: 1 | 2;
  userType: UserType | null;
  formData: UserInfoFormData;
  seniorStepIndex: number;
  seniorQnaSubStep: 1 | 2;
  contactData: {
    phone: string;
    visibility: VisibilityType;
  };
  skillTags: string[];
  works: Omit<WorkExperience, 'id'>[];
  educationDegree: EducationDegreeType | '';
  educationStatus: EducationStatusType | '';
  graduationYear: string;
  seniorQna: MentorQnA;
  hasPrivacyConsent: boolean;
}

const loadOnboardingDraft = (): OnboardingDraftState | null => {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(ONBOARDING_DRAFT_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as OnboardingDraftState;
    if (parsed?.version !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
};

const saveOnboardingDraft = (draft: OnboardingDraftState): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ONBOARDING_DRAFT_STORAGE_KEY, JSON.stringify(draft));
};

const clearOnboardingDraft = (): void => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(ONBOARDING_DRAFT_STORAGE_KEY);
};

const toNullable = (value: string): string | null => {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const getCurrentYearMonth = (): string => {
  const now = new Date();
  return `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}`;
};

function RequirementBadge() {
  return (
    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500">선택</span>
  );
}

export default function OnboardingModal({
  isOpen,
  onComplete,
  onShowToast,
  isLoggedIn = true,
  onRequireLogin,
  onSeniorCompleted,
}: OnboardingModalProps) {
  const queryClient = useQueryClient();
  const setUser = useUserStore((state) => state.setUser);
  const currentUser = useUserStore((state) => state.user);

  const [step, setStep] = useState<1 | 2>(1);
  const [userType, setUserType] = useState<UserType | null>(null);
  const [formData, setFormData] = useState<UserInfoFormData>({
    nickname: '',
    username: '',
    school: '',
    dept_code: '',
    dept_name: '',
    admission_year: '',
  });
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [seniorStepIndex, setSeniorStepIndex] = useState<number>(0);
  const [slideDirection, setSlideDirection] = useState<1 | -1>(1);
  const [contactData, setContactData] = useState<{
    phone: string;
    visibility: VisibilityType;
  }>({
    phone: '',
    visibility: 'public',
  });
  const [skillInput, setSkillInput] = useState<string>('');
  const [skillTags, setSkillTags] = useState<string[]>([]);
  const [works, setWorks] = useState<Omit<WorkExperience, 'id'>[]>([createEmptyWork(false)]);
  const [educationDegree, setEducationDegree] = useState<EducationDegreeType | ''>('');
  const [educationStatus, setEducationStatus] = useState<EducationStatusType | ''>('');
  const [graduationYear, setGraduationYear] = useState<string>('');
  const [seniorQna, setSeniorQna] = useState<MentorQnA>(createEmptySeniorQna());
  const [seniorQnaSubStep, setSeniorQnaSubStep] = useState<1 | 2>(1);
  const [invalidFields, setInvalidFields] = useState<Set<string>>(new Set());
  const [seniorCompleted, setSeniorCompleted] = useState<string[] | null>(null);
  const [hasPrivacyConsent, setHasPrivacyConsent] = useState<boolean>(false);
  const [reviewEditStepKey, setReviewEditStepKey] = useState<ReviewEditableStepKey | null>(null);
  const [isDraftLoaded, setIsDraftLoaded] = useState<boolean>(false);
  const didRestoreRef = useRef(false);

  const isGraduationYearRequired = educationStatus !== '' && GRADUATION_REQUIRED_STATUSES.includes(educationStatus);
  const availableGraduationYearOptions = GRADUATION_YEAR_OPTIONS;
  const admissionYearFull = /^\d{2}$/.test(formData.admission_year.trim())
    ? Number(`20${formData.admission_year.trim()}`)
    : null;
  const availableGraduationYearOptionsByAdmission = admissionYearFull
    ? availableGraduationYearOptions.filter((year) => Number(year) >= admissionYearFull)
    : availableGraduationYearOptions;

  // localStorage에 저장된 pending 데이터가 있으면 폼 복원
  useEffect(() => {
    if (didRestoreRef.current) return;
    didRestoreRef.current = true;

    const draft = loadOnboardingDraft();
    if (draft) {
      setStep(draft.step === 2 ? 2 : 1);
      setUserType(draft.userType === 'student' || draft.userType === 'senior' ? draft.userType : null);
      setFormData((prev) => ({ ...prev, ...draft.formData }));
      setSeniorStepIndex(Math.min(Math.max(draft.seniorStepIndex || 0, 0), SENIOR_STEPS.length - 1));
      setSeniorQnaSubStep(draft.seniorQnaSubStep === 2 ? 2 : 1);
      setContactData({
        phone: draft.contactData?.phone || '',
        visibility: draft.contactData?.visibility === 'career_only' ? 'career_only' : 'public',
      });
      setSkillTags(Array.isArray(draft.skillTags) ? draft.skillTags : []);
      setWorks(Array.isArray(draft.works) && draft.works.length > 0 ? draft.works : [createEmptyWork(false)]);
      setEducationDegree(draft.educationDegree || '');
      setEducationStatus(draft.educationStatus || '');
      setGraduationYear(draft.graduationYear || '');
      setSeniorQna(draft.seniorQna || createEmptySeniorQna());
      setHasPrivacyConsent(Boolean(draft.hasPrivacyConsent));
      setIsDraftLoaded(true);
      return;
    }

    const pending = loadPendingOnboarding();
    if (!pending) {
      setIsDraftLoaded(true);
      return;
    }

    const { onboarding, seniorCareer } = pending;
    const restoredUserType = toLocalUserType(onboarding.user_type);
    setUserType(restoredUserType);
    setFormData((prev) => ({
      ...prev,
      school: onboarding.school || '',
      dept_code: onboarding.dept_code || '',
      dept_name: restoredUserType === 'senior' ? onboarding.dept_code || '' : prev.dept_name,
      admission_year: onboarding.admission_year != null ? String(onboarding.admission_year) : '',
    }));
    setStep(2);

    if (restoredUserType === 'senior' && seniorCareer) {
      setContactData({
        phone: seniorCareer.contact.phone || '',
        visibility: (seniorCareer.contact.visibility as VisibilityType) || 'public',
      });
      setSkillTags(seniorCareer.skills.skill_tags || []);
      if (seniorCareer.works.works.length > 0) {
        setWorks(seniorCareer.works.works);
      }
      if (seniorCareer.educations.educations.length > 0) {
        const edu = seniorCareer.educations.educations[0];
        setEducationDegree((edu.degree as EducationDegreeType) || '');
        setEducationStatus((edu.status as EducationStatusType) || '');
        if (edu.end_date) setGraduationYear(edu.end_date);
      }
      setSeniorQna(seniorCareer.mentor_qna.mentor_qna);
      setHasPrivacyConsent(Boolean(pending.seniorPrivacyConsent));
      // 최종 확인 단계로 이동
      setSeniorStepIndex(SENIOR_STEPS.length - 1);
    }
    setIsDraftLoaded(true);
  }, []);

  useEffect(() => {
    if (!isDraftLoaded) return;

    saveOnboardingDraft({
      version: 1,
      step,
      userType,
      formData,
      seniorStepIndex,
      seniorQnaSubStep,
      contactData,
      skillTags,
      works,
      educationDegree,
      educationStatus,
      graduationYear,
      seniorQna,
      hasPrivacyConsent,
    });
  }, [
    isDraftLoaded,
    step,
    userType,
    formData,
    seniorStepIndex,
    seniorQnaSubStep,
    contactData,
    skillTags,
    works,
    educationDegree,
    educationStatus,
    graduationYear,
    seniorQna,
    hasPrivacyConsent,
  ]);

  // 학번(입학년도)보다 이른 졸업년도는 자동으로 정리
  useEffect(() => {
    if (!admissionYearFull || !graduationYear) return;
    if (Number(graduationYear) >= admissionYearFull) return;

    setGraduationYear('');
    setInvalidFields((prev) => {
      if (!prev.has('basic_graduation_year')) return prev;
      const next = new Set(prev);
      next.delete('basic_graduation_year');
      return next;
    });
  }, [admissionYearFull, graduationYear]);

  const handleUserTypeSelect = (type: UserType) => {
    setUserType(type);
    setReviewEditStepKey(null);
    if (type === 'senior') {
      setSeniorStepIndex(0);
      setSeniorQnaSubStep(1);
      setSlideDirection(1);
    }
  };

  const handleResetOnboardingSelection = () => {
    clearOnboardingDraft();
    clearPendingOnboarding();
    setStep(1);
    setUserType(null);
    setFormData({
      nickname: '',
      username: '',
      school: '',
      dept_code: '',
      dept_name: '',
      admission_year: '',
    });
    setSeniorStepIndex(0);
    setSlideDirection(1);
    setContactData({
      phone: '',
      visibility: 'public',
    });
    setSkillInput('');
    setSkillTags([]);
    setWorks([createEmptyWork(false)]);
    setEducationDegree('');
    setEducationStatus('');
    setGraduationYear('');
    setSeniorQna(createEmptySeniorQna());
    setSeniorQnaSubStep(1);
    setInvalidFields(new Set());
    setHasPrivacyConsent(false);
    setReviewEditStepKey(null);
  };

  const handleNext = () => {
    if (!userType) return;
    setStep(2);
  };

  const buildStudentBoardCodes = () => {
    let boardCodes: string[] = [...GUEST_DEFAULT_BOARDS];
    if (formData.dept_code) {
      // MAJOR_PRESETS는 전북대 학과만 큐레이션돼 있음 — 학교 체크 없이 라벨만
      // 비교하면 다른 학교의 동명 학과(예: 경북대 소프트웨어학과)가 오매칭된다.
      const preset = formData.school === '전북대'
        ? MAJOR_PRESETS.find(
            (p) => p.label === formData.dept_name || p.id === formData.dept_code.replace('dept_', ''),
          )
        : undefined;
      if (preset) {
        boardCodes = preset.categories;
      } else {
        boardCodes.push(formData.dept_code);
      }
    }
    return boardCodes;
  };

  const requestLoginForPendingSave = (pendingData: PendingOnboardingSubmission) => {
    savePendingOnboarding(pendingData);
    onShowToast?.('로그인 후 저장을 완료해 주세요.', 'info');
    onRequireLogin?.(pendingData);
  };

  const handleSubmit = async () => {
    if (!userType) return;
    if (userType === 'student') {
      if (!formData.school.trim()) {
        alert('학교를 입력해 주세요.');
        return;
      }
      if (!formData.dept_code.trim()) {
        alert('학과를 선택해 주세요.');
        return;
      }
      if (!formData.admission_year.trim()) {
        alert('학번을 선택해 주세요.');
        return;
      }
      if (!/^\d{2}$/.test(formData.admission_year.trim())) {
        alert('학번은 2자리 숫자로 입력해 주세요. (예: 21)');
        return;
      }
    }

    const boardCodes = buildStudentBoardCodes();
    const onboardingPayload: OnboardingRequest = {
      user_type: toApiUserType(userType),
      school: formData.school.trim(),
      dept_code: formData.dept_code || undefined,
      admission_year: formData.admission_year ? parseInt(formData.admission_year, 10) : undefined,
      board_codes: boardCodes,
    };

    if (!isLoggedIn) {
      requestLoginForPendingSave({ onboarding: onboardingPayload });
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await completeOnboarding(onboardingPayload);

      queryClient.setQueryData(['user', 'profile'], result.user);
      setUser(result.user);
      localStorage.setItem('my_subscribed_categories', JSON.stringify(result.subscribed_boards));
      clearOnboardingDraft();
      onShowToast?.('제로타임에 오신 것을 환영합니다! 🎉', 'success');
      onComplete(result.subscribed_boards);
    } catch (error) {
      console.error('온보딩 처리 실패:', error);
      alert('정보 저장에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = async () => {
    if (!userType) return;

    const confirmMessage =
      userType === 'student'
        ? '학과 정보를 입력하지 않고 시작할까요?\n나중에 설정에서 언제든지 변경할 수 있습니다.'
        : '학교 정보 없이 시작할까요?\n나중에 설정에서 언제든지 변경할 수 있습니다.';
    if (!confirm(confirmMessage)) return;

    const onboardingPayload: OnboardingRequest = {
      user_type: toApiUserType(userType),
      school: '',
      board_codes: [...GUEST_DEFAULT_BOARDS],
    };

    if (!isLoggedIn) {
      requestLoginForPendingSave({ onboarding: onboardingPayload });
      return;
    }

    setIsSubmitting(true);
    try {
      const defaultBoards = onboardingPayload.board_codes;
      const result = await completeOnboarding(onboardingPayload);

      queryClient.setQueryData(['user', 'profile'], result.user);
      setUser(result.user);
      localStorage.setItem('my_subscribed_categories', JSON.stringify(defaultBoards));
      clearOnboardingDraft();
      onShowToast?.('제로타임에 오신 것을 환영합니다! 🎉', 'success');
      onComplete(defaultBoards);
    } catch (error) {
      console.error('건너뛰기 실패:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const clearInvalidField = (fieldKey: string) => {
    setInvalidFields((prev) => {
      if (!prev.has(fieldKey)) return prev;
      const next = new Set(prev);
      next.delete(fieldKey);
      return next;
    });
  };
  const hasInvalidField = (fieldKey: string) => invalidFields.has(fieldKey);

  const currentSeniorStep = SENIOR_STEPS[seniorStepIndex];
  const totalSeniorScreens = SENIOR_STEPS.length + 1; // 선배님 Q&A를 2페이지로 분리
  const currentSeniorScreen = (() => {
    let current = seniorStepIndex + 1;
    if (seniorStepIndex > SENIOR_QNA_STEP_INDEX) current += 1;
    if (seniorStepIndex === SENIOR_QNA_STEP_INDEX && seniorQnaSubStep === 2) current += 1;
    return current;
  })();
  const seniorProgress = (currentSeniorScreen / totalSeniorScreens) * 100;
  const seniorStepDescription =
    currentSeniorStep?.key === 'senior-qna'
      ? seniorQnaSubStep === 1
        ? '경험과 배경 관련 질문에 답변해 주세요'
        : '인사이트와 조언 관련 질문에 답변해 주세요'
      : currentSeniorStep?.description || '';
  const isReviewEditMode = reviewEditStepKey !== null && currentSeniorStep?.key !== 'review';
  const seniorStepTitle = (() => {
    if (!currentSeniorStep) return '';
    if (currentSeniorStep.key !== 'senior-qna') return currentSeniorStep.title;
    if (isReviewEditMode) return '선배님 Q&A 수정';
    return `선배님 Q&A (${seniorQnaSubStep}/2)`;
  })();
  const seniorStepDescriptionText = isReviewEditMode
    ? '수정 후 하단의 수정완료 버튼을 눌러 최종 확인으로 돌아가세요.'
    : seniorStepDescription;
  const isStudentSubmitDisabled =
    isSubmitting ||
    !formData.school.trim() ||
    !formData.dept_code.trim() ||
    !formData.admission_year.trim() ||
    !/^\d{2}$/.test(formData.admission_year.trim());

  const hasAnyWorkInput = (work: Omit<WorkExperience, 'id'>) =>
    Boolean(work.company.trim() || work.position.trim() || work.region || work.is_current);

  const getSeniorMissingFields = (): string[] => {
    if (!currentSeniorStep) return [];
    const missing: string[] = [];

    if (currentSeniorStep.key === 'basic') {
      if (!formData.school.trim()) missing.push('basic_school');
      if (!formData.dept_name.trim()) missing.push('basic_major');
      if (!formData.admission_year.trim()) missing.push('basic_admission_year');
      if (!educationDegree) missing.push('basic_degree');
      if (!educationStatus) missing.push('basic_status');
      if (isGraduationYearRequired && !graduationYear.trim()) missing.push('basic_graduation_year');
    }

    if (currentSeniorStep.key === 'contact') {
      // name, email은 currentUser에서 자동으로 가져옴
    }

    if (currentSeniorStep.key === 'skills' && skillTags.length === 0) {
      missing.push('skills_tags');
    }

    if (currentSeniorStep.key === 'works') {
      const hasAtLeastOneWork = works.some((work) => hasAnyWorkInput(work));
      if (!hasAtLeastOneWork) {
        missing.push('works_0_company');
        missing.push('works_0_position');
        return missing;
      }

      for (let i = 0; i < works.length; i += 1) {
        const work = works[i];
        if (!hasAnyWorkInput(work)) continue;
        if (!work.company.trim()) missing.push(`works_${i}_company`);
        if (!work.position.trim()) missing.push(`works_${i}_position`);
      }
    }

    if (currentSeniorStep.key === 'senior-qna') {
      if (seniorQnaSubStep === 1) {
        if (seniorQna.targeted_capital === null) missing.push('senior_qna_targeted_capital');
        if (!toNullable(seniorQna.reason_for_local || '')) missing.push('senior_qna_reason_for_local');
        if (!toNullable(seniorQna.helpful_organizations || '')) missing.push('senior_qna_helpful_organizations');
      } else {
        if (!toNullable(seniorQna.local_advantages || '')) missing.push('senior_qna_local_advantages');
        if (!toNullable(seniorQna.local_disadvantages || '')) missing.push('senior_qna_local_disadvantages');
      }
    }

    if (currentSeniorStep.key === 'review' && !hasPrivacyConsent) {
      missing.push('review_privacy_consent');
    }

    return missing;
  };

  const validateSeniorStepFormat = (): string | null => {
    if (!currentSeniorStep) return null;

    if (currentSeniorStep.key === 'basic') {
      if (formData.admission_year.trim() && !/^\d{2}$/.test(formData.admission_year.trim())) {
        return '학번은 2자리 숫자로 입력해 주세요. (예: 21)';
      }
      if (isGraduationYearRequired && graduationYear.trim() && !YEAR_REGEX.test(graduationYear.trim())) {
        return '졸업년도는 YYYY 형식으로 입력해 주세요. (예: 2024)';
      }
      if (
        isGraduationYearRequired &&
        graduationYear.trim() &&
        admissionYearFull &&
        Number(graduationYear.trim()) < admissionYearFull
      ) {
        return `졸업년도는 학번(입학년도 ${admissionYearFull}년)보다 빠를 수 없습니다.`;
      }
    }

    if (currentSeniorStep.key === 'contact') {
      // email은 currentUser에서 자동으로 가져옴
    }

    if (currentSeniorStep.key === 'works') {
      // company, position만 검증 (시작/종료 날짜 없음)
    }

    return null;
  };

  const handleAddSkillTag = () => {
    const newTag = skillInput.trim();
    if (!newTag) return;
    if (skillTags.includes(newTag)) {
      setSkillInput('');
      return;
    }
    setSkillTags((prev) => [...prev, newTag]);
    clearInvalidField('skills_tags');
    setSkillInput('');
  };

  const handleSkillKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleAddSkillTag();
    }
  };

  const goToSeniorStep = (nextIndex: number) => {
    if (nextIndex < 0 || nextIndex >= SENIOR_STEPS.length) return;
    setSlideDirection(nextIndex > seniorStepIndex ? 1 : -1);
    setInvalidFields(new Set());
    if (nextIndex === SENIOR_QNA_STEP_INDEX && seniorStepIndex < SENIOR_QNA_STEP_INDEX) {
      setSeniorQnaSubStep(1);
    }
    setSeniorStepIndex(nextIndex);
  };
  const moveToSeniorStepByKey = (stepKey: SeniorStepKey) => {
    const nextIndex = SENIOR_STEPS.findIndex((step) => step.key === stepKey);
    if (nextIndex === -1) return;
    goToSeniorStep(nextIndex);
  };
  const enterReviewEditStep = (stepKey: ReviewEditableStepKey) => {
    setReviewEditStepKey(stepKey);
    if (stepKey === 'senior-qna') {
      setSeniorQnaSubStep(1);
    }
    moveToSeniorStepByKey(stepKey);
  };
  const returnToReviewFromEdit = () => {
    setReviewEditStepKey(null);
    moveToSeniorStepByKey('review');
  };

  const handleSeniorNext = () => {
    const missingFields = getSeniorMissingFields();
    if (missingFields.length > 0) {
      setInvalidFields(new Set(missingFields));
      onShowToast?.('아직 미입력된 정보가 있습니다.', 'error');
      return;
    }

    const validationMessage = validateSeniorStepFormat();
    if (validationMessage) {
      onShowToast?.(validationMessage, 'error');
      return;
    }

    setInvalidFields(new Set());
    if (currentSeniorStep?.key === 'senior-qna' && seniorQnaSubStep === 1) {
      setSlideDirection(1);
      setSeniorQnaSubStep(2);
      return;
    }

    if (seniorStepIndex < SENIOR_STEPS.length - 1) {
      goToSeniorStep(seniorStepIndex + 1);
    }
  };

  const handleSeniorPrev = () => {
    if (currentSeniorStep?.key === 'senior-qna' && seniorQnaSubStep === 2) {
      setSlideDirection(-1);
      setInvalidFields(new Set());
      setSeniorQnaSubStep(1);
      return;
    }
    if (seniorStepIndex === SENIOR_QNA_STEP_INDEX + 1) {
      setSeniorQnaSubStep(2);
    }
    goToSeniorStep(seniorStepIndex - 1);
  };

  const normalizeWorks: Omit<WorkExperience, 'id'>[] = works
    .filter(hasAnyWorkInput)
    .map((work) => ({
      ...work,
      company: work.company.trim(),
      position: work.position.trim(),
      start_date: work.start_date.trim() || getCurrentYearMonth(),
      end_date: null,
      region: (work.region || '').trim(),
    }));

  const normalizeEducations: Omit<Education, 'id'>[] =
    formData.school.trim() && formData.dept_name.trim() && formData.admission_year.trim() && educationDegree && educationStatus
      ? [
          {
            start_date: `20${formData.admission_year.trim()}`,
            end_date: graduationYear.trim() || null,
            is_current: false,
            school: formData.school.trim(),
            major: formData.dept_name.trim(),
            degree: educationDegree,
            status: educationStatus,
            region: '',
          },
        ]
      : [];

  const normalizedContact: CareerContactUpdate = {
    name: toNullable(currentUser?.nickname || ''),
    email: toNullable(currentUser?.email || ''),
    phone: toNullable(contactData.phone),
    visibility: contactData.visibility,
  };
  const normalizedSkills: CareerSkillsUpdate = { skill_tags: skillTags };
  const normalizedWorksUpdate: CareerWorksUpdate = { works: normalizeWorks };
  const normalizedEducationsUpdate: CareerEducationsUpdate = { educations: normalizeEducations };
  const normalizedSeniorQna: CareerMentorQnAUpdate = {
    mentor_qna: {
      targeted_capital: seniorQna.targeted_capital,
      reason_for_local: toNullable(seniorQna.reason_for_local || ''),
      helpful_organizations: toNullable(seniorQna.helpful_organizations || ''),
      local_advantages: toNullable(seniorQna.local_advantages || ''),
      local_disadvantages: toNullable(seniorQna.local_disadvantages || ''),
      advice_for_juniors: toNullable(seniorQna.advice_for_juniors || ''),
    },
  };

  const handleSeniorComplete = async () => {
    if (userType !== 'senior') return;
    const missingFields = getSeniorMissingFields();
    if (missingFields.length > 0) {
      setInvalidFields(new Set(missingFields));
      onShowToast?.('아직 미입력된 정보가 있습니다.', 'error');
      return;
    }

    const validationMessage = validateSeniorStepFormat();
    if (validationMessage) {
      onShowToast?.(validationMessage, 'error');
      return;
    }

    const onboardingPayload: OnboardingRequest = {
      user_type: toApiUserType(userType),
      school: formData.school.trim(),
      dept_code: formData.dept_name.trim() || undefined,
      admission_year: formData.admission_year ? parseInt(formData.admission_year, 10) : undefined,
      board_codes: [...GUEST_DEFAULT_BOARDS],
    };

    if (!isLoggedIn) {
      requestLoginForPendingSave({
        onboarding: onboardingPayload,
        seniorCareer: {
          contact: normalizedContact,
          skills: normalizedSkills,
          works: normalizedWorksUpdate,
          educations: normalizedEducationsUpdate,
          mentor_qna: normalizedSeniorQna,
        },
        seniorPrivacyConsent: hasPrivacyConsent,
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const onboardingResult = await completeOnboarding(onboardingPayload);

      await saveCareerContact(normalizedContact);
      await saveCareerSkills(normalizedSkills);
      await saveCareerWorks(normalizedWorksUpdate);
      await saveCareerEducations(normalizedEducationsUpdate);
      await saveCareerMentorQnA(normalizedSeniorQna);

      queryClient.setQueryData(['user', 'profile'], onboardingResult.user);
      setUser(onboardingResult.user);
      localStorage.setItem('my_subscribed_categories', JSON.stringify(onboardingResult.subscribed_boards));
      clearOnboardingDraft();
      onSeniorCompleted?.();
      setSeniorCompleted(onboardingResult.subscribed_boards);
    } catch (error) {
      console.error('선배님 온보딩 처리 실패:', error);
      alert('저장 중 문제가 발생했습니다. 다시 시도해 주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderSeniorStepContent = () => {
    if (!currentSeniorStep) return null;

    switch (currentSeniorStep.key) {
      case 'basic':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">학위</label>
                <select
                  value={educationDegree}
                  onChange={(e) => {
                    setEducationDegree(e.target.value as EducationDegreeType | '');
                    clearInvalidField('basic_degree');
                  }}
                  className={`w-full rounded-xl border px-4 py-3 text-sm outline-none transition-all ${
                    hasInvalidField('basic_degree')
                      ? 'border-red-300 bg-red-50 focus:border-red-500'
                      : 'border-gray-200 bg-gray-50 focus:border-gray-900 focus:bg-white'
                  }`}
                >
                  <option value="">선택</option>
                  {EDUCATION_DEGREE_OPTIONS.map((degree) => (
                    <option key={degree} value={degree}>
                      {EDUCATION_DEGREE_LABELS[degree]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">상태</label>
                <select
                  value={educationStatus}
                  onChange={(e) => {
                    const nextStatus = e.target.value as EducationStatusType | '';
                    setEducationStatus(nextStatus);
                    clearInvalidField('basic_status');
                    if (!nextStatus || !GRADUATION_REQUIRED_STATUSES.includes(nextStatus)) {
                      setGraduationYear('');
                      clearInvalidField('basic_graduation_year');
                    }
                  }}
                  className={`w-full rounded-xl border px-4 py-3 text-sm outline-none transition-all ${
                    hasInvalidField('basic_status')
                      ? 'border-red-300 bg-red-50 focus:border-red-500'
                      : 'border-gray-200 bg-gray-50 focus:border-gray-900 focus:bg-white'
                  }`}
                >
                  <option value="">선택</option>
                  {EDUCATION_STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {EDUCATION_STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">학교</label>
              <input
                type="text"
                value={formData.school}
                onChange={(e) => {
                  setFormData((prev: UserInfoFormData) => ({ ...prev, school: e.target.value }));
                  clearInvalidField('basic_school');
                }}
                placeholder="예: 전북대학교"
                className={`w-full rounded-xl border px-4 py-3 text-sm outline-none transition-all ${
                  hasInvalidField('basic_school')
                    ? 'border-red-300 bg-red-50 focus:border-red-500'
                    : 'border-gray-200 bg-gray-50 focus:border-gray-900 focus:bg-white'
                }`}
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">학과</label>
              <input
                type="text"
                value={formData.dept_name}
                onChange={(e) => {
                  const nextMajor = e.target.value;
                  setFormData((prev: UserInfoFormData) => ({ ...prev, dept_name: nextMajor, dept_code: nextMajor }));
                  clearInvalidField('basic_major');
                }}
                placeholder="예: 컴퓨터인공지능학부, 경영학부"
                className={`w-full rounded-xl border px-4 py-3 text-sm outline-none transition-all ${
                  hasInvalidField('basic_major')
                    ? 'border-red-300 bg-red-50 focus:border-red-500'
                    : 'border-gray-200 bg-gray-50 focus:border-gray-900 focus:bg-white'
                }`}
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">학번</label>
              <div className="relative">
                <select
                  value={formData.admission_year}
                  onChange={(e) => {
                    const nextAdmissionRaw = e.target.value.trim();
                    setFormData((prev: UserInfoFormData) => ({ ...prev, admission_year: nextAdmissionRaw }));
                    clearInvalidField('basic_admission_year');
                    const nextAdmissionFull = /^\d{2}$/.test(nextAdmissionRaw) ? Number(`20${nextAdmissionRaw}`) : null;
                    if (nextAdmissionFull && graduationYear && Number(graduationYear) < nextAdmissionFull) {
                      setGraduationYear('');
                      clearInvalidField('basic_graduation_year');
                    }
                  }}
                  className={`w-full appearance-none rounded-xl border px-4 py-3 text-sm outline-none transition-all ${
                    hasInvalidField('basic_admission_year')
                      ? 'border-red-300 bg-red-50 focus:border-red-500'
                      : 'border-gray-200 bg-gray-50 focus:border-gray-900 focus:bg-white'
                  }`}
                >
                  <option value="">-- 학번을 선택하세요 --</option>
                  {ADMISSION_YEAR_OPTIONS.map((year) => (
                    <option key={year} value={year}>
                      {year}학번
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-4 flex items-center text-gray-400 pointer-events-none">
                  <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
                    <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                  </svg>
                </div>
              </div>
            </div>
            {isGraduationYearRequired && (
              <div className="space-y-1">
                <label className="flex items-center gap-1 text-sm font-medium text-gray-700">
                  <FiCalendar className="text-gray-400" size={14} />
                  졸업년도
                </label>
                <select
                  value={graduationYear}
                  onChange={(e) => {
                    setGraduationYear(e.target.value);
                    clearInvalidField('basic_graduation_year');
                  }}
                  className={`w-full rounded-xl border px-4 py-3 text-sm outline-none transition-all ${
                    hasInvalidField('basic_graduation_year')
                      ? 'border-red-300 bg-red-50 focus:border-red-500'
                      : 'border-gray-200 bg-gray-50 focus:border-gray-900 focus:bg-white'
                  }`}
                >
                  <option value="">-- 졸업년도를 선택하세요 --</option>
                  {availableGraduationYearOptionsByAdmission.map((year) => (
                    <option key={year} value={year}>
                      {year}년
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        );

      case 'contact':
        return (
          <div className="space-y-4">
            <div>
              <label className="mb-1 flex items-center gap-2 text-sm font-medium text-gray-700">
                연락처
                <RequirementBadge />
              </label>
              <input
                type="tel"
                value={contactData.phone}
                onChange={(e) => setContactData((prev) => ({ ...prev, phone: e.target.value }))}
                placeholder="010-1234-5678"
                className="w-full px-4 py-3 text-sm transition-all border border-gray-200 outline-none rounded-xl bg-gray-50 focus:border-gray-900 focus:bg-white"
              />
            </div>
            <div>
              <label className="flex items-center gap-2 mb-2 text-sm font-medium text-gray-700">
                공개 범위
              </label>
              <div className="p-3 space-y-2 border border-gray-200 rounded-xl bg-gray-50">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="radio"
                    name="visibility"
                    value="public"
                    checked={contactData.visibility === 'public'}
                    onChange={() => setContactData((prev) => ({ ...prev, visibility: 'public' }))}
                  />
                  전체 공개
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="radio"
                    name="visibility"
                    value="career_only"
                    checked={contactData.visibility === 'career_only'}
                    onChange={() => setContactData((prev) => ({ ...prev, visibility: 'career_only' }))}
                  />
                  이력만 공개 (연락처 비공개)
                </label>
              </div>
            </div>
          </div>
        );

      case 'skills':
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-gray-700">직무 키워드</p>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={handleSkillKeyDown}
                placeholder="예: 백엔드 개발, UX/UI 디자인, 회계·재무"
                className={`flex-1 rounded-xl border px-4 py-3 text-sm outline-none transition-all ${
                  hasInvalidField('skills_tags')
                    ? 'border-red-300 bg-red-50 focus:border-red-500'
                    : 'border-gray-200 bg-gray-50 focus:border-gray-900 focus:bg-white'
                }`}
              />
              <button
                onClick={handleAddSkillTag}
                type="button"
                className="px-4 py-3 text-sm font-semibold text-white bg-gray-900 rounded-xl hover:bg-gray-800"
              >
                추가
              </button>
            </div>
            <div
              className={`flex min-h-16 items-center rounded-xl border px-3 py-2 ${
                hasInvalidField('skills_tags') ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50'
              }`}
            >
              {skillTags.length === 0 ? (
                <p className="text-sm text-gray-400">아직 추가된 키워드가 없습니다.</p>
              ) : (
                <div className="flex min-h-8 w-full flex-wrap content-center items-center gap-2">
                  {skillTags.map((tag) => (
                    <div
                      key={tag}
                      className={`inline-flex h-8 max-w-full items-center gap-1.5 rounded-full border px-3 text-xs font-semibold leading-none transition-all hover:brightness-95 ${SKILL_TAG_CLASS}`}
                    >
                      <span className="inline-flex h-full max-w-[11rem] items-center truncate leading-none">{tag}</span>
                      <button
                        type="button"
                        onClick={() => setSkillTags((prev) => prev.filter((item) => item !== tag))}
                        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white/70 text-current opacity-70 transition-opacity hover:opacity-100"
                        aria-label={`${tag} 키워드 삭제`}
                      >
                        <FiX size={11} className="translate-y-px" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );

      case 'works':
        return (
          <div className="space-y-3">
            {works.map((work, index) => {
              return (
                <div key={`work-${index}`} className="p-4 space-y-3 border border-gray-200 rounded-xl">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-700">
                      {work.company.trim() || work.position.trim()
                        ? `${work.company.trim() || '회사 미입력'} / ${work.position.trim() || '직무 미입력'}`
                        : '새 경력'}
                    </p>
                    {works.length > 1 && index > 0 && (
                      <button
                        type="button"
                        onClick={() => setWorks((prev) => prev.filter((_, i) => i !== index))}
                        className="text-xs text-gray-400 hover:text-red-500"
                      >
                        삭제
                      </button>
                    )}
                  </div>
                <label className="flex items-center gap-2 text-xs text-gray-500">
                  <input
                    type="checkbox"
                    checked={work.is_current}
                    onChange={(e) => {
                      setWorks((prev) =>
                        prev.map((item, i) =>
                          i === index
                            ? {
                                ...item,
                                is_current: e.target.checked,
                              }
                            : item,
                        ),
                      );
                    }}
                  />
                  현재 재직 중
                </label>
                <input
                  type="text"
                  value={work.company}
                  onChange={(e) => {
                    setWorks((prev) =>
                      prev.map((item, i) => (i === index ? { ...item, company: e.target.value } : item)),
                    );
                    clearInvalidField(`works_${index}_company`);
                  }}
                  placeholder="회사명"
                  className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${
                    hasInvalidField(`works_${index}_company`)
                      ? 'border-red-300 bg-red-50 focus:border-red-500'
                      : 'border-gray-200 bg-gray-50 focus:border-gray-900'
                  }`}
                />
                <input
                  type="text"
                  value={work.position}
                  onChange={(e) => {
                    setWorks((prev) =>
                      prev.map((item, i) => (i === index ? { ...item, position: e.target.value } : item)),
                    );
                    clearInvalidField(`works_${index}_position`);
                  }}
                  placeholder="직무/포지션"
                  className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${
                    hasInvalidField(`works_${index}_position`)
                      ? 'border-red-300 bg-red-50 focus:border-red-500'
                      : 'border-gray-200 bg-gray-50 focus:border-gray-900'
                  }`}
                />
                <select
                  value={work.employment_type}
                  onChange={(e) =>
                    setWorks((prev) =>
                      prev.map((item, i) =>
                        i === index
                          ? { ...item, employment_type: e.target.value as WorkExperience['employment_type'] }
                          : item,
                      ),
                    )
                  }
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none bg-gray-50 focus:border-gray-900"
                >
                  {EMPLOYMENT_OPTIONS.map((employmentType) => (
                    <option key={employmentType} value={employmentType}>
                      {EMPLOYMENT_LABELS[employmentType]}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={work.region || ''}
                  onChange={(e) =>
                    setWorks((prev) =>
                      prev.map((item, i) => (i === index ? { ...item, region: e.target.value } : item)),
                    )
                  }
                  placeholder="근무 지역 (선택)"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none bg-gray-50 focus:border-gray-900"
                />
              </div>
              );
            })}
            <button
              type="button"
              onClick={() => setWorks((prev) => [...prev, createEmptyWork(false)])}
              className="w-full py-2 text-sm font-medium text-gray-600 transition-all border border-gray-300 border-dashed rounded-lg hover:border-gray-500 hover:text-gray-800"
            >
              + 경력 추가
            </button>
          </div>
        );

      case 'senior-qna':
        return (
          <div className="space-y-4">
            {(seniorQnaSubStep === 1 || isReviewEditMode) && (
              <>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">Q1. 수도권 취업/창업을 시도해 본 적이 있나요?</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSeniorQna((prev) => ({ ...prev, targeted_capital: true }));
                        clearInvalidField('senior_qna_targeted_capital');
                      }}
                      className={`rounded-lg border px-4 py-2 text-sm font-medium transition-all ${
                        seniorQna.targeted_capital === true
                          ? 'border-blue-200 bg-blue-50 text-blue-700'
                          : hasInvalidField('senior_qna_targeted_capital')
                            ? 'border-red-300 bg-red-50 text-red-600'
                            : 'border-transparent bg-gray-100 text-gray-600'
                      }`}
                    >
                      예
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSeniorQna((prev) => ({ ...prev, targeted_capital: false }));
                        clearInvalidField('senior_qna_targeted_capital');
                      }}
                      className={`rounded-lg border px-4 py-2 text-sm font-medium transition-all ${
                        seniorQna.targeted_capital === false
                          ? 'border-blue-200 bg-blue-50 text-blue-700'
                          : hasInvalidField('senior_qna_targeted_capital')
                            ? 'border-red-300 bg-red-50 text-red-600'
                            : 'border-transparent bg-gray-100 text-gray-600'
                      }`}
                    >
                      아니오
                    </button>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Q2. 지역에서 취·창업하게 된 이유는 무엇인가요?
                  </label>
                  <textarea
                    rows={3}
                    value={seniorQna.reason_for_local || ''}
                    onChange={(e) => {
                      setSeniorQna((prev) => ({ ...prev, reason_for_local: e.target.value || null }));
                      clearInvalidField('senior_qna_reason_for_local');
                    }}
                    className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${
                      hasInvalidField('senior_qna_reason_for_local')
                        ? 'border-red-300 bg-red-50 focus:border-red-500'
                        : 'border-gray-200 bg-gray-50 focus:border-gray-900'
                    }`}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Q3. 지역 취·창업 시 도움받은 기관/멘토가 있나요?
                  </label>
                  <p className="mb-1 text-xs text-gray-400">예: 선배나 지인, 취업동아리, 대학일자리센터 등</p>
                  <textarea
                    rows={3}
                    value={seniorQna.helpful_organizations || ''}
                    onChange={(e) => {
                      setSeniorQna((prev) => ({ ...prev, helpful_organizations: e.target.value || null }));
                      clearInvalidField('senior_qna_helpful_organizations');
                    }}
                    className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${
                      hasInvalidField('senior_qna_helpful_organizations')
                        ? 'border-red-300 bg-red-50 focus:border-red-500'
                        : 'border-gray-200 bg-gray-50 focus:border-gray-900'
                    }`}
                  />
                </div>
              </>
            )}
            {(seniorQnaSubStep === 2 || isReviewEditMode) && (
              <>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Q4. 지역 취·창업의 장점은 무엇인가요?
                  </label>
                  <textarea
                    rows={3}
                    value={seniorQna.local_advantages || ''}
                    onChange={(e) => {
                      setSeniorQna((prev) => ({ ...prev, local_advantages: e.target.value || null }));
                      clearInvalidField('senior_qna_local_advantages');
                    }}
                    className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${
                      hasInvalidField('senior_qna_local_advantages')
                        ? 'border-red-300 bg-red-50 focus:border-red-500'
                        : 'border-gray-200 bg-gray-50 focus:border-gray-900'
                    }`}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Q5. 지역 취·창업의 단점/아쉬운 점은 무엇인가요?
                  </label>
                  <textarea
                    rows={3}
                    value={seniorQna.local_disadvantages || ''}
                    onChange={(e) => {
                      setSeniorQna((prev) => ({ ...prev, local_disadvantages: e.target.value || null }));
                      clearInvalidField('senior_qna_local_disadvantages');
                    }}
                    className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${
                      hasInvalidField('senior_qna_local_disadvantages')
                        ? 'border-red-300 bg-red-50 focus:border-red-500'
                        : 'border-gray-200 bg-gray-50 focus:border-gray-900'
                    }`}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Q6. 후배들에게 전하고 싶은 조언을 적어주세요.
                  </label>
                  <textarea
                    rows={4}
                    value={seniorQna.advice_for_juniors || ''}
                    onChange={(e) =>
                      setSeniorQna((prev) => ({ ...prev, advice_for_juniors: e.target.value || null }))
                    }
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-gray-900"
                  />
                </div>
              </>
            )}
          </div>
        );

      case 'review':
        return (
          <ReviewSummary
            formData={formData}
            educationDegree={educationDegree}
            educationStatus={educationStatus}
            graduationYear={graduationYear}
            graduationRequiredStatuses={GRADUATION_REQUIRED_STATUSES}
            educationDegreeLabels={EDUCATION_DEGREE_LABELS}
            educationStatusLabels={EDUCATION_STATUS_LABELS}
            contactData={contactData}
            skillTags={skillTags}
            works={normalizeWorks}
            seniorQna={seniorQna}
            hasInvalidField={hasInvalidField}
            hasPrivacyConsent={hasPrivacyConsent}
            onPrivacyConsentChange={setHasPrivacyConsent}
            clearInvalidField={clearInvalidField}
            onEditBasic={() => enterReviewEditStep('basic')}
            onEditContact={() => enterReviewEditStep('contact')}
            onEditSkills={() => enterReviewEditStep('skills')}
            onEditWorks={() => enterReviewEditStep('works')}
            onEditQna={() => enterReviewEditStep('senior-qna')}
          />
        );

      default:
        return null;
    }
  };

  if (seniorCompleted) {
    return (
      <FullPageModal isOpen={isOpen} onClose={() => {}} title="" mode="overlay" showBackButton={false}>
        <div className="flex min-h-full flex-col items-center justify-center px-5 py-12">
          <div className="mb-6 text-7xl">🎉</div>
          <h2 className="mb-3 text-2xl font-bold text-gray-900">환영합니다, 선배님!</h2>
          <p className="mb-2 text-center text-sm leading-relaxed text-gray-500">
            지금은 선배님 정보 수집만 진행하고 있습니다.
            <br />
            현재 이력은 공개되지 않으며, 정식 런칭 후 공유 기능이 추가될 예정입니다.
          </p>
          <p className="mb-10 text-center text-xs text-gray-400">
            FLOW &gt; 내 이력에서 언제든지 수정할 수 있습니다.
          </p>
          <button
            onClick={() => onComplete(seniorCompleted, { redirectTo: '/flow/career' })}
            className="w-full max-w-xs rounded-xl bg-gray-900 py-4 font-bold text-white transition-all hover:bg-gray-800"
          >
            이력관리로 이동
          </button>
        </div>
      </FullPageModal>
    );
  }

  return (
    <FullPageModal isOpen={isOpen} onClose={() => {}} title="환영합니다" mode="overlay" showBackButton={false}>
      {step === 1 && (
        <div className="flex flex-col min-h-full px-5 py-8">
          <div className="mb-8 text-center">
            <div className="flex justify-center mb-6">
              <Logo className="h-12" />
            </div>
            <h2 className="mb-2 text-xl font-bold text-gray-900">
              제로타임에 오신 것을 환영합니다!
            </h2>
            <p className="text-sm text-gray-500">나에게 해당하는 유형을 선택해주세요</p>
          </div>

          <div className="grid grid-cols-2 gap-3 px-2">
            <button
              onClick={() => handleUserTypeSelect('student')}
              className={`relative flex flex-col items-center rounded-2xl border-2 p-5 transition-all ${
                userType === 'student'
                  ? 'border-blue-500 bg-blue-50 shadow-sm'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              {userType === 'student' && (
                <div className="absolute flex items-center justify-center w-5 h-5 text-white bg-blue-500 rounded-full right-2 top-2">
                  <FiCheck size={12} strokeWidth={3} />
                </div>
              )}
              <div className="mb-3 text-4xl">🎓</div>
              <p className="text-base font-bold text-gray-800">학생</p>
              <p className="mt-1 text-xs text-gray-400">재학생/신입생</p>
            </button>

            <button
              onClick={() => handleUserTypeSelect('senior')}
              className={`relative flex flex-col items-center rounded-2xl border-2 p-5 transition-all ${
                userType === 'senior'
                  ? 'border-blue-500 bg-blue-50 shadow-sm'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              {userType === 'senior' && (
                <div className="absolute flex items-center justify-center w-5 h-5 text-white bg-blue-500 rounded-full right-2 top-2">
                  <FiCheck size={12} strokeWidth={3} />
                </div>
              )}
              <div className="mb-3 text-4xl">💼</div>
              <p className="text-base font-bold text-gray-800">선배님</p>
              <p className="mt-1 text-xs text-gray-400">현직자/졸업생</p>
            </button>
          </div>

          <div className="flex flex-col gap-3 pt-10 mt-auto pb-safe">
            <button
              onClick={handleNext}
              disabled={!userType}
              className="w-full py-4 font-bold text-white transition-all bg-gray-900 rounded-xl hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              다음
            </button>
          </div>
        </div>
      )}

      {step === 2 && userType === 'student' && (
        <div className="flex flex-col min-h-full px-5 py-8">
          <div className="mb-6 text-center">
            <h2 className="mb-2 text-xl font-bold text-gray-900">
              학교 정보를 알려주세요
            </h2>
            <p className="text-sm text-gray-500">
              <>
                소속 정보를 알려주시면
                <br />
                맞춤형 공지사항을 자동으로 구독해 드려요!
              </>
            </p>
            <button
              onClick={handleResetOnboardingSelection}
              className="mt-3 text-xs font-medium text-gray-400 transition-all hover:text-gray-600"
            >
              학생/선배님 다시 선택하기
            </button>
          </div>

          <div className="flex-1 space-y-6">
            <UserInfoForm
              formData={formData}
              onChange={(data) => setFormData((prev: UserInfoFormData) => ({ ...prev, ...data }))}
              showNickname={false}
              isReadonlySchool={false}
            />
          </div>

          <div className="flex flex-col gap-3 mt-10 pb-safe">
            <button
              onClick={handleSubmit}
              disabled={isStudentSubmitDisabled}
              className="w-full py-4 font-bold text-white transition-all bg-gray-900 rounded-xl hover:bg-gray-800 disabled:bg-gray-300"
            >
              {isSubmitting ? '준비 중...' : isLoggedIn ? '시작하기' : '로그인 후 저장하기'}
            </button>
            {!isLoggedIn && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
                로그인하지 않으면 입력한 정보가 저장되지 않습니다. 꼭 로그인 후 완료해 주세요.
              </div>
            )}
            <button
              onClick={handleSkip}
              disabled={isSubmitting}
              className="w-full py-2 text-sm font-medium text-gray-400 transition-all hover:text-gray-600"
            >
              건너뛰기
            </button>
          </div>
        </div>
      )}

      {step === 2 && userType === 'senior' && (
        <div className="flex h-full min-h-0 flex-col px-5 py-6">
          <div className="mb-5">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-500">{seniorStepTitle}</p>
              <p className="text-xs font-semibold text-gray-500">
                {currentSeniorScreen} / {totalSeniorScreens}
              </p>
            </div>
            <div className="h-2 overflow-hidden bg-gray-200 rounded-full">
              <div
                className="h-full bg-blue-500 rounded-full"
                style={{
                  width: `${seniorProgress}%`,
                  transition: 'width 280ms cubic-bezier(0.22, 1, 0.36, 1)',
                }}
              />
            </div>
          </div>

          <div
            key={`senior-step-${seniorStepIndex}-${currentSeniorStep?.key === 'senior-qna' ? seniorQnaSubStep : 0}`}
            className="senior-step-animated min-h-0 flex-1 overflow-y-auto overscroll-y-contain pr-0.5"
            style={{
              WebkitOverflowScrolling: 'touch',
              touchAction: 'pan-y',
              animation:
                slideDirection === 1
                  ? 'seniorStepInFromRight 300ms cubic-bezier(0.22, 1, 0.36, 1)'
                  : 'seniorStepInFromLeft 300ms cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          >
            <div className="mb-3 text-center">
              <h2 className="mb-2 text-xl font-bold text-gray-900">{seniorStepTitle}</h2>
              <p className="text-sm text-gray-500">{seniorStepDescriptionText}</p>
              <button
                onClick={handleResetOnboardingSelection}
                className="mt-2 text-xs font-medium text-gray-400 transition-all hover:text-gray-600"
              >
                학생/선배님 다시 선택하기
              </button>
            </div>
            {renderSeniorStepContent()}
          </div>

          <div className="mt-5 space-y-2 pb-safe">
            {isReviewEditMode ? (
              <button
                type="button"
                onClick={returnToReviewFromEdit}
                disabled={isSubmitting}
                className="w-full rounded-xl bg-gray-900 py-3 text-sm font-bold text-white transition-all hover:bg-gray-800 disabled:bg-gray-300"
              >
                수정완료
              </button>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSeniorPrev}
                    disabled={(seniorStepIndex === 0 && !(currentSeniorStep?.key === 'senior-qna' && seniorQnaSubStep === 2)) || isSubmitting}
                    className="w-1/3 rounded-xl border border-gray-200 py-3 text-sm font-semibold text-gray-600 transition-all hover:border-gray-400 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    이전
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (seniorStepIndex === SENIOR_STEPS.length - 1) {
                        handleSeniorComplete();
                        return;
                      }
                      handleSeniorNext();
                    }}
                    disabled={isSubmitting}
                    className="w-2/3 rounded-xl bg-gray-900 py-3 text-sm font-bold text-white transition-all hover:bg-gray-800 disabled:bg-gray-300"
                  >
                    {seniorStepIndex === SENIOR_STEPS.length - 1
                      ? isSubmitting
                        ? '저장 중...'
                        : isLoggedIn
                          ? '완료하기'
                          : '로그인 후 저장하기'
                      : '다음'}
                  </button>
                </div>
                {!isLoggedIn && seniorStepIndex === SENIOR_STEPS.length - 1 && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
                    로그인하지 않으면 입력한 정보가 저장되지 않습니다. 꼭 로그인 후 완료해 주세요.
                  </div>
                )}
                {currentSeniorStep.optional && seniorStepIndex < SENIOR_STEPS.length - 1 && (
                  <button
                    type="button"
                    onClick={() => goToSeniorStep(seniorStepIndex + 1)}
                    disabled={isSubmitting}
                    className="w-full py-2 text-sm font-medium text-gray-400 transition-all hover:text-gray-600"
                  >
                    이번 단계 건너뛰기
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes seniorStepInFromRight {
          from {
            opacity: 0;
            transform: translate3d(28px, 0, 0) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translate3d(0, 0, 0) scale(1);
          }
        }

        @keyframes seniorStepInFromLeft {
          from {
            opacity: 0;
            transform: translate3d(-28px, 0, 0) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translate3d(0, 0, 0) scale(1);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .senior-step-animated {
            animation: none !important;
          }
        }
      `}</style>
    </FullPageModal>
  );
}
