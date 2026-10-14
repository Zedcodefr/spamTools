import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseRichText } from './richText.ts';

describe('parseRichText', () => {
  it('reconnaît icônes, éléments et mots-clés', () => {
    assert.deepEqual(parseRichText('Attaque 10 {icon:fire} {el:fire}Feu{/el}\nBonus {kw:luck}Chance{/kw}'), [
      { type: 'text', text: 'Attaque 10 ' },
      { type: 'icon', id: 'fire' },
      { type: 'text', text: ' ' },
      { type: 'element', id: 'fire', children: [{ type: 'text', text: 'Feu' }] },
      { type: 'text', text: '\nBonus ' },
      { type: 'keyword', id: 'luck', children: [{ type: 'text', text: 'Chance' }] },
    ]);
  });

  it('accepte une icône dans un mot-clé et un identifiant composé', () => {
    assert.deepEqual(parseRichText('{kw:talent.TCoeurFeu_C}{icon:fire}Cœur{/kw}'), [
      { type: 'keyword', id: 'talent.TCoeurFeu_C', children: [{ type: 'icon', id: 'fire' }, { type: 'text', text: 'Cœur' }] },
    ]);
  });

  it('conserve tel quel un texte sans balise ou des balises mal formées', () => {
    assert.deepEqual(parseRichText('Bonus (+7) Eau.'), [{ type: 'text', text: 'Bonus (+7) Eau.' }]);
    assert.deepEqual(parseRichText('a{/el}b'), [{ type: 'text', text: 'a{/el}b' }]);
    assert.deepEqual(parseRichText('{el:fire}Feu'), [{ type: 'text', text: '{el:fire}Feu' }]);
    assert.deepEqual(parseRichText('{el:fire}x{/kw}y{/el}'), [
      { type: 'element', id: 'fire', children: [{ type: 'text', text: 'x{/kw}y' }] },
    ]);
  });
});
