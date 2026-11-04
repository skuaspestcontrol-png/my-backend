// Presentation only: never use these strings as financial inputs or API values.
const wholeRupees = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0
});

const rupeeCurrency = new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 0
});

function displayAmount(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return 0;
  // A small credit should display as zero rather than a misleading negative zero.
  return Math.abs(amount) < 0.5 ? 0 : amount;
}

export const formatRupeeAmount = (value = 0) => wholeRupees.format(displayAmount(value));
export const formatRupees = (value = 0) => rupeeCurrency.format(displayAmount(value));
