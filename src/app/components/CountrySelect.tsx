import { useMemo } from 'react';
import { COUNTRY_CODES, flagEmoji } from '../../shared/competition/identity';
import { countryName } from '../lib/format';
import { inputClass } from './Ui';

export function CountrySelect({ value, onChange, id }: { value: string | null; onChange: (v: string | null) => void; id?: string }) {
  const options = useMemo(
    () => COUNTRY_CODES.map((c) => ({ code: c, name: countryName(c) })).sort((a, b) => a.name.localeCompare(b.name)),
    [],
  );
  return (
    <select id={id} className={inputClass} value={value ?? ''} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">Prefer not to say</option>
      {options.map((o) => (
        <option key={o.code} value={o.code}>
          {flagEmoji(o.code)} {o.name}
        </option>
      ))}
    </select>
  );
}
