import type { CSSProperties, MouseEvent, ReactNode } from 'react';
import type { Ability, Card, Skill } from '../../domain/Card.ts';
import { fillTemplate, type Box, type CenteredText, type ImageLayer } from '../../domain/CardLayout.ts';
import { ArtistCredit } from './ArtistCredit.tsx';
import { useCardDetail } from './CardDetailContext.tsx';
import { useCardEnvironment } from './CardEnvironment.tsx';
import './GameCard.css';

export interface GameCardProps {
  readonly card: Card;
  /** Largeur affichée en pixels ; la carte est dessinée à sa taille d'origine puis mise à l'échelle. */
  readonly width: number;
  /** Illustration en haute définition (vue détail) plutôt qu'en taille réduite (galerie). */
  readonly highDefinition?: boolean;
  /** Crédit de l'artiste sous la carte (obligatoire là où l'illustration n'est pas déjà créditée). */
  readonly showCredit?: boolean;
  /** Clic gauche (ou Entrée) : action propre à l'outil qui affiche la carte (ex. l'ajouter à un deck). */
  readonly onSelect?: ((card: Card) => void) | undefined;
  /** Mise en évidence (ex. carte présente dans le deck). */
  readonly selected?: boolean;
}

/**
 * Une carte du jeu, dessinée d'après le plan de rendu publié par le jeu.
 * Clic droit (ou touche Menu) : ouvre la vue détail, si elle est disponible.
 * Clic gauche (ou Entrée) : `onSelect`, si l'outil en fournit un.
 */
export function GameCard({
  card,
  width,
  highDefinition = false,
  showCredit = true,
  onSelect,
  selected = false,
}: GameCardProps) {
  const { layout, assetUrl } = useCardEnvironment();
  const detail = useCardDetail();
  const scale = width / layout.width;
  // La gemme de rareté déborde sous la carte : le crédit se place en dessous.
  const gemOverflow = Math.max(0, layout.rarityGem.y + layout.rarityGem.height - layout.height) * scale;
  const values = { element: card.element, rarity: card.rarity };

  const openDetail = (event: MouseEvent) => {
    if (detail === null) {
      return;
    }
    event.preventDefault();
    detail.open(card);
  };

  return (
    <figure className="game-card" style={{ width }}>
      <div
        className="game-card__frame"
        style={{ width, height: layout.height * scale }}
        tabIndex={0}
        role={onSelect === undefined ? undefined : 'button'}
        aria-label={card.name}
        aria-pressed={onSelect === undefined ? undefined : selected}
        data-selected={selected ? '' : undefined}
        data-selectable={onSelect === undefined ? undefined : ''}
        title={detail === null ? card.name : `${card.name} — clic droit pour le détail`}
        onContextMenu={openDetail}
        onClick={onSelect === undefined ? undefined : () => onSelect(card)}
        onKeyDown={
          onSelect === undefined
            ? undefined
            : (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelect(card);
                }
              }
        }
      >
        <div
          className="game-card__face"
          style={{
            width: layout.width,
            height: layout.height,
            transform: `scale(${scale})`,
            fontFamily: `'${layout.font.family}', sans-serif`,
          }}
        >
          <div className="game-card__clip" style={{ borderRadius: layout.cornerRadius }}>
            <img
              className="game-card__artwork"
              style={position(layout.artwork)}
              src={assetUrl(highDefinition ? card.artwork.file : card.artwork.small)}
              alt=""
              draggable={false}
            />
            <Layer layer={layout.body} src={assetUrl(fillTemplate(layout.body.image, values))} />
            <div
              className="game-card__header"
              style={{
                ...position(layout.header),
                background: `linear-gradient(${layout.header.gradient[0]}, ${layout.header.gradient[1]})`,
              }}
            />
            <div
              className="game-card__name"
              style={{
                left: layout.name.x,
                top: layout.name.y,
                width: layout.name.width,
                fontSize: layout.name.fontSize,
                lineHeight: layout.name.lineHeight,
                WebkitLineClamp: layout.name.maxLines,
                color: layout.name.color,
                textTransform: layout.name.uppercase ? 'uppercase' : undefined,
                textShadow: layout.name.shadow,
              }}
            >
              {card.name}
            </div>
            <CardRows card={card} />
            <div
              className="game-card__hp"
              style={{
                ...position(layout.hpBar),
                borderRadius: layout.hpBar.radius,
                background: layout.hpBar.color,
                fontSize: layout.hpBar.text.fontSize,
                color: layout.hpBar.text.color,
              }}
            >
              {fillTemplate(layout.hpBar.text.format, { hp: String(card.hp) })}
            </div>
            <div
              className="game-card__border"
              style={{
                borderRadius: layout.border.radius,
                boxShadow: `inset 0 0 0 ${layout.border.width}px ${layout.border.color}`,
              }}
            />
          </div>
          <Layer layer={layout.rarityGem} src={assetUrl(fillTemplate(layout.rarityGem.image, values))} />
          <Layer layer={layout.elementOrb} src={assetUrl(fillTemplate(layout.elementOrb.image, values))} />
          <Layer layer={layout.spamton} src={assetUrl(layout.spamton.image)} />
          <CenteredLabel text={layout.spamton.text}>{card.spamton}</CenteredLabel>
        </div>
      </div>
      {showCredit && (
        <figcaption className="game-card__credit" style={{ marginTop: gemOverflow }}>
          <ArtistCredit artist={card.artwork.artist} />
        </figcaption>
      )}
    </figure>
  );
}

/** Une ligne par capacité, puis par tox, dans la limite prévue par le plan. */
function CardRows({ card }: { card: Card }) {
  const { rows } = useCardEnvironment().layout;
  const entries: ({ kind: 'ability'; ability: Ability } | { kind: 'skill'; skill: Skill })[] = [
    ...card.abilities.map((ability) => ({ kind: 'ability' as const, ability })),
    ...card.skills.map((skill) => ({ kind: 'skill' as const, skill })),
  ].slice(0, rows.max);

  return entries.map((entry, index) => (
    <div
      key={index}
      className="game-card__row"
      style={{ left: rows.x, top: rows.top + index * rows.step, width: rows.width, height: rows.height }}
    >
      {entry.kind === 'ability' ? <AbilityRow ability={entry.ability} /> : <SkillRow skill={entry.skill} />}
    </div>
  ));
}

function AbilityRow({ ability }: { ability: Ability }) {
  const { layout, assetUrl } = useCardEnvironment();
  const row = layout.rows.ability;
  return (
    <>
      <Layer
        layer={row.bar}
        src={assetUrl(row.bar.image)}
        style={{ filter: row.bar.filter, opacity: row.bar.opacity }}
      />
      <Layer
        layer={row.cooldown}
        src={assetUrl(row.cooldown.image)}
        style={{ mixBlendMode: row.cooldown.blend as CSSProperties['mixBlendMode'] }}
      />
      <CenteredLabel text={row.cooldownText}>{ability.cooldown}</CenteredLabel>
      <CenteredLabel text={row.name}>{ability.name}</CenteredLabel>
    </>
  );
}

function SkillRow({ skill }: { skill: Skill }) {
  const { layout, assetUrl } = useCardEnvironment();
  const row = layout.rows.skill;
  // La même image de ligne est coupée en deux : moitié gauche à gauche, moitié droite à droite.
  // Une variante absente (ex. rareté non publiée par le jeu) laisse simplement la ligne vide.
  const halfOf = (side: 'left' | 'right'): CSSProperties => ({
    backgroundImage: `url("${assetUrl(fillTemplate(row.lineLeft.image, { rarity: skill.rarity }))}")`,
    backgroundSize: '200% 100%',
    backgroundPosition: side,
  });
  return (
    <>
      <div className="game-card__layer" style={{ ...position(row.lineLeft), ...halfOf('left') }} />
      <div className="game-card__layer" style={{ ...position(row.lineRight), ...halfOf('right') }} />
      <CenteredLabel text={row.name}>{skill.name}</CenteredLabel>
    </>
  );
}

function Layer({ layer, src, style }: { layer: ImageLayer; src: string; style?: CSSProperties }) {
  return (
    <img
      className="game-card__layer"
      style={{ ...position(layer), ...style }}
      src={src}
      alt=""
      draggable={false}
      onError={(event) => {
        event.currentTarget.style.visibility = 'hidden';
      }}
    />
  );
}

/** Texte centré verticalement sur `centerY`, et horizontalement sur `centerX` ou dans [x, x + width]. */
function CenteredLabel({ text, children }: { text: CenteredText; children: ReactNode }) {
  const horizontal: CSSProperties =
    text.centerX === undefined
      ? { left: text.x, width: text.width, justifyContent: 'center' }
      : { left: text.centerX, transform: 'translate(-50%, -50%)' };
  return (
    <div
      className="game-card__label"
      style={{
        top: text.centerY,
        transform: 'translateY(-50%)',
        fontSize: text.fontSize,
        color: text.color,
        textTransform: text.uppercase ? 'uppercase' : undefined,
        ...horizontal,
      }}
    >
      {children}
    </div>
  );
}

function position(box: Box): CSSProperties {
  return { left: box.x, top: box.y, width: box.width, height: box.height };
}
