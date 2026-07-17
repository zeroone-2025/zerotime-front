'use client';

import { useState, useEffect, useRef, useMemo } from 'react';

import { FiSearch, FiX } from 'react-icons/fi';

import { getAllDepartments } from '@/_lib/api';
import { filterAndSort } from '@/_lib/utils/search';
import type { Department } from '@/_types/department';

interface DepartmentSearchProps {
  onSelect: (dept: Department | null) => void;
  selectedDeptCode?: string | null;
  placeholder?: string;
  isReadonly?: boolean;
  hasError?: boolean;
  school?: string; // 소속 대학 (미지정 시 백엔드 기본값 "전북대")
}

export default function DepartmentSearch({
  onSelect,
  selectedDeptCode,
  placeholder = '학과를 검색하세요 (예: 컴퓨터, 경영)',
  isReadonly = false,
  hasError = false,
  school,
}: DepartmentSearchProps) {
  const [query, setQuery] = useState('');
  const [allDepartments, setAllDepartments] = useState<Department[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDept, setSelectedDept] = useState<Department | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // 1. 학교가 정해지면(또는 바뀌면) 그 학교의 학과 정보를 가져오기
  useEffect(() => {
    setIsLoading(true);
    const fetchAll = async () => {
      try {
        const data = await getAllDepartments(true, school); // 학과만
        setAllDepartments(data);
      } catch (error) {
        console.error('학과 목록 로드 실패:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAll();
  }, [school]);

  // 1-2. selectedDeptCode와 일치하는 학과 찾아서 초기값 설정
  useEffect(() => {
    if (selectedDeptCode && allDepartments.length > 0) {
      const found = allDepartments.find((d) => d.dept_code === selectedDeptCode);
      if (found) {
        setSelectedDept(found);
      }
    } else if (!selectedDeptCode) {
      setSelectedDept(null);
    }
  }, [selectedDeptCode, allDepartments]);

  // 2. 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 3. 실시간 최적 검색 (학과명 + 단과대명 + 코드 기반)
  const results = useMemo(() => {
    if (!query) return [];
    return filterAndSort(allDepartments, query, (d) => [
      d.dept_name,
      d.college_name ?? '',
      d.dept_code,
    ]).slice(0, 50);
  }, [query, allDepartments]);

  const handleSelect = (dept: Department) => {
    setSelectedDept(dept);
    setQuery('');
    setIsOpen(false);
    onSelect(dept);
  };

  const handleClear = () => {
    setSelectedDept(null);
    setQuery('');
    onSelect(null);
  };

  return (
    <div className="relative w-full" ref={dropdownRef}>
      {selectedDept ? (
        <div className={`flex w-full items-center justify-between rounded-xl px-4 py-3 border transition-all ${isReadonly
          ? 'bg-gray-100 border-gray-200 cursor-not-allowed'
          : hasError
            ? 'bg-red-50 border-red-300'
          : 'bg-blue-50 border-blue-200'
          }`}>
          <div className="flex flex-col">
            <span className={`font-semibold ${isReadonly ? 'text-gray-500' : 'text-blue-900'}`}>{selectedDept.dept_name}</span>
            {selectedDept.college_name && (
              <span className={`text-xs font-medium ${isReadonly ? 'text-gray-400' : 'text-blue-600'}`}>{selectedDept.college_name}</span>
            )}
          </div>
          {!isReadonly && (
            <button
              onClick={handleClear}
              className="rounded-full p-2 text-blue-400 hover:bg-blue-100 hover:text-blue-600 transition-colors"
            >
              <FiX size={20} />
            </button>
          )}
        </div>
      ) : isReadonly ? (
        <div className="w-full rounded-xl border border-gray-200 bg-gray-100 px-4 py-3 text-gray-400 text-sm italic">
          미설정
        </div>
      ) : (
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-gray-400">
            <FiSearch size={22} />
          </div>
          <input
            type="text"
            className={`w-full rounded-xl border bg-white py-3 pl-10 pr-10 text-base font-medium text-gray-900 transition-all placeholder:text-gray-400 focus:outline-none ${
              hasError
                ? 'border-red-300 bg-red-50 focus:border-red-500 focus:ring-4 focus:ring-red-500/10'
                : 'border-gray-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10'
            }`}
            placeholder={placeholder}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            disabled={isLoading}
          />
          {isLoading && (
            <div className="absolute inset-y-0 right-4 flex items-center">
              <div className="h-5 w-5 animate-spin rounded-full border-3 border-blue-500 border-t-transparent"></div>
            </div>
          )}
        </div>
      )}

      {/* 드롭다운 결과 */}
      {isOpen && query.length > 0 && (
        <div className="absolute z-50 mt-2 max-h-72 w-full overflow-auto rounded-2xl border border-gray-200 bg-white py-2 shadow-2xl">
          {results.length > 0 ? (
            results.map((dept) => (
              <button
                key={dept.id}
                onClick={() => handleSelect(dept)}
                className="flex w-full flex-col px-6 py-3 text-left transition-colors hover:bg-blue-50 focus:bg-blue-50 focus:outline-none"
              >
                <span className="text-base font-semibold text-gray-900">{dept.dept_name}</span>
                {dept.college_name && (
                  <span className="text-sm text-gray-500">{dept.college_name}</span>
                )}
              </button>
            ))
          ) : (
            <div className="px-6 py-4 text-center text-base text-gray-500">
              검색 결과가 없어요
            </div>
          )}
        </div>
      )}
    </div>
  );
}
