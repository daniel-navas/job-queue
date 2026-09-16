export function monthlySalary(fact) {
  if (!fact) return null;
  const text = `${fact.value} ${fact.evidence}`;
  const currency = text.match(/\b(USD|COP|EUR|GBP|CAD|AUD)\b/i)?.[1]?.toUpperCase();
  const amount = text.match(/(?:[$€£]\s*|\b(?:USD|COP|EUR|GBP|CAD|AUD)\s*)(\d[\d,.]*(?:\s*[kK])?)(?:\s*[-–—]\s*[$€£]?\s*(\d[\d,.]*(?:\s*[kK])?))?/) || text.match(/(\d[\d,.]*(?:\s*[kK])?)(?:\s*[-–—]\s*(\d[\d,.]*(?:\s*[kK])?))?\s*(?:USD|COP|EUR|GBP|CAD|AUD)\b/);
  if (!amount) return null;
  const parse = value => {
    let number = value.replace(/[\sKk]/g, '');
    if (/^\d{1,3}(\.\d{3})+$/.test(number)) number = number.replace(/\./g, '');
    else if (/^\d+,\d{1,2}$/.test(number)) number = number.replace(',', '.');
    else number = number.replace(/,/g, '');
    return Number(number) * (/[kK]/.test(value) ? 1000 : 1);
  };
  let factor, assumption;
  if (/\/\s*(?:hour|hr)|per hour|hourly/i.test(text)) { factor = 40 * 52 / 12; assumption = '40 hours/week × 52 weeks ÷ 12; estimated, not guaranteed'; }
  else if (/\/\s*(?:year|yr)|per year|annual|yearly/i.test(text)) { factor = 1 / 12; assumption = 'Annual amount ÷ 12'; }
  else if (/\/\s*(?:month|mo)\b|per month|monthly/i.test(text)) { factor = 1; assumption = 'Published monthly amount'; }
  else return null;
  const qualifier = /\bgross\b/i.test(text) ? 'gross' : /\bnet\b/i.test(text) ? 'net' : null;
  return { min: parse(amount[1]) * factor, max: parse(amount[2] || amount[1]) * factor, currency: currency ?? null, qualifier, assumption };
}

let exchange, refreshAt = 0, refreshing;
export async function exchangeRates() {
  if (Date.now() < refreshAt) return exchange;
  if (refreshing) return refreshing;
  refreshing = (async () => {
    try {
      const response = await fetch('https://open.er-api.com/v6/latest/USD', { signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw new Error('Rate unavailable');
      const data = await response.json();
      if (data.result !== 'success' || !Number.isFinite(data.rates?.COP)) throw new Error('Invalid exchange data');
      exchange = { rates: data.rates, date: new Date(data.time_last_update_unix * 1000).toISOString().slice(0, 10) };
      refreshAt = Date.now() + 86400000;
    } catch { refreshAt = Date.now() + 60000; }
    finally { refreshing = null; }
    return exchange;
  })();
  return refreshing;
}

export function withCOP(monthly, exchange) {
  if (!monthly || !monthly.currency) return monthly;
  const sourceRate = exchange?.rates?.[monthly.currency];
  if (!Number.isFinite(sourceRate) || sourceRate <= 0) return monthly.currency === 'COP' ? monthly : { ...monthly, conversionUnavailable: true };
  const usdRate = 1 / sourceRate;
  const converted = monthly.currency === 'USD' ? monthly : { ...monthly, usd: { min: monthly.min * usdRate, max: monthly.max * usdRate, rate: usdRate, date: exchange.date } };
  if (monthly.currency === 'COP') return converted;
  const copRate = exchange.rates.COP / sourceRate;
  if (!Number.isFinite(copRate) || copRate <= 0) return { ...converted, conversionUnavailable: true };
  return { ...converted, cop: { min: monthly.min * copRate, max: monthly.max * copRate, rate: copRate, date: exchange.date } };
}
