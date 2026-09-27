export function publicationAgeLabel(publishedAt, now = Date.now()) {
  const timestamp = Number(publishedAt);
  if (!publishedAt || !Number.isFinite(timestamp)) return null;
  const days = Math.max(0, Math.floor((now - timestamp) / 86400000));
  if (days === 0) return 'today';
  return days === 1 ? '1 day ago' : `${days} days ago`;
}

export function listTags(job) {
  const tags = [];
  if (job.easyApply === true) {
    const contribution = job.rating?.fields?.easyApply?.contribution;
    const score = Number.isFinite(contribution) && contribution > 0 ? ` +${Number(contribution.toFixed(2))}` : '';
    tags.push({
      label: `Easy Apply${score}`,
      tone: 'positive',
      title: 'Easy Apply fit bonus before publication recency',
    });
  }
  const visaContribution = job.rating?.fields?.visaSupport?.contribution;
  if (job.summary?.facts?.visaSupport?.value === 'supported' && Number.isFinite(visaContribution) && visaContribution > 0) {
    tags.push({
      label: `Visa sponsorship +${Number(visaContribution.toFixed(2))}`,
      tone: 'positive',
      title: 'Confirmed visa sponsorship bonus before publication recency',
    });
  }
  return tags;
}
