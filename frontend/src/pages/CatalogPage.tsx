import { useEffect, useState } from 'react';
import { getAdminDoctors, getCatalogMedicines, getCatalogServices, getServicePrice, getSpecialties } from '../api/clinic';
import Alert from '../components/Alert';
import PageHeader from '../components/PageHeader';
import { integrations } from '../config/integrations.config';
import type { AdminDoctorResponse, CatalogServiceResponse, MedicineResponse, PriceResponse, SpecialtyResponse } from '../types/domain';
import type { ClinicRole } from '../utils/roles';
import { formatMoney } from '../utils/format';

export default function CatalogPage({ role }: { role: ClinicRole }) {
  if (!['ADMIN', 'DOCTOR'].includes(role)) return <Alert tone="error">Catalog access is not available for this role.</Alert>;
  if (!integrations.adminCatalog) return <><PageHeader title="Catalog" subtitle="Doctor and service directories" />
    <Alert tone="info">Catalog is not enabled in this deployment. Contact the clinic administrator.</Alert></>;
  return <ActiveCatalogPage role={role} />;
}

function ActiveCatalogPage({ role }: { role: ClinicRole }) {
  const [services, setServices] = useState<CatalogServiceResponse[] | null>(null);
  const [medicines, setMedicines] = useState<MedicineResponse[] | null>(null);
  const [specialties, setSpecialties] = useState<SpecialtyResponse[] | null>(null);
  const [doctors, setDoctors] = useState<AdminDoctorResponse[] | null>(null);
  const [selectedService, setSelectedService] = useState('');
  const [price, setPrice] = useState<PriceResponse | null>(null);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [priceLoading, setPriceLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [priceError, setPriceError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true); setError(null);
    setServices(null); setMedicines(null); setSpecialties(null); setDoctors(null); setPrice(null);
    const adminList = role === 'ADMIN' ? getAdminDoctors() : Promise.resolve(null);
    void Promise.all([getCatalogServices(), getCatalogMedicines(), getSpecialties(), adminList])
      .then(([serviceList, medicineList, specialtyList, doctorPage]) => {
        if (!active) return;
        if (!Array.isArray(serviceList) || !Array.isArray(medicineList) || !Array.isArray(specialtyList)
          || (doctorPage && !Array.isArray(doctorPage.content))) throw new Error('Invalid catalog response');
        setServices(serviceList.filter((item) => item.active));
        setMedicines(medicineList.filter((item) => item.active));
        setSpecialties(specialtyList);
        if (doctorPage) setDoctors(doctorPage.content.filter((item) => item.active));
      }).catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Catalog request failed'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [revision, role]);

  async function chooseService(id: string) {
    setSelectedService(id); setPrice(null); setPriceError(null);
    if (!id) return;
    setPriceLoading(true);
    try {
      const confirmed = await getServicePrice(id);
      if (confirmed.serviceId !== id) throw new Error('Price does not belong to selected service');
      setPrice(confirmed);
    } catch (cause) { setPriceError(cause instanceof Error ? cause.message : 'Price unavailable'); }
    finally { setPriceLoading(false); }
  }

  return <>
    <PageHeader title="Catalog" subtitle="Published services, medicines and administrator-only doctor directory"
      actions={<button type="button" className="soft-button" disabled={loading} onClick={() => setRevision((value) => value + 1)}>Refresh</button>} />
    {loading && <p role="status">Loading catalog...</p>}
    {error && <Alert tone="error">{error} <button type="button" onClick={() => setRevision((value) => value + 1)}>Retry</button></Alert>}
    {services && <section className="panel settings-form"><h3>Available services</h3>
      {services.length === 0 ? <p>No active services.</p> : <label>Choose a service
        <select value={selectedService} onChange={(event) => void chooseService(event.target.value)}>
          <option value="">Select a service</option>{services.map((item) => <option key={item.id} value={item.id}>{item.code} — {item.name}</option>)}
        </select>
      </label>}
      {priceLoading && <p>Loading effective price...</p>}
      {priceError && <Alert tone="error">{priceError} <button type="button" onClick={() => void chooseService(selectedService)}>Retry</button></Alert>}
      {price && <p>Effective price: {formatMoney(price.amount)} {price.currency}; valid from {price.effectiveFrom}{price.effectiveUntil ? ` through ${price.effectiveUntil}` : ''}.</p>}
    </section>}
    {medicines && <section className="panel"><h3>Active medicines (reference only)</h3>
      {medicines.length === 0 ? <p>No active medicines.</p> : <ul>{medicines.map((item) => <li key={item.id}>{item.code}: {item.name} ({item.unit})</li>)}</ul>}
      <p>A selected medicine is not a verified prescription until the medical service validates its catalog ID.</p>
    </section>}
    {specialties && <section className="panel"><h3>Specialties</h3>
      {specialties.length === 0 ? <p>No specialties.</p> : <ul>{specialties.map((item) => <li key={item.id}>{item.name}</li>)}</ul>}
    </section>}
    {role === 'ADMIN' && doctors && <section className="panel"><h3>Active doctors — administrator directory</h3>
      {doctors.length === 0 ? <p>No active doctors.</p> : <ul>{doctors.map((item) => <li key={item.id}>{item.id} — {item.specialtyName || 'Unassigned specialty'}</li>)}</ul>}
      <p>This API is administrator-only; patient and reception booking cannot use this directory.</p>
    </section>}
  </>;
}