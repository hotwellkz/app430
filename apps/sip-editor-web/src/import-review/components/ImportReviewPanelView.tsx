import type { CSSProperties } from 'react';
import type { ImportReviewJobListItemViewModel, ImportReviewJobViewModel } from '../viewModel/importReviewViewModel.types';
import type { ImportReviewPanelMessage } from '../viewModel/importReviewViewModel.types';
import type { RequiredDecisionFieldViewModel } from '../viewModel/importReviewViewModel.types';
import type { InternalBearingWallsInteractionPayload } from '../viewModel/decisionsDraft';
import { IMPORT_REVIEW_UI } from '../constants/labels';

const cardStyle: CSSProperties = {
  marginBottom: 12,
  padding: 10,
  border: '1px solid var(--twix-border)',
  borderRadius: 8,
  background: 'var(--twix-surface, #fff)',
};

const badgeStyle = (tone: 'neutral' | 'ok' | 'warn' | 'bad'): CSSProperties => ({
  display: 'inline-block',
  fontSize: 10,
  fontWeight: 600,
  padding: '2px 6px',
  borderRadius: 4,
  marginRight: 4,
  marginBottom: 4,
  background:
    tone === 'ok'
      ? '#dcfce7'
      : tone === 'warn'
        ? '#fef9c3'
        : tone === 'bad'
          ? '#fee2e2'
          : '#f1f5f9',
  color: '#0f172a',
});

export interface ImportReviewPanelViewProps {
  listItems: ImportReviewJobListItemViewModel[];
  jobsLoading: boolean;
  jobsError: boolean;
  jobsErrorMessage: string | null;
  onRetryJobs: () => void;
  selectedJobId: string | null;
  onSelectJob: (id: string | null) => void;
  detailVm: ImportReviewJobViewModel | null;
  detailLoading: boolean;
  detailError: boolean;
  detailErrorMessage: string | null;
  onRetryJob: () => void;
  onRefresh: () => void;
  refreshDisabled: boolean;
  onFieldChange: (
    field: RequiredDecisionFieldViewModel,
    raw: string | number | boolean | InternalBearingWallsInteractionPayload
  ) => void;
  onSaveDraft: () => void;
  onApplyReview: () => void;
  onPrepareCandidate: () => void;
  onApplyCandidate: () => void;
  canSaveReview: boolean;
  canApplyReview: boolean;
  canPrepareCandidate: boolean;
  canApplyCandidate: boolean;
  versionMarkersReady: boolean;
  saveReviewPending: boolean;
  applyReviewPending: boolean;
  preparePending: boolean;
  applyCandidatePending: boolean;
  /** Только запрос apply-candidate (без фазы обновления редактора) */
  applyCandidateApiPending: boolean;
  /** Фаза после успеха API: refetch версии / reload документа */
  postApplyEditorRefreshPending: boolean;
  anyMutationPending: boolean;
  reviewApplied: boolean;
  panelMessage: ImportReviewPanelMessage | null;
  onDismissMessage: () => void;
}

function MessageBanner({
  msg,
  onDismiss,
}: {
  msg: ImportReviewPanelMessage;
  onDismiss: () => void;
}) {
  const isErr = msg.kind === 'error';
  const isOk = msg.kind === 'success';
  const isWarn = msg.kind === 'warning';
  return (
    <div
      style={{
        ...cardStyle,
        background: isErr ? '#fef2f2' : isOk ? '#f0fdf4' : isWarn ? '#fffbeb' : '#f8fafc',
        borderColor: isErr ? '#fecaca' : isOk ? '#bbf7d0' : isWarn ? '#fde68a' : 'var(--twix-border)',
        marginBottom: 10,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
        <div>
          <strong style={{ fontSize: 13 }}>{msg.title}</strong>
          {msg.code ? (
            <span className="twix-muted" style={{ fontSize: 11, marginLeft: 6 }}>
              [{msg.code}]
            </span>
          ) : null}
          {msg.detail ? (
            <p style={{ margin: '6px 0 0', fontSize: 12 }} className="twix-muted">
              {msg.detail}
            </p>
          ) : null}
        </div>
        <button type="button" style={{ fontSize: 11, flex: 'none' }} onClick={onDismiss}>
          ×
        </button>
      </div>
    </div>
  );
}

export function ImportReviewPanelView(props: ImportReviewPanelViewProps) {
  const {
    listItems,
    jobsLoading,
    jobsError,
    jobsErrorMessage,
    onRetryJobs,
    selectedJobId,
    onSelectJob,
    detailVm,
    detailLoading,
    detailError,
    detailErrorMessage,
    onRetryJob,
    onRefresh,
    refreshDisabled,
    onFieldChange,
    onSaveDraft,
    onApplyReview,
    onPrepareCandidate,
    onApplyCandidate,
    canSaveReview,
    canApplyReview,
    canPrepareCandidate,
    canApplyCandidate,
    versionMarkersReady,
    saveReviewPending,
    applyReviewPending,
    preparePending,
    applyCandidateApiPending,
    postApplyEditorRefreshPending,
    anyMutationPending,
    reviewApplied,
    panelMessage,
    onDismissMessage,
  } = props;

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
        <p className="twix-panelTitle" style={{ margin: 0 }}>
          {IMPORT_REVIEW_UI.panelTitle}
        </p>
        <button
          type="button"
          style={{ fontSize: 12, padding: '4px 10px' }}
          onClick={onRefresh}
          disabled={refreshDisabled}
        >
          {IMPORT_REVIEW_UI.refresh}
        </button>
      </div>

      {panelMessage ? <MessageBanner msg={panelMessage} onDismiss={onDismissMessage} /> : null}

      {jobsLoading ? (
        <p className="twix-muted" style={{ fontSize: 13 }}>
          {IMPORT_REVIEW_UI.loadingJobs}
        </p>
      ) : null}

      {jobsError ? (
        <div style={{ fontSize: 13, marginBottom: 8 }}>
          <span style={{ color: '#b91c1c' }}>{jobsErrorMessage ?? 'Ошибка загрузки'}</span>
          <button type="button" style={{ marginLeft: 8, fontSize: 12 }} onClick={onRetryJobs}>
            {IMPORT_REVIEW_UI.retry}
          </button>
        </div>
      ) : null}

      {!jobsLoading && !jobsError && listItems.length === 0 ? (
        <p className="twix-muted" style={{ fontSize: 13 }}>
          {IMPORT_REVIEW_UI.noJobs}
        </p>
      ) : null}

      {!jobsLoading && !jobsError && listItems.length > 0 ? (
        <div style={{ marginBottom: 10 }}>
          <p className="twix-muted" style={{ fontSize: 11, margin: '0 0 6px' }}>
            Недавние import-jobs
          </p>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, maxHeight: 160, overflowY: 'auto' }}>
            {listItems.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  data-testid={`ir-job-row-${row.id}`}
                  onClick={() => onSelectJob(row.id)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '6px 8px',
                    marginBottom: 4,
                    borderRadius: 6,
                    border: `1px solid ${selectedJobId === row.id ? '#0f172a' : 'var(--twix-border)'}`,
                    background: selectedJobId === row.id ? '#f1f5f9' : '#fff',
                    cursor: 'pointer',
                    fontSize: 12,
                  }}
                >
                  <div style={{ fontWeight: 600 }}>
                    {row.createdAtLabel}{' '}
                    <span className="twix-muted" style={{ fontWeight: 400 }}>
                      · {row.jobIdShort}
                    </span>
                  </div>
                  <div style={{ marginTop: 4 }}>
                    <span style={badgeStyle('neutral')}>{row.extractionStatusLabel}</span>
                    <span style={badgeStyle('neutral')}>{row.reviewStatusLabel}</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!selectedJobId ? (
        <p className="twix-muted" style={{ fontSize: 13 }}>
          {IMPORT_REVIEW_UI.noSelection}
        </p>
      ) : null}

      {selectedJobId && detailLoading ? (
        <p className="twix-muted" style={{ fontSize: 13 }}>
          {IMPORT_REVIEW_UI.loadingDetail}
        </p>
      ) : null}

      {selectedJobId && detailError ? (
        <div style={{ fontSize: 13 }}>
          <span style={{ color: '#b91c1c' }}>{detailErrorMessage ?? 'Ошибка'}</span>
          <button type="button" style={{ marginLeft: 8, fontSize: 12 }} onClick={onRetryJob}>
            {IMPORT_REVIEW_UI.retry}
          </button>
        </div>
      ) : null}

      {detailVm && !detailLoading && !detailError ? (
        <>
          <div style={{ marginBottom: 10, fontSize: 12 }}>
            <span className="twix-muted">Статус job:</span> {detailVm.headerStatusLine}
            <div style={{ marginTop: 6 }}>
              <span style={badgeStyle('neutral')}>
                {IMPORT_REVIEW_UI.extractionBadge}: {detailVm.extractionStatusLabel}
              </span>
              <span style={badgeStyle('neutral')}>
                {IMPORT_REVIEW_UI.reviewBadge}: {detailVm.reviewStatusLabel}
              </span>
              <span style={badgeStyle('neutral')}>
                {IMPORT_REVIEW_UI.candidateBadge}: {detailVm.candidateStatusLabel}
              </span>
              <span style={badgeStyle('neutral')}>
                {IMPORT_REVIEW_UI.projectApplyBadge}: {detailVm.projectApplyStatusLabel}
              </span>
            </div>
          </div>

          {detailVm.errorMessage ? (
            <p style={{ fontSize: 12, color: '#b91c1c', marginBottom: 8 }}>{detailVm.errorMessage}</p>
          ) : null}

          <div style={{ ...cardStyle, padding: 8, marginBottom: 10 }}>
            <p className="twix-panelTitle" style={{ margin: '0 0 6px', fontSize: 12 }}>
              {IMPORT_REVIEW_UI.jobSummaryTitle}
            </p>
            <dl style={{ margin: 0, fontSize: 12, display: 'grid', gap: 4 }}>
              <dt className="twix-muted">{IMPORT_REVIEW_UI.sourceImages}</dt>
              <dd style={{ margin: 0 }}>{detailVm.sourceImagesCount}</dd>
              <dt className="twix-muted">{IMPORT_REVIEW_UI.unresolved}</dt>
              <dd style={{ margin: 0 }}>{detailVm.unresolvedCount}</dd>
              <dt className="twix-muted">{IMPORT_REVIEW_UI.missingDecisions}</dt>
              <dd style={{ margin: 0 }}>{detailVm.missingRequiredDecisionsCount}</dd>
              <dt className="twix-muted">{IMPORT_REVIEW_UI.blockingRemaining}</dt>
              <dd style={{ margin: 0 }}>{detailVm.remainingBlockingIssuesCount}</dd>
              <dt className="twix-muted">{IMPORT_REVIEW_UI.readyToApply}</dt>
              <dd style={{ margin: 0 }}>
                {detailVm.isReadyToApply ? IMPORT_REVIEW_UI.yes : IMPORT_REVIEW_UI.no}
              </dd>
            </dl>
          </div>

          <div style={{ ...cardStyle, padding: 8, marginBottom: 10 }}>
            <p className="twix-panelTitle" style={{ margin: '0 0 6px', fontSize: 12 }}>
              {IMPORT_REVIEW_UI.requiredDecisionsTitle}
            </p>
            {reviewApplied ? (
              <p className="twix-muted" style={{ fontSize: 12 }}>
                Review уже применён на сервере; поля решений заблокированы.
              </p>
            ) : detailVm.requiredFields.length === 0 ? (
              <p className="twix-muted" style={{ fontSize: 12 }}>
                Нет полей для отображения (нет snapshot или данные ещё не готовы).
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {detailVm.requiredFields.map((field) => (
                  <div key={field.key} style={{ fontSize: 12, display: 'block' }}>
                    <span style={{ fontWeight: 600 }}>
                      {field.label}
                      {field.isMissing ? <span style={{ color: '#b91c1c' }}> *</span> : null}
                    </span>
                    {field.description ? (
                      <span className="twix-muted" style={{ display: 'block', fontSize: 11, marginTop: 2 }}>
                        {field.description}
                      </span>
                    ) : null}
                    {field.controlType === 'floorHeightMm' || field.controlType === 'number' ? (
                      <input
                        type="number"
                        value={field.value === '' || field.value === null || field.value === undefined ? '' : String(field.value)}
                        onChange={(e) => onFieldChange(field, e.target.value === '' ? '' : Number(e.target.value))}
                        disabled={!canSaveReview || anyMutationPending}
                        style={{ width: '100%', marginTop: 4, padding: 6, fontSize: 13 }}
                      />
                    ) : null}
                    {field.controlType === 'select' || field.controlType === 'scaleMode' || field.controlType === 'issueResolution' ? (
                      <select
                        value={field.value === null || field.value === undefined ? '' : String(field.value)}
                        onChange={(e) => onFieldChange(field, e.target.value)}
                        disabled={!canSaveReview || anyMutationPending}
                        style={{ width: '100%', marginTop: 4, padding: 6, fontSize: 13 }}
                      >
                        <option value="">—</option>
                        {(field.options ?? []).map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    ) : null}
                    {field.controlType === 'boolean' ? (
                      <select
                        value={field.value === null || field.value === undefined ? '' : String(field.value)}
                        onChange={(e) => onFieldChange(field, e.target.value)}
                        disabled={!canSaveReview || anyMutationPending}
                        style={{ width: '100%', marginTop: 4, padding: 6, fontSize: 13 }}
                      >
                        <option value="">—</option>
                        <option value="yes">Да</option>
                        <option value="no">Нет</option>
                      </select>
                    ) : null}
                    {field.controlType === 'internalBearingWalls' ? (
                      <div data-testid="ir-internal-bearing-section" style={{ marginTop: 8 }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          <button
                            type="button"
                            data-testid="ir-internal-bearing-no"
                            disabled={!canSaveReview || anyMutationPending}
                            onClick={() => onFieldChange(field, { kind: 'setMode', mode: 'no' })}
                            style={{
                              padding: '6px 12px',
                              fontSize: 12,
                              borderRadius: 8,
                              border: `1px solid ${field.internalBearingMode === 'no' ? '#0f172a' : 'var(--twix-border)'}`,
                              background: field.internalBearingMode === 'no' ? '#e2e8f0' : '#fff',
                              cursor: canSaveReview && !anyMutationPending ? 'pointer' : 'not-allowed',
                            }}
                          >
                            {IMPORT_REVIEW_UI.internalBearingModeNo}
                          </button>
                          <button
                            type="button"
                            data-testid="ir-internal-bearing-yes"
                            disabled={!canSaveReview || anyMutationPending}
                            onClick={() => onFieldChange(field, { kind: 'setMode', mode: 'yes' })}
                            style={{
                              padding: '6px 12px',
                              fontSize: 12,
                              borderRadius: 8,
                              border: `1px solid ${field.internalBearingMode === 'yes' ? '#0f172a' : 'var(--twix-border)'}`,
                              background: field.internalBearingMode === 'yes' ? '#e2e8f0' : '#fff',
                              cursor: canSaveReview && !anyMutationPending ? 'pointer' : 'not-allowed',
                            }}
                          >
                            {IMPORT_REVIEW_UI.internalBearingModeYes}
                          </button>
                        </div>
                        {field.internalBearingMode === 'yes' ? (
                          <div style={{ marginTop: 10 }}>
                            <p style={{ fontSize: 11, margin: '0 0 6px' }} className="twix-muted">
                              {IMPORT_REVIEW_UI.internalBearingWallListHint}
                            </p>
                            {field.internalBearingCandidatesEmpty ? (
                              <p
                                data-testid="ir-internal-bearing-empty-candidates"
                                style={{ fontSize: 12, color: '#b45309', margin: 0 }}
                              >
                                {IMPORT_REVIEW_UI.internalBearingEmptyCandidates}
                              </p>
                            ) : (
                              <>
                                <p style={{ fontSize: 12, margin: '0 0 6px', fontWeight: 600 }}>
                                  {IMPORT_REVIEW_UI.internalBearingSelectedCount(
                                    Array.isArray((field.value as { wallIds?: string[] })?.wallIds)
                                      ? ((field.value as { wallIds: string[] }).wallIds?.length ?? 0)
                                      : 0
                                  )}
                                </p>
                                <ul
                                  style={{
                                    listStyle: 'none',
                                    padding: 0,
                                    margin: 0,
                                    maxHeight: 200,
                                    overflowY: 'auto',
                                  }}
                                >
                                  {(field.internalBearingWallRows ?? []).map((row) => {
                                    const wallIds = (field.value as { wallIds?: string[] })?.wallIds ?? [];
                                    const selected = wallIds.includes(row.wallId);
                                    return (
                                      <li key={row.wallId} style={{ marginBottom: 6 }}>
                                        <label
                                          style={{
                                            display: 'flex',
                                            gap: 8,
                                            alignItems: 'flex-start',
                                            cursor:
                                              canSaveReview && !anyMutationPending ? 'pointer' : 'not-allowed',
                                          }}
                                        >
                                          <input
                                            type="checkbox"
                                            data-testid={`ir-wall-cb-${row.wallId}`}
                                            checked={selected}
                                            disabled={!canSaveReview || anyMutationPending}
                                            onChange={() =>
                                              onFieldChange(field, {
                                                kind: 'toggleWall',
                                                wallId: row.wallId,
                                              })
                                            }
                                          />
                                          <span style={{ fontSize: 12 }}>
                                            <code>{row.wallId.length > 12 ? `${row.wallId.slice(0, 10)}…` : row.wallId}</code>
                                            <span className="twix-muted"> · этаж {row.floorLabel}</span>
                                            <div style={{ marginTop: 2 }}>{row.typeLabel}</div>
                                            <div className="twix-muted" style={{ fontSize: 11 }}>
                                              {row.subtitle}
                                            </div>
                                          </span>
                                        </label>
                                      </li>
                                    );
                                  })}
                                </ul>
                              </>
                            )}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ ...cardStyle, padding: 8, marginBottom: 10 }}>
            <p className="twix-panelTitle" style={{ margin: '0 0 6px', fontSize: 12 }}>
              {IMPORT_REVIEW_UI.issuesTitle}
            </p>
            {detailVm.issues.length === 0 ? (
              <p className="twix-muted" style={{ fontSize: 12 }}>
                Нет issues в snapshot.
              </p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12 }}>
                {detailVm.issues.map((iss) => (
                  <li key={iss.id} style={{ marginBottom: 8 }}>
                    <strong>{iss.severityLabel}</strong> · <code>{iss.code}</code>
                    <div>{iss.subtitle}</div>
                    <div className="twix-muted" style={{ fontSize: 11 }}>
                      id: {iss.id} · related: {iss.relatedIdsLabel}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div style={{ ...cardStyle, padding: 8 }}>
            <p className="twix-panelTitle" style={{ margin: '0 0 8px', fontSize: 12 }}>
              {IMPORT_REVIEW_UI.actionsTitle}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button
                type="button"
                data-testid="ir-save-draft"
                style={{ fontSize: 12, padding: '6px 10px' }}
                disabled={!canSaveReview || anyMutationPending}
                onClick={onSaveDraft}
              >
                {saveReviewPending ? 'Сохранение…' : IMPORT_REVIEW_UI.saveDraft}
              </button>
              <button
                type="button"
                data-testid="ir-apply-review"
                style={{ fontSize: 12, padding: '6px 10px' }}
                disabled={!canApplyReview || anyMutationPending}
                onClick={onApplyReview}
              >
                {applyReviewPending ? 'Применение…' : IMPORT_REVIEW_UI.applyReview}
              </button>
              <button
                type="button"
                data-testid="ir-prepare-candidate"
                style={{ fontSize: 12, padding: '6px 10px' }}
                disabled={!canPrepareCandidate || anyMutationPending}
                onClick={onPrepareCandidate}
              >
                {preparePending ? 'Подготовка…' : IMPORT_REVIEW_UI.prepareCandidate}
              </button>
              <button
                type="button"
                data-testid="ir-apply-candidate"
                style={{ fontSize: 12, padding: '6px 10px' }}
                disabled={!canApplyCandidate || !versionMarkersReady || anyMutationPending}
                onClick={onApplyCandidate}
                title={
                  !versionMarkersReady
                    ? 'Дождитесь загрузки текущей версии редактора'
                    : undefined
                }
              >
                {applyCandidateApiPending
                  ? 'Применение…'
                  : postApplyEditorRefreshPending
                    ? 'Обновление редактора…'
                    : IMPORT_REVIEW_UI.applyCandidate}
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
