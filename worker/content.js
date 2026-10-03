import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';
export const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
export function renderMarkdown(body) {
  return sanitizeHtml(marked.parse(body), {
    allowedTags: [...sanitizeHtml.defaults.allowedTags, 'img'],
    allowedAttributes: {
      a: ['href', 'title', 'rel'], img: ['src', 'alt', 'title'],
      div: ['class'], span: ['class'], code: ['class'], th: ['align'], td: ['align']
    },
    allowedClasses: { div: ['callout'], span: ['text-accent'], code: ['language-*'] },
    allowedSchemes: ['https', 'http', 'mailto'],
    allowProtocolRelative: false,
    transformTags: { a: sanitizeHtml.simpleTransform('a', {rel: 'noopener noreferrer'}) }
  });
}
