import type { CreateImportJobRequest, ImportJob } from '@2wix/shared-types';

export type ImportJobExecutionMode = 'sync' | 'async-inline';

interface ImportJobRunnerInput {
  queuedJob: ImportJob;
  request: CreateImportJobRequest;
  runPipeline: (job: ImportJob, request: CreateImportJobRequest) => Promise<ImportJob>;
}

export interface ImportJobRunner {
  readonly mode: ImportJobExecutionMode;
  execute(input: ImportJobRunnerInput): Promise<ImportJob>;
}

export class SyncImportJobRunner implements ImportJobRunner {
  readonly mode = 'sync' as const;

  async execute(input: ImportJobRunnerInput): Promise<ImportJob> {
    return input.runPipeline(input.queuedJob, input.request);
  }
}

export type AsyncInlineScheduler = (task: () => Promise<void>) => void;

export class AsyncInlineImportJobRunner implements ImportJobRunner {
  readonly mode = 'async-inline' as const;

  constructor(
    private readonly schedule: AsyncInlineScheduler = (task) => {
      setTimeout(() => {
        void task();
      }, 0);
    }
  ) {}

  async execute(input: ImportJobRunnerInput): Promise<ImportJob> {
    this.schedule(async () => {
      await input.runPipeline(input.queuedJob, input.request);
    });
    return input.queuedJob;
  }
}
