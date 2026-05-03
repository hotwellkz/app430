import React, { useState, useEffect } from 'react';
import { Employee, EmployeeFormData, initialEmployeeFormData } from '../../types/employee';
import { ArrowLeft, X } from 'lucide-react';

interface EmployeeFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: EmployeeFormData) => Promise<void>;
  employee?: Employee;
}

export const EmployeeForm: React.FC<EmployeeFormProps> = ({
  isOpen,
  onClose,
  onSave,
  employee
}) => {
  const [formData, setFormData] = useState<EmployeeFormData>(initialEmployeeFormData);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (employee) {
      setFormData({
        lastName: employee.lastName,
        firstName: employee.firstName,
        middleName: employee.middleName,
        iin: employee.iin,
        phone: employee.phone,
        position: employee.position,
        salary: employee.salary,
        email: employee.email,
        status: employee.status
      });
    }
  }, [employee]);

  useEffect(() => {
    if (!isOpen) return;
    document.body.classList.add('crm-mobile-modal-open');
    window.dispatchEvent(new CustomEvent('attachment-preview-visibility-change'));
    return () => {
      document.body.classList.remove('crm-mobile-modal-open');
      window.dispatchEvent(new CustomEvent('attachment-preview-visibility-change'));
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave(formData);
      onClose();
    } catch (error) {
      console.error('Ошибка при сохранении сотрудника:', error);
      alert('Произошла ошибка при сохранении сотрудника');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'salary' ? Number(value) : value
    }));
  };

  const inputCls =
    'w-full px-3 border rounded-md focus:ring-amber-500 focus:border-amber-500 ' +
    'text-base h-11 md:h-auto md:py-2 md:text-sm';
  const labelCls = 'block text-[12px] md:text-sm font-medium text-gray-600 md:text-gray-700 mb-1 md:mb-1';

  const title = employee ? 'Редактировать сотрудника' : 'Добавить сотрудника';

  return (
    <div
      className={[
        'fixed inset-0 z-[1100] bg-black/50',
        'md:flex md:items-center md:justify-center md:p-4',
      ].join(' ')}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={[
          'bg-white flex flex-col overflow-hidden',
          // mobile: fullscreen — высота = реальный viewport через inset-0,
          // не используем dvh/vh, иначе нижний край уезжает за url-bar
          'fixed inset-0',
          // desktop: centered, max width, max height
          'md:static md:inset-auto md:h-auto md:w-full md:max-w-2xl md:max-h-[90vh] md:rounded-lg md:shadow-xl',
        ].join(' ')}
      >
        {/* Sticky header */}
        <div className="flex-shrink-0 flex items-center justify-between h-12 md:h-auto md:min-h-[56px] px-2 md:px-6 md:py-4 border-b bg-white">
          <button
            type="button"
            onClick={onClose}
            className="md:hidden flex items-center justify-center w-9 h-9 rounded-full hover:bg-gray-100 text-gray-700"
            aria-label="Назад"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="flex-1 text-center text-[15px] font-semibold text-gray-900 md:text-left md:text-xl md:flex-none">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="hidden md:flex items-center justify-center text-gray-500 hover:text-gray-700"
            aria-label="Закрыть"
          >
            <X className="w-6 h-6" />
          </button>
          {/* Spacer to balance left back-button on mobile */}
          <span className="md:hidden w-9 h-9" aria-hidden />
        </div>

        {/* Scrollable body */}
        <form
          id="employee-form"
          onSubmit={handleSubmit}
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-3 md:p-6"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {/* Mobile-only ФИО group heading; desktop keeps a single uniform grid */}
          <h3 className="md:hidden text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
            ФИО
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-6">
            <div>
              <label className={labelCls}>Фамилия</label>
              <input
                type="text"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                className={inputCls}
                required
              />
            </div>

            <div>
              <label className={labelCls}>Имя</label>
              <input
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                className={inputCls}
                required
              />
            </div>

            <div>
              <label className={labelCls}>Отчество</label>
              <input
                type="text"
                name="middleName"
                value={formData.middleName}
                onChange={handleChange}
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>ИИН</label>
              <input
                type="text"
                inputMode="numeric"
                name="iin"
                value={formData.iin}
                onChange={handleChange}
                className={inputCls}
                required
                maxLength={12}
              />
            </div>

            <div>
              <label className={labelCls}>Телефон</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className={inputCls}
                required
              />
            </div>

            <div>
              <label className={labelCls}>Должность</label>
              <input
                type="text"
                name="position"
                value={formData.position}
                onChange={handleChange}
                className={inputCls}
                required
              />
            </div>

            <div>
              <label className={labelCls}>Заработная плата</label>
              <input
                type="number"
                name="salary"
                value={formData.salary}
                onChange={handleChange}
                className={inputCls}
                required
                min="0"
              />
            </div>

            <div>
              <label className={labelCls}>Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className={inputCls}
                required
              />
            </div>

            <div>
              <label className={labelCls}>Статус</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className={inputCls}
              >
                <option value="active">Активный</option>
                <option value="inactive">Неактивный</option>
              </select>
            </div>
          </div>

          {/* Spacer so last field is not glued to footer on mobile */}
          <div className="h-2 md:hidden" aria-hidden />
        </form>

        {/* Sticky footer */}
        <div
          className={[
            'flex-shrink-0 bg-white border-t',
            'px-3 py-2 md:px-6 md:py-4',
            'flex flex-col-reverse gap-2 md:flex-row md:justify-end md:gap-3',
            'pb-[calc(env(safe-area-inset-bottom,0px)+8px)] md:pb-4',
          ].join(' ')}
        >
          <button
            type="button"
            onClick={onClose}
            className="hidden md:inline-flex px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            Отмена
          </button>
          <button
            type="submit"
            form="employee-form"
            disabled={loading}
            className={[
              'w-full md:w-auto',
              'inline-flex items-center justify-center',
              'h-11 md:h-auto px-4 md:py-2 rounded-md',
              'bg-amber-500 text-white font-medium hover:bg-amber-600 transition-colors',
              'disabled:opacity-60 disabled:cursor-not-allowed',
            ].join(' ')}
          >
            {loading ? 'Сохранение...' : employee ? 'Сохранить' : 'Добавить'}
          </button>
        </div>
      </div>
    </div>
  );
};
