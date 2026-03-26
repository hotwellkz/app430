import {
  AsyncInlineImportJobRunner,
  type ImportJobExecutionMode,
  type ImportJobRunner,
  SyncImportJobRunner,
} from './importJobRunner.js';

function parseExecutionMode(
  src: NodeJS.ProcessEnv = process.env
): ImportJobExecutionMode {
  const raw = (src.IMPORT_JOB_EXECUTION_MODE ?? 'sync').trim().toLowerCase();
  if (raw === 'sync') return 'sync';
  if (raw === 'async-inline') return 'async-inline';
  throw new Error(
    `IMPORT_JOB_EXECUTION_MODE должен быть sync|async-inline, получено: ${src.IMPORT_JOB_EXECUTION_MODE}`
  );
}

export function resolveImportJobRunner(
  src: NodeJS.ProcessEnv = process.env
): ImportJobRunner {
  const mode = parseExecutionMode(src);
  if (mode === 'async-inline') {
    return new AsyncInlineImportJobRunner();
  }
  return new SyncImportJobRunner();
}
