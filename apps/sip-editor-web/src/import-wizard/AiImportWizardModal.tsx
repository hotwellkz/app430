import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
  type CSSProperties,
  type DragEvent,
} from 'react';
import {
  createImportJob,
  getImportJob,
  saveImportJobReview,
} from '@/api/projectsApi';
import { getSipUserId } from '@/identity/sipUser';
import { SipApiError } from '@/api/http';
import { buildCreateImportJobRequestWithUploads } from './buildCreateImportRequest';
import { formatImportWizardSummary } from './formatImportWizardSummary';
import {
  defaultImportWizardForm,
  type ImportWizardFormValues,
  type WizardFileItem,
  type WizardFileKind,
} from './importWizardTypes';
import { mapWizardToReviewDecisions } from './mapWizardToReviewDecisions';
import { validateImportWizard } from './validateImportWizard';
import { waitForImportJobReviewable } from './waitForImportJobReviewable';

const card: CSSProperties = {
  border: '1px solid var(--twix-border)',
  borderRadius: 8,
  padding: 12,
  background: 'var(--twix-surface, #fff)',
};

function newClientId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `cl-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export interface AiImportWizardModalProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  projectTitle: string;
  /** После успешного создания job и сохранения review-черновика */
  onSuccess: (jobId: string) => void;
}

export function AiImportWizardModal({
  open,
  onClose,
  projectId,
  projectTitle,
  onSuccess,
}: AiImportWizardModalProps) {
  const titleId = useId();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [files, setFiles] = useState<WizardFileItem[]>([]);
  const [form, setForm] = useState<ImportWizardFormValues>(() => defaultImportWizardForm());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setStep(1);
      setFiles([]);
      setForm(defaultImportWizardForm());
      setBusy(false);
      setError(null);
    }
  }, [open]);

  const addItems = useCallback((incoming: File[], defaultKind: WizardFileKind = 'plan') => {
    setFiles((prev) => {
      const next = [...prev];
      for (const file of incoming) {
        if (!file.size) continue;
        next.push({ clientId: newClientId(), file, kind: defaultKind });
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const imgs: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (it.kind === 'file' && it.type.startsWith('image/')) {
          const f = it.getAsFile();
          if (f) imgs.push(f);
        }
      }
      if (imgs.length) {
        e.preventDefault();
        addItems(imgs, 'plan');
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [open, addItems]);

  const validation = useMemo(() => validateImportWizard(files, form), [files, form]);
  const summaryText = useMemo(() => formatImportWizardSummary(files, form), [files, form]);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files?.length) addItems(Array.from(e.dataTransfer.files));
  };

  const onDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const tryClose = () => {
    if (busy) return;
    if (files.length > 0 || step > 1) {
      if (!window.confirm('Закрыть мастер? Несохранённые данные будут потеряны.')) return;
    }
    onClose();
  };

  const runCreate = async () => {
    const v = validateImportWizard(files, form);
    if (!v.ok) {
      setError(v.errors.join(' '));
      return;
    }
    const uid = getSipUserId();
    if (!uid) {
      setError('Нет sipUserId — войдите через CRM.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const body = await buildCreateImportJobRequestWithUploads(projectId, files, projectTitle);
      const { job } = await createImportJob(projectId, body);
      const poll = await waitForImportJobReviewable(projectId, job.id, getImportJob, {
        maxMs: 120_000,
        intervalMs: 400,
      });
      if (poll === 'failed') {
        const { job: j2 } = await getImportJob(projectId, job.id);
        throw new Error(j2.errorMessage ?? 'Импорт завершился с ошибкой');
      }
      if (poll === 'timeout') {
        throw new Error('Импорт не успел завершиться за отведённое время. Обновите список job позже.');
      }
      const { job: readyJob } = await getImportJob(projectId, job.id);
      if (!readyJob.snapshot) throw new Error('Нет snapshot после импорта');
      const decisions = mapWizardToReviewDecisions(readyJob.snapshot, form);
      await saveImportJobReview(projectId, job.id, { updatedBy: uid, decisions });
      onSuccess(job.id);
      onClose();
    } catch (e) {
      const msg =
        e instanceof SipApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : 'Ошибка создания импорта';
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(15, 23, 42, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) tryClose();
      }}
    >
      <div
        style={{
          width: 'min(520px, 100%)',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
          borderRadius: 10,
          background: '#fff',
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--twix-border)' }}>
          <h2 id={titleId} className="twix-panelTitle" style={{ margin: 0, fontSize: 16 }}>
            Импорт по фото / планам
          </h2>
          <p className="twix-muted" style={{ margin: '6px 0 0', fontSize: 12 }}>
            Шаг {step} из 3 · перед созданием job файлы загружаются в хранилище проекта; в запросе
            create-import передаются только ссылки на объекты (без base64 в JSON).
          </p>
        </div>

        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {step === 1 ? (
            <section style={card}>
              <p style={{ fontWeight: 600, margin: '0 0 8px', fontSize: 13 }}>1. Источники</p>
              <div
                onDrop={onDrop}
                onDragOver={onDragOver}
                style={{
                  border: '2px dashed #cbd5e1',
                  borderRadius: 8,
                  padding: 16,
                  textAlign: 'center',
                  fontSize: 12,
                  color: '#64748b',
                  marginBottom: 10,
                }}
              >
                Перетащите файлы сюда или выберите с диска. Ctrl+V — вставка изображения из буфера.
                <div style={{ marginTop: 10 }}>
                  <label style={{ cursor: 'pointer', color: '#2563eb' }}>
                    <input
                      data-testid="ai-import-wizard-file-input"
                      type="file"
                      multiple
                      accept="image/*,.pdf,application/pdf"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        if (e.target.files?.length) addItems(Array.from(e.target.files));
                        e.target.value = '';
                      }}
                    />
                    Выбрать файлы
                  </label>
                </div>
              </div>
              {files.length === 0 ? (
                <p className="twix-muted" style={{ fontSize: 12, margin: 0 }}>
                  Файлов пока нет.
                </p>
              ) : (
                <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none', fontSize: 12 }}>
                  {files.map((row) => (
                    <li
                      key={row.clientId}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: 8,
                        flexWrap: 'wrap',
                      }}
                    >
                      <span style={{ flex: '1 1 140px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {row.file.name}
                      </span>
                      <span className="twix-muted">{formatBytes(row.file.size)}</span>
                      <select
                        value={row.kind}
                        onChange={(e) => {
                          const kind = e.target.value as WizardFileKind;
                          setFiles((prev) =>
                            prev.map((f) => (f.clientId === row.clientId ? { ...f, kind } : f))
                          );
                        }}
                        style={{ fontSize: 12, padding: 4 }}
                      >
                        <option value="plan">План</option>
                        <option value="facade">Фасад</option>
                        <option value="other">Другое</option>
                      </select>
                      <button
                        type="button"
                        style={{ fontSize: 11, padding: '2px 8px' }}
                        onClick={() =>
                          setFiles((prev) => prev.filter((f) => f.clientId !== row.clientId))
                        }
                      >
                        Удалить
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}

          {step === 2 ? (
            <section style={card}>
              <p style={{ fontWeight: 600, margin: '0 0 8px', fontSize: 13 }}>2. Параметры</p>
              <label style={{ display: 'block', fontSize: 12, marginBottom: 8 }}>
                Этажность
                <select
                  value={form.floorCount}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      floorCount: Number(e.target.value) === 2 ? 2 : 1,
                    }))
                  }
                  style={{ display: 'block', width: '100%', marginTop: 4, padding: 6 }}
                >
                  <option value={1}>1 этаж</option>
                  <option value={2}>2 этажа</option>
                </select>
              </label>
              <label style={{ display: 'block', fontSize: 12, marginBottom: 8 }}>
                Высота 1 этажа (мм)
                <input
                  type="number"
                  min={1}
                  value={form.floor1HeightMm || ''}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, floor1HeightMm: Number(e.target.value) || 0 }))
                  }
                  style={{ display: 'block', width: '100%', marginTop: 4, padding: 6 }}
                />
              </label>
              {form.floorCount === 2 ? (
                <label style={{ display: 'block', fontSize: 12, marginBottom: 8 }}>
                  Высота 2 этажа (мм)
                  <input
                    type="number"
                    min={1}
                    value={form.floor2HeightMm || ''}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, floor2HeightMm: Number(e.target.value) || 0 }))
                    }
                    style={{ display: 'block', width: '100%', marginTop: 4, padding: 6 }}
                  />
                </label>
              ) : null}
              <label style={{ display: 'block', fontSize: 12, marginBottom: 8 }}>
                Тип крыши
                <select
                  value={form.roof}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      roof: e.target.value as ImportWizardFormValues['roof'],
                    }))
                  }
                  style={{ display: 'block', width: '100%', marginTop: 4, padding: 6 }}
                >
                  <option value="gabled">Двускатная</option>
                  <option value="single-slope">Односкатная</option>
                  <option value="unknown">Не уверен / уточню в review</option>
                </select>
              </label>
              <label style={{ display: 'block', fontSize: 12, marginBottom: 8 }}>
                Масштаб
                <select
                  value={form.scale}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      scale: e.target.value as ImportWizardFormValues['scale'],
                    }))
                  }
                  style={{ display: 'block', width: '100%', marginTop: 4, padding: 6 }}
                >
                  <option value="auto">Нет точного / определить не удалось</option>
                  <option value="exact">Есть точный (мм на пиксель)</option>
                </select>
              </label>
              {form.scale === 'exact' ? (
                <label style={{ display: 'block', fontSize: 12, marginBottom: 8 }}>
                  мм на 1 px
                  <input
                    type="number"
                    min={0.0001}
                    step="any"
                    value={form.mmPerPixel || ''}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, mmPerPixel: Number(e.target.value) || 0 }))
                    }
                    style={{ display: 'block', width: '100%', marginTop: 4, padding: 6 }}
                  />
                </label>
              ) : null}
              <label style={{ display: 'block', fontSize: 12, marginBottom: 8 }}>
                Внутренние несущие стены
                <select
                  value={form.internalBearing}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      internalBearing: e.target.value as ImportWizardFormValues['internalBearing'],
                    }))
                  }
                  style={{ display: 'block', width: '100%', marginTop: 4, padding: 6 }}
                >
                  <option value="none">Нет внутренних несущих</option>
                  <option value="confirm_in_review">Есть — уточню в review</option>
                  <option value="unsure">Не уверен</option>
                </select>
              </label>
            </section>
          ) : null}

          {step === 3 ? (
            <section style={card}>
              <p style={{ fontWeight: 600, margin: '0 0 8px', fontSize: 13 }}>3. Проверка</p>
              <pre
                style={{
                  whiteSpace: 'pre-wrap',
                  fontSize: 12,
                  margin: 0,
                  padding: 10,
                  background: '#f8fafc',
                  borderRadius: 6,
                }}
              >
                {summaryText}
              </pre>
              {!validation.ok ? (
                <p style={{ color: '#b91c1c', fontSize: 12, marginTop: 8 }}>{validation.errors.join(' ')}</p>
              ) : null}
            </section>
          ) : null}

          {error ? (
            <p style={{ color: '#b91c1c', fontSize: 12, margin: 0 }} data-testid="ai-import-wizard-error">
              {error}
            </p>
          ) : null}

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" style={{ fontSize: 12, padding: '6px 12px' }} onClick={tryClose} disabled={busy}>
              Отмена
            </button>
            <div style={{ display: 'flex', gap: 8 }}>
              {step > 1 ? (
                <button
                  type="button"
                  style={{ fontSize: 12, padding: '6px 12px' }}
                  disabled={busy}
                  onClick={() => setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3) : s))}
                >
                  Назад
                </button>
              ) : null}
              {step < 3 ? (
                <button
                  type="button"
                  style={{ fontSize: 12, padding: '6px 12px' }}
                  disabled={busy || (step === 1 && files.length === 0)}
                  onClick={() => setStep((s) => (s < 3 ? ((s + 1) as 1 | 2 | 3) : s))}
                  data-testid="ai-import-wizard-next"
                >
                  Далее
                </button>
              ) : (
                <button
                  type="button"
                  style={{ fontSize: 12, padding: '6px 12px' }}
                  disabled={busy || !validation.ok}
                  onClick={() => void runCreate()}
                  data-testid="ai-import-wizard-submit"
                >
                  {busy ? 'Создание…' : 'Создать импорт'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
