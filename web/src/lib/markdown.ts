import { marked } from 'marked';
import { safeLink } from '@shared/links';

/**
 * Render session descriptions. Raw HTML is escaped before parsing rather than
 * sanitised after, so no markup an author writes can ever reach the DOM
 * (SPEC §7.4). Links are forced to open in a new tab with `noopener`.
 */
const escapeHtml = (raw: string): string =>
  raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** The same rule the link fields are held to, so a link written in a bio and
 *  a link typed into a field cannot disagree about what is allowed. Relative
 *  links resolve against the page, which is why markdown passes a base. */
const safeHref = (href: string): string | undefined =>
  safeLink(href, window.location.origin) ?? undefined;

const renderer = new marked.Renderer();
renderer.link = ({ href, title, tokens }) => {
  const text = renderer.parser.parseInline(tokens);
  const safe = safeHref(href);
  if (!safe) return text;
  const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
  return `<a href="${escapeHtml(safe)}"${titleAttr} target="_blank" rel="noopener noreferrer">${text}</a>`;
};
renderer.image = ({ text }) => escapeHtml(text);

marked.setOptions({ renderer, gfm: true, breaks: true });

export function renderMarkdown(source: string): string {
  return marked.parse(escapeHtml(source), { async: false });
}
