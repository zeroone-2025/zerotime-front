import type { Department, DepartmentSearchResponse } from '@/_types/department';

import api from './client';

/**
 * 학과 검색 (학과만, 단과대 제외)
 * @param query 검색어
 * @param school 소속 대학 (미지정 시 백엔드 기본값 "전북대")
 */
export const searchDepartments = async (query?: string, school?: string) => {
    const params: Record<string, string> = {};
    if (query) params.query = query;
    if (school) params.school = school;

    const response = await api.get<DepartmentSearchResponse>('/departments/search', {
        params,
    });
    return response.data;
};

/**
 * 전체 학과 목록 조회
 * @param onlyDept 학과만 조회 (단과대 제외)
 * @param school 소속 대학 (미지정 시 백엔드 기본값 "전북대")
 */
export const getAllDepartments = async (onlyDept: boolean = true, school?: string) => {
    const params: Record<string, string | boolean> = { only_dept: onlyDept };
    if (school) params.school = school;

    const response = await api.get<Department[]>('/departments', {
        params,
    });
    return response.data;
};
