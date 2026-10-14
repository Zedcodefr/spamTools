import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Ability, Card } from '../../domain/Card.ts';
import { ArtistCredit } from './ArtistCredit.tsx';
import { useCardEnvironment } from './CardEnvironment.tsx';
import { GameCard } from './GameCard.tsx';
import { RichText } from './RichText.tsx';
import { TraitIcon } from './TraitIcon.tsx';
import './CardDetail.css';

const DETAIL_CARD_MAX_WIDTH = 400;

/**
 * Vue détail d'une carte : la carte en grand, ses talents, capacités, tox,
 * résistances et son lore. Fermeture : bouton, Échap ou clic sur le fond.
 */
export function CardDetail({ card, onClose }: { card: Card; onClose: () => void }) {
  const { catalog, assetUrl } = useCardEnvironment();
  const dialog = useRef<HTMLDivElement>(null);
  const element = catalog.elements.get(card.element);
  const rarity = catalog.rarities.get(card.rarity);
  const cardWidth = Math.min(DETAIL_CARD_MAX_WIDTH, window.innerWidth - 48);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus();
    };
  }, [onClose]);

  return (
    <div className="card-detail" onClick={onClose}>
      <div
        ref={dialog}
        className="card-detail__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="card-detail-title"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        onContextMenu={(event) => event.preventDefault()}
      >
        <button type="button" className="card-detail__close" onClick={onClose} aria-label="Fermer">
          ×
        </button>

        <header className="card-detail__header">
          <h2 id="card-detail-title">{card.name}</h2>
          <p className="card-detail__subline">
            <span>#{card.number}</span>
            {element && (
              <span className="card-detail__tag" style={{ color: element.color }}>
                <img src={assetUrl(element.icon)} alt="" /> {element.name}
              </span>
            )}
            {rarity && (
              <span className="card-detail__tag" style={{ color: rarity.textColor ?? undefined }}>
                {rarity.name}
              </span>
            )}
            <ArtistCredit artist={card.artwork.artist} />
          </p>
        </header>

        <div className="card-detail__body">
          <div className="card-detail__card">
            <GameCard card={card} width={cardWidth} highDefinition showCredit={false} />
          </div>

          <div className="card-detail__sheet">
            <Profile card={card} />
            <Talents card={card} />

            <Section title="Capacités" empty="Aucune capacité">
              {card.abilities.map((ability) => (
                <AbilityBlock key={ability.id} ability={ability} />
              ))}
            </Section>

            <Section title="Tox" empty="Aucun tox">
              {card.skills.map((skill) => (
                <article key={skill.id} className="card-detail__entry">
                  <h4>
                    {skill.icon && <img className="card-detail__entry-icon" src={assetUrl(skill.icon)} alt="" />}
                    {skill.name}
                    <span className="card-detail__muted">
                      {' · '}
                      {catalog.rarities.get(skill.rarity)?.name ?? skill.rarity}
                    </span>
                  </h4>
                  <p>
                    <RichText source={skill.effectRich} />
                  </p>
                </article>
              ))}
            </Section>

            <section className="card-detail__section">
              <h3>Résistances</h3>
              <p className="card-detail__muted">Pourcentage de dégâts réduits pour chaque élément</p>
              <ul className="card-detail__resistances">
                {Object.entries(card.resistances).map(([elementId, value]) => {
                  const resisted = catalog.elements.get(elementId);
                  return (
                    <li key={elementId} title={resisted?.name ?? elementId}>
                      {resisted && <img src={assetUrl(resisted.icon)} alt={resisted.name} />}
                      <span>{value} %</span>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section className="card-detail__section card-detail__lore">
              <h3>Lore</h3>
              <dl>
                <dt>Espèce</dt>
                <dd>{card.lore.species}</dd>
                <dt>Région</dt>
                <dd>{card.lore.region}</dd>
                <dt>Ère</dt>
                <dd>{card.lore.era}</dd>
              </dl>
              <p>{card.lore.text}</p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Éléments de frappe, de bonus et de soin, et capacités particulières (calculés à l'import). */
function Profile({ card }: { card: Card }) {
  const { catalog, assetUrl } = useCardEnvironment();
  const elementRows = [
    { label: 'Frappe', ids: card.traits.strikeElements },
    { label: 'Bonus', ids: card.traits.bonusElements },
    { label: 'Soin', ids: card.traits.healElements },
  ].filter((row) => row.ids.length > 0);
  const specials = card.traits.specialAbilities.flatMap((key) => {
    const special = catalog.specialAbilities.get(key);
    return special === undefined ? [] : [special];
  });
  if (elementRows.length === 0 && specials.length === 0) {
    return null;
  }

  return (
    <section className="card-detail__section">
      <h3>Profil</h3>
      {elementRows.length > 0 && (
        <dl className="card-detail__profile">
          {elementRows.map((row) => (
            <div key={row.label}>
              <dt>{row.label}</dt>
              <dd>
                {row.ids.map((id) => {
                  const element = catalog.elements.get(id);
                  return element === undefined ? null : (
                    <img key={id} src={assetUrl(element.icon)} alt={element.name} title={element.name} />
                  );
                })}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {specials.length > 0 && (
        <ul className="card-detail__specials">
          {specials.map((special) => (
            <li key={special.key} title={special.description ?? undefined}>
              <TraitIcon icon={special.icon} size={16} />
              {special.label}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Talents({ card }: { card: Card }) {
  const talents = [...card.talents].sort((a, b) => a.slot - b.slot);
  const [selected, setSelected] = useState(0);
  const talent = talents[selected] ?? talents[0];
  if (talent === undefined) {
    return null;
  }
  return (
    <section className="card-detail__section">
      <h3>Talents</h3>
      <div className="card-detail__tabs" role="tablist">
        {talents.map((candidate, index) => (
          <button
            key={candidate.slot}
            type="button"
            role="tab"
            aria-selected={candidate === talent}
            onClick={() => setSelected(index)}
          >
            {candidate.name}
          </button>
        ))}
      </div>
      <p role="tabpanel">
        <RichText source={talent.effectRich} />
      </p>
    </section>
  );
}

function AbilityBlock({ ability }: { ability: Ability }) {
  const stats = [
    { label: 'Précision', value: `${ability.precision} %` },
    { label: 'Critique', value: `${ability.critChance} % · ×${ability.critMultiplier}` },
    ability.duration > 0 && { label: 'Durée', value: `${ability.duration} tour(s)` },
    ability.uses > 0 && { label: 'Utilisations', value: String(ability.uses) },
    ability.cooldownResetChance > 0 && { label: 'Recharge annulée', value: `${ability.cooldownResetChance} %` },
  ].filter((stat) => stat !== false);

  return (
    <article className="card-detail__entry">
      <h4>
        {ability.name}
        <span className="card-detail__cooldown" title="Temps de recharge">
          {ability.cooldown}
        </span>
      </h4>
      <p>
        <RichText source={ability.effectRich} />
      </p>
      <dl className="card-detail__stats">
        {stats.map((stat) => (
          <div key={stat.label}>
            <dt>{stat.label}</dt>
            <dd>{stat.value}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

function Section({ title, empty, children }: { title: string; empty: string; children: ReactNode[] }) {
  return (
    <section className="card-detail__section">
      <h3>{title}</h3>
      {children.length > 0 ? children : <p className="card-detail__muted">{empty}</p>}
    </section>
  );
}
