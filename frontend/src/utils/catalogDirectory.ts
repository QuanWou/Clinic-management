import type { CatalogServiceResponse, MedicineResponse, SpecialtyResponse } from '../types/domain';

export type CatalogTab = 'services' | 'medicines' | 'specialties';
export type CatalogStatus = 'ALL' | 'ACTIVE' | 'INACTIVE';

/** Client-side filters apply only to the role-scoped API response, never to guessed data. */
export function filterCatalogEntries<T extends CatalogServiceResponse | MedicineResponse | SpecialtyResponse>(
  entries: T[], text: string, status: CatalogStatus
): T[] {
  const query = text.trim().toLocaleLowerCase('vi-VN');
  return entries.filter((entry) => {
    if ('active' in entry && status !== 'ALL' && entry.active !== (status === 'ACTIVE')) return false;
    return !query || [entry.id, entry.name, entry.description ?? '', 'code' in entry ? entry.code : '',
      'unit' in entry ? entry.unit : ''].some((value) => value.toLocaleLowerCase('vi-VN').includes(query));
  });
}
