import { useApi, useApp } from "../hooks";
import { PageHeader, Panel, Stat, Meter, Loading } from "../components/ui";
import { money } from "../format";

export default function LicensesPage() {
  const { clientId } = useApp();
  const { data } = useApi(`/api/clients/${clientId}/licenses`);
  if (!data) return <Loading label="Loading subscriptions..." />;

  const { licenses, disabledAccounts } = data;
  const monthly = licenses.reduce((n, l) => n + l.monthlyWaste, 0);
  const totalSpend = licenses.reduce((n, l) => n + l.prepaid * (l.pricePerMonth || 0), 0);
  const seats = licenses.reduce((n, l) => n + l.prepaid, 0);
  const used = licenses.reduce((n, l) => n + l.consumed, 0);

  return (
    <>
      <PageHeader title="Licenses" subtitle="Microsoft 365 subscriptions, how many seats are assigned, and what unused seats cost. Prices are list-price estimates." />

      <div className="stats-row">
        <Stat value={money(totalSpend)} label="estimated monthly spend" note={`${seats} seats`} />
        <Stat value={`${Math.round((used / (seats || 1)) * 100)}%`} label="seats assigned" note={`${used} of ${seats}`} />
        <Stat value={money(monthly)} label="unused per month" tone={monthly > 100 ? "warn" : undefined} />
        <Stat value={money(monthly * 12)} label="unused per year" tone={monthly > 100 ? "warn" : undefined} note="savings at next renewal" />
        <Stat value={disabledAccounts.length} label="disabled accounts" note="check they don't hold licenses" />
      </div>

      <Panel title="Subscriptions" id="subs-title" className="flush">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th scope="col">Product</th><th scope="col">Assigned</th><th scope="col" className="num">Unused</th><th scope="col" className="num">Price / seat</th><th scope="col" className="num">Unused cost / month</th></tr></thead>
            <tbody>
              {licenses.map((l) => {
                const usedPct = Math.round((l.consumed / (l.prepaid || 1)) * 100);
                return (
                  <tr key={l.sku}>
                    <td><span className="cell-main">{l.name}</span><span className="cell-sub mono">{l.sku}</span></td>
                    <td><span className="meter-cell"><Meter value={usedPct} tone={usedPct >= 90 ? "good" : usedPct >= 70 ? "warn" : "bad"} /> {l.consumed} of {l.prepaid}</span></td>
                    <td className="num">{l.unused}</td>
                    <td className="num">{l.pricePerMonth ? `$${l.pricePerMonth.toFixed(2)}` : "–"}</td>
                    <td className={`num ${l.monthlyWaste > 0 ? "tone-warn" : ""}`}>{money(l.monthlyWaste)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      {disabledAccounts.length > 0 && (
        <Panel title="Disabled accounts" id="disabled-title">
          <p className="muted">Disabled accounts can still hold paid licenses. Remove the license after mailbox and OneDrive data is handed over (usually 30 days).</p>
          <ul className="plain-list">{disabledAccounts.map((u) => <li key={u.upn}><strong>{u.name}</strong> <span className="muted">{u.upn}</span></li>)}</ul>
        </Panel>
      )}
    </>
  );
}
