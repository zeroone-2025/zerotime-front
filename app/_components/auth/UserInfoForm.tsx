'use client';

import { FiUser, FiHome, FiBook, FiHash, FiMail, FiAtSign } from 'react-icons/fi';

import DepartmentSearch from '@/_components/ui/DepartmentSearch';
import type { Department } from '@/_types/department';

export interface UserInfoFormData {
    nickname: string;
    username: string;
    school: string;
    dept_code: string;
    dept_name: string;
    admission_year: string;
}

interface UserInfoFormProps {
    formData: UserInfoFormData;
    onChange: (data: Partial<UserInfoFormData>) => void;
    email?: string;
    showNickname?: boolean;
    isReadonlyNickname?: boolean;
    showUsername?: boolean;
    isReadonlyUsername?: boolean;
    isReadonlySchool?: boolean;
    isReadonly?: boolean;
    showRequirementBadges?: boolean;
    requirementMap?: Partial<Record<'nickname' | 'school' | 'dept_code' | 'admission_year', 'required' | 'optional'>>;
    invalidFields?: {
        school?: boolean;
        dept_code?: boolean;
        admission_year?: boolean;
        username?: boolean;
    };
}

export default function UserInfoForm({
    formData,
    onChange,
    email,
    showNickname = true,
    isReadonlyNickname = false,
    showUsername = false,
    isReadonlyUsername = false,
    isReadonlySchool = false,
    isReadonly = false,
    showRequirementBadges = false,
    requirementMap = {},
    invalidFields = {},
}: UserInfoFormProps) {
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        if (name === 'school' && value !== formData.school) {
            // 학교가 바뀌면 이전 학교 기준으로 고른 학과는 더 이상 유효하지 않다
            onChange({ school: value, dept_code: '', dept_name: '' });
            return;
        }
        onChange({ [name]: value });
    };

    const handleDeptSelect = (dept: Department | null) => {
        onChange({
            dept_code: dept?.dept_code || '',
            dept_name: dept?.dept_name || '',
        });
    };

    const renderBadge = (key: 'nickname' | 'school' | 'dept_code' | 'admission_year') => {
        if (!showRequirementBadges) return null;
        const rule = requirementMap[key];
        if (rule !== 'optional') return null;
        return (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500">
                선택
            </span>
        );
    };

    return (
        <div className="space-y-6">
            {/* 이름 */}
            {showNickname && (
                <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                        <FiUser className="text-gray-400" />
                        이름
                        {renderBadge('nickname')}
                    </label>
                    <input
                        type="text"
                        name="nickname"
                        value={formData.nickname}
                        onChange={handleInputChange}
                        readOnly={isReadonlyNickname || isReadonly}
                        placeholder="이름을 입력하세요"
                        className={`w-full rounded-xl border border-gray-200 px-4 py-3 outline-none transition-all ${(isReadonlyNickname || isReadonly)
                            ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                            : 'bg-gray-50 focus:border-gray-900 focus:bg-white'
                            }`}
                    />
                </div>
            )}

            {/* @아이디 */}
            {showUsername && (
                <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                        <FiAtSign className="text-gray-400" />
                        아이디
                    </label>
                    <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">@</span>
                        <input
                            type="text"
                            name="username"
                            value={formData.username}
                            onChange={handleInputChange}
                            readOnly={isReadonlyUsername || isReadonly}
                            placeholder="아이디를 입력하세요"
                            className={`w-full rounded-xl border px-4 py-3 pl-8 outline-none transition-all ${(isReadonlyUsername || isReadonly)
                                ? 'border-gray-200 bg-gray-100 text-gray-500 cursor-not-allowed'
                                : invalidFields.username
                                    ? 'border-red-300 bg-red-50 focus:border-red-500'
                                    : 'border-gray-200 bg-gray-50 focus:border-gray-900 focus:bg-white'
                                }`}
                        />
                    </div>
                    {!isReadonly && !isReadonlyUsername && (
                        <p className="text-xs text-gray-400">영문 소문자, 숫자, 밑줄만 사용 가능 (3자 이상)</p>
                    )}
                </div>
            )}

            {/* 이메일 (정보성, 읽기전용) */}
            {email && (
                <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                        <FiMail className="text-gray-400" />
                        이메일
                    </label>
                    <input
                        type="email"
                        value={email}
                        readOnly
                        className="w-full px-4 py-3 text-gray-500 bg-gray-100 border border-gray-200 outline-none cursor-not-allowed rounded-xl"
                    />
                </div>
            )}

            {/* 학교 */}
            <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <FiHome className="text-gray-400" />
                    학교
                    {renderBadge('school')}
                </label>
                <div className="relative">
                    <select
                        name="school"
                        value={formData.school}
                        onChange={handleInputChange}
                        disabled={isReadonlySchool || isReadonly}
                        className={`w-full appearance-none rounded-xl border border-gray-200 px-4 py-3 outline-none transition-all ${(isReadonlySchool || isReadonly)
                            ? 'bg-gray-100 text-gray-500 cursor-not-allowed font-medium'
                            : invalidFields.school
                                ? 'border-red-300 bg-red-50 focus:border-red-500'
                            : 'bg-gray-50 focus:border-gray-900 focus:bg-white'
                            }`}
                    >
                        <option value="">{isReadonly ? '미설정' : '-- 학교를 선택하세요 --'}</option>
                        <option value="전북대">전북대학교</option>
                        <option value="전남대">전남대학교</option>
                        <option value="경북대">경북대학교</option>
                        <option value="충남대">충남대학교</option>
                        <option value="경상국립대">경상국립대학교</option>
                    </select>
                    {!(isReadonlySchool || isReadonly) && (
                        <div className="absolute inset-y-0 flex items-center text-gray-400 pointer-events-none right-4">
                            <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                                <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                            </svg>
                        </div>
                    )}
                </div>
            </div>

            {/* 학과 선택 */}
            <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <FiBook className="text-gray-400" />
                    학과
                    {renderBadge('dept_code')}
                </label>
                <DepartmentSearch
                    onSelect={handleDeptSelect}
                    selectedDeptCode={formData.dept_code}
                    placeholder="학과를 검색하세요"
                    isReadonly={isReadonly}
                    hasError={Boolean(invalidFields.dept_code)}
                    school={formData.school || undefined}
                />
            </div>

            {/* 학번 (입학년도) */}
            <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <FiHash className="text-gray-400" />
                    학번
                    {renderBadge('admission_year')}
                </label>
                <div className="relative">
                    <select
                        name="admission_year"
                        value={formData.admission_year}
                        onChange={handleInputChange}
                        disabled={isReadonly}
                        className={`w-full appearance-none rounded-xl border border-gray-200 px-4 py-3 outline-none transition-all ${isReadonly
                            ? 'bg-gray-100 text-gray-500 cursor-not-allowed font-medium'
                            : invalidFields.admission_year
                                ? 'border-red-300 bg-red-50 focus:border-red-500'
                            : 'bg-gray-50 focus:border-gray-900 focus:bg-white'
                            }`}
                    >
                        <option value="">{isReadonly ? '미설정' : '-- 학번을 선택하세요 --'}</option>
                        {Array.from({ length: 17 }, (_, i) => 26 - i).map((year) => (
                            <option key={year} value={year.toString()}>
                                {year}학번
                            </option>
                        ))}
                    </select>
                    {!isReadonly && (
                        <div className="absolute inset-y-0 flex items-center text-gray-400 pointer-events-none right-4">
                            <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                                <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                            </svg>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
