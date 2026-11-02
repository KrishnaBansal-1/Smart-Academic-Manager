import { isMainThread, parentPort, Worker } from 'worker_threads';
import path from 'path';
import { solve } from './algorithm';
import { SolverInput, SolverOutput } from './types';

// Worker execution context
if (!isMainThread && parentPort) {
  parentPort.on('message', async (data: { type: 'START'; input: SolverInput }) => {
    try {
      if (data?.type === 'START') {
        const output = solve(data.input, (progress, message) => {
          parentPort?.postMessage({ type: 'PROGRESS', progress, message });
        });
        parentPort?.postMessage({ type: 'DONE', output });
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      parentPort?.postMessage({ type: 'ERROR', error: errorMsg });
    }
  });
}

/**
 * Executes the timetable generation job inside a dedicated worker thread.
 * Automatically handles dev (ts-node) and production (compiled JS) execution.
 */
export function runSolverJob(
  input: SolverInput,
  onProgress?: (progress: number, message: string) => void
): Promise<SolverOutput> {
  return new Promise((resolve, reject) => {
    const ext = path.extname(__filename);
    const isTs = ext === '.ts';
    const workerPath = path.resolve(__dirname, `worker${ext}`);

    const worker = new Worker(workerPath, {
      execArgv: isTs ? ['-r', 'ts-node/register/transpile-only'] : [],
    });

    const maxSec = input.config?.maxSeconds || 30;
    const timeoutMs = (maxSec + 15) * 1000;

    let isFinished = false;

    const timer = setTimeout(() => {
      if (!isFinished) {
        isFinished = true;
        worker.terminate().catch(() => {});
        reject(new Error(`Timetable generation timed out after ${maxSec} seconds`));
      }
    }, timeoutMs);

    worker.on('message', (msg: { type: string; progress?: number; message?: string; output?: SolverOutput; error?: string }) => {
      if (msg.type === 'PROGRESS') {
        if (typeof msg.progress === 'number' && msg.message) {
          onProgress?.(msg.progress, msg.message);
        }
      } else if (msg.type === 'DONE') {
        if (!isFinished) {
          isFinished = true;
          clearTimeout(timer);
          worker.terminate().catch(() => {});
          if (msg.output) {
            resolve(msg.output);
          } else {
            reject(new Error('Worker completed without returning output'));
          }
        }
      } else if (msg.type === 'ERROR') {
        if (!isFinished) {
          isFinished = true;
          clearTimeout(timer);
          worker.terminate().catch(() => {});
          reject(new Error(msg.error || 'Worker execution error'));
        }
      }
    });

    worker.on('error', (err) => {
      if (!isFinished) {
        isFinished = true;
        clearTimeout(timer);
        worker.terminate().catch(() => {});
        reject(err);
      }
    });

    worker.on('exit', (code) => {
      if (!isFinished) {
        isFinished = true;
        clearTimeout(timer);
        if (code !== 0) {
          reject(new Error(`Worker stopped with non-zero exit code ${code}`));
        }
      }
    });

    worker.postMessage({ type: 'START', input });
  });
}
