/**
 * The localStorage store.
 *
 * What this is and is not: it is enough to make the intake resumable across a
 * reload on one device. It is not persistence. Clearing site data loses it, and
 * a second device never sees it. The intake says so rather than implying an
 * account exists.
 *
 * Every read and write is wrapped, because `localStorage` throws outright in
 * some contexts (Safari private browsing, a browser set to block site data)
 * rather than returning null. A store that throws on read would break the form
 * for those users instead of merely failing to save it.
 */

import { INTAKE_STEPS } from './types';
import type { IntakeDraft, IntakeStep, ProfileStore, StepRecord } from './types';

const KEY = 'blindspot.intake.v1';

function read(): IntakeDraft | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as IntakeDraft;
    // A draft written by an older version, or hand-edited, must not crash the
    // form. Anything that does not look right is treated as absent.
    if (!parsed?.profileId || typeof parsed.steps !== 'object') return null;
    for (const step of Object.keys(parsed.steps)) {
      if (!INTAKE_STEPS.includes(step as IntakeStep)) return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function write(draft: IntakeDraft): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(draft));
  } catch {
    // Out of quota, or storage blocked. The draft stays correct in memory for
    // this session; it simply will not survive a reload.
  }
}

function emptyDraft(): IntakeDraft {
  const now = new Date().toISOString();
  return {
    profileId:
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `local-${now}`,
    steps: {},
    createdAt: now,
    updatedAt: now,
  };
}

export class LocalProfileStore implements ProfileStore {
  readonly name = 'local';

  async load(): Promise<IntakeDraft | null> {
    return read();
  }

  async saveStep<T>(step: IntakeStep, payload: T, completed: boolean): Promise<IntakeDraft> {
    const now = new Date().toISOString();
    const draft = read() ?? emptyDraft();
    const existing = draft.steps[step];

    const record: StepRecord<T> = {
      step,
      payload,
      // Once completed, a step stays completed. Re-opening it to change an
      // answer must not make the dashboard think the step was abandoned.
      completedAt: completed ? (existing?.completedAt ?? now) : (existing?.completedAt ?? null),
      updatedAt: now,
    };

    const next: IntakeDraft = {
      ...draft,
      steps: { ...draft.steps, [step]: record },
      updatedAt: now,
    };

    write(next);
    return next;
  }

  async clear(): Promise<void> {
    try {
      window.localStorage.removeItem(KEY);
    } catch {
      // Nothing to do. The caller reloads either way.
    }
  }
}
