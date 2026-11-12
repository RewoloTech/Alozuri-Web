import { countryName } from '@alozuri/shared';

/** Keep large coverage lists available without stretching every transaction row. */
export function OperationsCountries({ countries }: { countries: string[] }) {
  if (!countries.length) return <div>Historical destination not recorded</div>;
  const names = [...new Set(countries)].map(countryName);
  if (names.length <= 3) return <div>{names.join(', ')}</div>;
  return (
    <details className="operations-countries">
      <summary>{names.length} countries</summary>
      <p>{names.join(', ')}</p>
    </details>
  );
}
