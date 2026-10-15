import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { escapeHtml, headTags, seoFor } from './seo.js';

describe('Référencement', () => {
  it('échappe le HTML et protège le JSON-LD', () => {
    assert.equal(escapeHtml(`<a href="x">'&`), '&#60;a href=&#34;x&#34;&#62;&#39;&#38;');
    const page = { ...seoFor('/', null, undefined, 'https://s.test'), jsonLd: [{ name: '</script><script>x' }] };
    const tags = headTags(page, 'https://s.test');
    assert.doesNotMatch(tags, /<\/script><script>x/);
    assert.match(tags, /\\u003c\/script>/);
  });

  it('donne une page générique sans catalogue importé', () => {
    const page = seoFor('/', null, undefined, 'https://s.test');
    assert.match(page.title, /SpamDex/);
    assert.equal(page.indexable, true);
    assert.equal(seoFor('/admin', null, undefined, 'https://s.test').indexable, false);
  });
});
