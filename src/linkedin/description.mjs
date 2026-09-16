// The current detail page can render the description in HTML without a
// corresponding job JSON response. Scope to its heading, not similar jobs.
export async function readJobDescription(page, id) {
  const actualId = new URL(page.url()).pathname.match(/^\/jobs\/view\/(\d+)\/?$/)?.[1];
  if (actualId !== id) return null;
  return page.evaluate(() => {
    const heading = [...document.querySelectorAll('h2,h3')].find(node => /^(About the job|Acerca del empleo)$/i.test(node.textContent.trim()));
    if (!heading) return null;
    let parent = heading.parentElement, description;
    for (let depth = 0; parent && depth < 3; depth++, parent = parent.parentElement) {
      description = parent.querySelector('[data-testid="expandable-text-box"], #job-details, .jobs-description__content');
      if (description) break;
    }
    if (!description) return null;
    // The full text is present in the DOM even when CSS clips its display.
    const copy = description.cloneNode(true);
    copy.querySelectorAll('button,script,style,[data-testid="expandable-text-button"]').forEach(node => node.remove());
    copy.querySelectorAll('p,li,h2,h3,h4,br').forEach(node => node.append(document.createTextNode('\n')));
    const text = copy.textContent.replace(/[ \t]+/g, ' ').replace(/\n\s*\n\s*\n/g, '\n\n').trim();
    return text.length >= 100 && !/\.{3}$|…$/.test(text) ? text : null;
  });
}
