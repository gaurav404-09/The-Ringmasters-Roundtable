import { PiggyBank, PlaneTakeoff, Building2 } from 'lucide-react';

const currencyLabel = (value) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return value;
  }
  return Math.round(value).toLocaleString();
};

const formatAmount = (value, currency) => {
  const amount = currencyLabel(value);
  if (!currency) {
    return amount;
  }
  return `${amount} ${currency}`;
};

const BudgetSummary = ({ budget }) => {
  if (!budget || !budget.cheapest_trip || !budget.cheapest_transport || !budget.cheapest_hotel) {
    return null;
  }

  const { cheapest_trip: combo, cheapest_transport: transport, cheapest_hotel: hotel } = budget;

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="rounded-2xl border border-emerald-300/40 bg-emerald-300/10 p-5 text-left">
        <div className="flex items-center gap-3 text-white/80">
          <PiggyBank className="h-6 w-6 text-emerald-200" />
          <span className="text-xs uppercase tracking-[0.3em] text-emerald-100/80">Cheapest combo</span>
        </div>
        <p className="mt-4 text-3xl font-semibold text-white">{formatAmount(combo.totalCost, combo.currency)}</p>
        <p className="mt-2 text-sm font-semibold text-emerald-100/80">Stay: {hotel.name}</p>
        <p className="mt-1 text-xs text-emerald-100/70">Includes transport + stay sourced by Budget Agent.</p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-left">
        <div className="flex items-center gap-3 text-white/80">
          <PlaneTakeoff className="h-6 w-6 text-cyan-200" />
          <span className="text-xs uppercase tracking-[0.3em] text-white/60">Transport pick</span>
        </div>
        <p className="mt-4 text-lg font-semibold text-white">
          {transport.provider} • {transport.from} → {transport.to}
        </p>
        <p className="mt-1 text-sm text-white/70">
          {transport.duration} · {formatAmount(transport.price, transport.currency)}
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-left">
        <div className="flex items-center gap-3 text-white/80">
          <Building2 className="h-6 w-6 text-violet-200" />
          <span className="text-xs uppercase tracking-[0.3em] text-white/60">Stay pick</span>
        </div>
        <p className="mt-4 text-lg font-semibold text-white">{hotel.name}</p>
        <p className="mt-1 text-sm text-white/70">
          {formatAmount(hotel.price, hotel.currency)} · Check-in {hotel.details?.checkIn}
        </p>
      </div>
    </div>
  );
};

export default BudgetSummary;
