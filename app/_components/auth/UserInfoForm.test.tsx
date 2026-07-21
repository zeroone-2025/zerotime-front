import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import UserInfoForm, { type UserInfoFormData } from './UserInfoForm';

vi.mock('@/_components/ui/DepartmentSearch', () => ({
  default: () => <div data-testid="department-search" />,
}));

const formData: UserInfoFormData = {
  nickname: '테스트',
  username: 'tester',
  school: '전북대',
  dept_code: 'dept_computer_science',
  dept_name: '컴퓨터인공지능학부',
  admission_year: '26',
};

describe('UserInfoForm 학교 선택', () => {
  it('지원 학교 목록에 부산대를 노출한다', () => {
    render(<UserInfoForm formData={formData} onChange={vi.fn()} />);

    expect(screen.getByRole('option', { name: '부산대학교' })).toHaveValue('부산대');
  });

  it('학교를 변경하면 이전 학교의 학과 선택을 초기화한다', () => {
    const onChange = vi.fn();
    const { container } = render(<UserInfoForm formData={formData} onChange={onChange} />);

    const schoolSelect = container.querySelector('select[name="school"]');
    expect(schoolSelect).not.toBeNull();
    fireEvent.change(schoolSelect!, {
      target: { value: '부산대' },
    });

    expect(onChange).toHaveBeenCalledWith({
      school: '부산대',
      dept_code: '',
      dept_name: '',
    });
  });
});
