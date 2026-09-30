import type { ReceptionPatientResponse } from '../types/domain';

export type PatientAccountFilter = 'ALL' | 'LINKED' | 'WALK_IN';

/** Filters only rows supplied by an authorized, explicitly submitted search. */
export function filterPatientResults(rows: ReceptionPatientResponse[], filter: PatientAccountFilter): ReceptionPatientResponse[] {
  return rows.filter((patient) => filter === 'ALL' || (filter === 'LINKED' ? Boolean(patient.userId) : !patient.userId));
}
