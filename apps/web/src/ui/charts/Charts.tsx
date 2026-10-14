import { useState, type ReactNode } from 'react';
import './Charts.css';

/**
 * Graphiques SVG sans dépendance, selon des règles fixes : marques fines (barres ≤ 12 px,
 * bout arrondi de 4 px côté valeur, lignes de 2 px), grille et axes discrets, légende dès
 * 2 séries, étiquettes sélectives (extrêmes, fin de courbe), infobulle au survol et au focus.
 * Couleurs : --chart-series-1 / -2 (validées contre le fond), --chart-muted pour atténuer.
 * Le texte ne prend jamais la couleur d'une série.
 */

export interface ChartSeries {
  readonly key: string;
  readonly label: string;
  /** Couleur de la marque (variable CSS). */
  readonly color: string;
}

export interface ChartCategory {
  readonly key: string;
  readonly label: string;
  readonly icon?: string | undefined;
}

type Format = (value: number) => string;

const WIDTH = 460;
const LABEL_WIDTH = 92;
const VALUE_GUTTER = 44;

/** Légende : clé rectangulaire pour les barres, trait pour les courbes. */
export function Legend({ series, kind }: { series: readonly ChartSeries[]; kind: 'bar' | 'line' }) {
  if (series.length < 2) {
    return null;
  }
  return (
    <ul className="chart-legend">
      {series.map((entry) => (
        <li key={entry.key}>
          <span className={`chart-legend__key chart-legend__key--${kind}`} style={{ background: entry.color }} />
          {entry.label}
        </li>
      ))}
    </ul>
  );
}

interface Tooltip {
  readonly x: number;
  readonly y: number;
  readonly title: string;
  readonly rows: readonly { readonly label: string; readonly value: string; readonly color: string }[];
}

function TooltipView({ tooltip }: { tooltip: Tooltip | null }) {
  if (tooltip === null) {
    return null;
  }
  return (
    <div
      className="chart-tooltip"
      role="status"
      style={{ left: `${(tooltip.x / WIDTH) * 100}%`, top: tooltip.y }}
    >
      <p className="chart-tooltip__title">{tooltip.title}</p>
      {tooltip.rows.map((row) => (
        <p key={row.label} className="chart-tooltip__row">
          <span className="chart-tooltip__key" style={{ background: row.color }} />
          <strong>{row.value}</strong> {row.label}
        </p>
      ))}
    </div>
  );
}

/** Barre horizontale : 4 px arrondis côté valeur, carrée côté ligne de base. */
function barPath(x0: number, x1: number, y: number, height: number): string {
  const radius = Math.min(4, Math.abs(x1 - x0), height / 2);
  if (x1 >= x0) {
    return `M${x0},${y} H${x1 - radius} Q${x1},${y} ${x1},${y + radius} V${y + height - radius} Q${x1},${y + height} ${
      x1 - radius
    },${y + height} H${x0} Z`;
  }
  return `M${x0},${y} H${x1 + radius} Q${x1},${y} ${x1},${y + radius} V${y + height - radius} Q${x1},${y + height} ${
    x1 + radius
  },${y + height} H${x0} Z`;
}

interface BarChartProps {
  readonly categories: readonly ChartCategory[];
  readonly series: readonly ChartSeries[];
  readonly value: (category: string, series: string) => number;
  readonly format: Format;
  /** Mise en évidence : la catégorie garde la couleur de la série, les autres passent en gris. */
  readonly emphasis?: (category: string) => boolean;
  /** Libellé de la catégorie mise en évidence, affiché à côté de sa valeur. */
  readonly emphasisLabel?: string;
  /** Largeur de la colonne des libellés (les libellés trop longs sont raccourcis, complets au survol). */
  readonly labelWidth?: number;
}

/**
 * Barres horizontales groupées (une barre par série dans chaque catégorie). Gère les valeurs
 * négatives (ligne de base à 0). Étiquettes : la valeur la plus haute et la plus basse ;
 * le reste au survol (et dans le tableau de données).
 */
export function BarChart({
  categories,
  series,
  value,
  format,
  emphasis,
  emphasisLabel,
  labelWidth = LABEL_WIDTH,
}: BarChartProps) {
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);
  const barHeight = series.length > 1 ? 10 : 12;
  const gap = 2;
  const band = series.length * (barHeight + gap) + 12;
  const height = categories.length * band + 8;
  const values = categories.flatMap((category) => series.map((entry) => value(category.key, entry.key)));
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const span = max - min || 1;
  const plotLeft = labelWidth;
  const plotWidth = WIDTH - labelWidth - VALUE_GUTTER;
  const xOf = (number: number) => plotLeft + ((number - min) / span) * plotWidth;
  // Étiquettes sélectives : la première barre la plus haute et la première la plus basse.
  const labelled = new Set([values.indexOf(Math.max(...values)), values.indexOf(Math.min(...values))]);

  return (
    <div className="chart">
      <Legend series={series} kind="bar" />
      <div className="chart__frame">
        <svg viewBox={`0 0 ${WIDTH} ${height}`} role="img" aria-hidden="true" className="chart__svg">
          <line className="chart__baseline" x1={xOf(0)} x2={xOf(0)} y1={0} y2={height} />
          {categories.map((category, row) => {
            const top = row * band + 6;
            return (
              <g key={category.key}>
                {category.icon && <image href={category.icon} x={0} y={top + band / 2 - 15} width={14} height={14} />}
                <text className="chart__label" x={category.icon ? 18 : 0} y={top + band / 2 - 4}>
                  {truncate(category.label, labelWidth - (category.icon ? 22 : 4))}
                </text>
                {series.map((entry, index) => {
                  const number = value(category.key, entry.key);
                  const y = top + index * (barHeight + gap);
                  const muted = emphasis !== undefined && !emphasis(category.key);
                  const end = xOf(number);
                  const show = tooltipFor(category, row, index);
                  const emphasised = emphasis?.(category.key) ?? false;
                  const labelText = `${format(number)}${emphasised && emphasisLabel ? ` · ${emphasisLabel}` : ''}`;
                  return (
                    <g
                      key={entry.key}
                      className="chart__bar"
                      tabIndex={0}
                      onPointerEnter={show}
                      onFocus={show}
                      onPointerLeave={() => setTooltip(null)}
                      onBlur={() => setTooltip(null)}
                    >
                      {/* Zone de survol plus large que la barre. */}
                      <rect x={plotLeft} y={y - 1} width={plotWidth} height={barHeight + 2} fill="transparent" />
                      {number !== 0 && (
                        <path
                          d={barPath(xOf(0), end, y, barHeight)}
                          fill={muted ? 'var(--chart-muted)' : entry.color}
                        />
                      )}
                      {(labelled.has(row * series.length + index) || emphasised) && number !== 0 && (
                        // Une valeur négative s'étiquette à droite de la ligne de base, jamais sur les libellés.
                        <text className="chart__value" x={(number >= 0 ? end : xOf(0)) + 4} y={y + barHeight - 2}>
                          {labelText}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            );
          })}
        </svg>
        <TooltipView tooltip={tooltip} />
      </div>
    </div>
  );

  function tooltipFor(category: ChartCategory, row: number, index: number) {
    return () =>
      setTooltip({
        x: WIDTH / 2,
        y: row * band + 6 + index * (barHeight + gap) + barHeight + 6,
        title: category.label,
        rows: series.map((entry) => ({
          label: entry.label,
          value: format(value(category.key, entry.key)),
          color: emphasis !== undefined && !emphasis(category.key) ? 'var(--chart-muted)' : entry.color,
        })),
      });
  }
}

interface LineChartProps {
  /** Valeurs en abscisse (ex. tours 0..N). */
  readonly xs: readonly number[];
  readonly xLabel: (x: number) => string;
  readonly series: readonly (ChartSeries & { readonly values: readonly number[] })[];
  readonly format: Format;
  readonly height?: number;
  /** Échelle commune à plusieurs petits graphiques. */
  readonly maxY?: number;
  readonly compact?: boolean;
  readonly title?: ReactNode;
}

/**
 * Courbes (lignes de 2 px), réticule vertical qui se cale sur l'abscisse la plus proche et
 * infobulle listant toutes les séries ; valeur affichée en fin de courbe.
 */
export function LineChart({ xs, xLabel, series, format, height = 180, maxY, compact = false, title }: LineChartProps) {
  const [hover, setHover] = useState<number | null>(null);
  const width = compact ? 150 : WIDTH;
  const padding = compact
    ? { left: 6, right: 6, top: 8, bottom: 16 }
    : { left: 36, right: VALUE_GUTTER + 4, top: 10, bottom: 22 };
  const top = Math.max(maxY ?? 0, ...series.flatMap((entry) => entry.values), 1);
  const yMax = niceCeil(top);
  const xMin = xs[0] ?? 0;
  const xMax = xs.at(-1) ?? 1;
  const xOf = (x: number) => padding.left + ((x - xMin) / (xMax - xMin || 1)) * (width - padding.left - padding.right);
  const yOf = (y: number) => padding.top + (1 - y / yMax) * (height - padding.top - padding.bottom);
  const ticks = compact ? [] : [0, yMax / 2, yMax];

  const pick = (clientX: number, rect: DOMRect) => {
    const x = ((clientX - rect.left) / rect.width) * width;
    let nearest = 0;
    xs.forEach((value, index) => {
      if (Math.abs(xOf(value) - x) < Math.abs(xOf(xs[nearest] ?? 0) - x)) {
        nearest = index;
      }
    });
    setHover(nearest);
  };

  return (
    <div className={compact ? 'chart chart--compact' : 'chart'}>
      {title}
      {!compact && <Legend series={series} kind="line" />}
      <div className="chart__frame">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="chart__svg"
          role="img"
          aria-hidden="true"
          tabIndex={0}
          onPointerMove={(event) => pick(event.clientX, event.currentTarget.getBoundingClientRect())}
          onPointerLeave={() => setHover(null)}
          onFocus={() => setHover(xs.length - 1)}
          onBlur={() => setHover(null)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
              const step = event.key === 'ArrowLeft' ? -1 : 1;
              setHover((current) => Math.min(xs.length - 1, Math.max(0, (current ?? xs.length - 1) + step)));
            }
          }}
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line className="chart__grid" x1={padding.left} x2={width - padding.right} y1={yOf(tick)} y2={yOf(tick)} />
              <text className="chart__tick" x={padding.left - 4} y={yOf(tick) + 3} textAnchor="end">
                {format(tick)}
              </text>
            </g>
          ))}
          <line className="chart__baseline" x1={padding.left} x2={width - padding.right} y1={yOf(0)} y2={yOf(0)} />
          {xs.map((x, index) =>
            compact ? null : index === 0 || index === xs.length - 1 || x % 5 === 0 ? (
              <text key={x} className="chart__tick" x={xOf(x)} y={height - 6} textAnchor="middle">
                {xLabel(x)}
              </text>
            ) : null,
          )}
          {hover !== null && (
            <line className="chart__crosshair" x1={xOf(xs[hover] ?? 0)} x2={xOf(xs[hover] ?? 0)} y1={padding.top} y2={yOf(0)} />
          )}
          {series.map((entry) => {
            const points = entry.values.map((value, index) => `${xOf(xs[index] ?? 0)},${yOf(value)}`).join(' ');
            const last = entry.values.at(-1) ?? 0;
            return (
              <g key={entry.key}>
                <polyline points={points} fill="none" stroke={entry.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                {hover !== null && (
                  <circle
                    cx={xOf(xs[hover] ?? 0)}
                    cy={yOf(entry.values[hover] ?? 0)}
                    r={4}
                    fill={entry.color}
                    stroke="var(--chart-surface)"
                    strokeWidth={2}
                  />
                )}
                {!compact && (
                  <text className="chart__value" x={xOf(xMax) + 6} y={yOf(last) + 3}>
                    {format(last)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        {hover !== null && (
          <TooltipView
            tooltip={{
              x: Math.min(xOf(xs[hover] ?? 0) * (WIDTH / width), WIDTH - 80),
              y: 4,
              title: xLabel(xs[hover] ?? 0),
              rows: series.map((entry) => ({
                label: entry.label,
                value: format(entry.values[hover] ?? 0),
                color: entry.color,
              })),
            }}
          />
        )}
      </div>
    </div>
  );
}

interface ComboChartProps {
  /** Abscisses : 0 (départ) puis 1..N. */
  readonly xs: readonly number[];
  readonly xLabel: (x: number) => string;
  /** Une mesure : valeur à chaque abscisse (barre), et son cumul (courbe) calculé ici. */
  readonly series: readonly (ChartSeries & { readonly values: readonly number[] })[];
  /**
   * Scénario alternatif (borne haute) d'une mesure : son cumul en pointillés, même couleur.
   * `of` : clé de la série de référence.
   */
  readonly upperBounds?: readonly { readonly of: string; readonly label: string; readonly values: readonly number[] }[];
  readonly format: Format;
  readonly height?: number;
}

/**
 * Barres + courbe sur un seul axe (même unité) : la barre montre la valeur de chaque abscisse
 * (ce tour précis), la courbe son cumul depuis le départ (0). Une couleur par mesure, partagée
 * par sa barre et sa courbe ; survol d'une abscisse entière.
 */
export function ComboChart({ xs, xLabel, series, upperBounds = [], format, height = 200 }: ComboChartProps) {
  const [hover, setHover] = useState<number | null>(null);
  const padding = { left: 36, right: VALUE_GUTTER + 4, top: 12, bottom: 22 };
  const plotWidth = WIDTH - padding.left - padding.right;
  const step = plotWidth / Math.max(1, xs.length - 1);
  const gap = 2;
  const barWidth = Math.max(2, Math.min(10, (step * 0.7 - gap * (series.length - 1)) / series.length));
  const accumulate = (values: readonly number[]) => {
    let total = 0;
    return values.map((value) => (total += value));
  };
  const cumulative = series.map((entry) => accumulate(entry.values));
  const upper = upperBounds.map((bound) => ({
    ...bound,
    color: series.find((entry) => entry.key === bound.of)?.color ?? 'var(--chart-muted)',
    cumulative: accumulate(bound.values),
  }));
  const yMax = niceCeil(
    Math.max(1, ...cumulative.flat(), ...upper.flatMap((bound) => bound.cumulative), ...series.flatMap((entry) => entry.values)),
  );
  const xOf = (index: number) => padding.left + index * step;
  const yOf = (y: number) => padding.top + (1 - y / yMax) * (height - padding.top - padding.bottom);
  const baseline = yOf(0);

  return (
    <div className="chart">
      <ul className="chart-legend">
        {series.map((entry) => (
          <li key={entry.key}>
            <span className="chart-legend__key chart-legend__key--bar" style={{ background: entry.color }} />
            <span className="chart-legend__key chart-legend__key--line" style={{ background: entry.color }} />
            {entry.label}
          </li>
        ))}
        {upper.map((bound) => (
          <li key={bound.label}>
            <span className="chart-legend__key chart-legend__key--dashed" style={{ borderColor: bound.color }} />
            {bound.label}
          </li>
        ))}
        <li className="chart-legend__note">barre : ce tour · courbe : cumul</li>
      </ul>
      <div className="chart__frame">
        <svg
          viewBox={`0 0 ${WIDTH} ${height}`}
          className="chart__svg"
          role="img"
          aria-hidden="true"
          tabIndex={0}
          onPointerMove={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            const x = ((event.clientX - rect.left) / rect.width) * WIDTH;
            setHover(Math.min(xs.length - 1, Math.max(0, Math.round((x - padding.left) / step))));
          }}
          onPointerLeave={() => setHover(null)}
          onFocus={() => setHover(xs.length - 1)}
          onBlur={() => setHover(null)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
              const delta = event.key === 'ArrowLeft' ? -1 : 1;
              setHover((current) => Math.min(xs.length - 1, Math.max(0, (current ?? xs.length - 1) + delta)));
            }
          }}
        >
          {[0, yMax / 2, yMax].map((tick) => (
            <g key={tick}>
              <line className="chart__grid" x1={padding.left} x2={WIDTH - padding.right} y1={yOf(tick)} y2={yOf(tick)} />
              <text className="chart__tick" x={padding.left - 4} y={yOf(tick) + 3} textAnchor="end">
                {format(tick)}
              </text>
            </g>
          ))}
          <line className="chart__baseline" x1={padding.left} x2={WIDTH - padding.right} y1={baseline} y2={baseline} />
          {hover !== null && (
            <line className="chart__crosshair" x1={xOf(hover)} x2={xOf(hover)} y1={padding.top} y2={baseline} />
          )}
          {xs.map((x, index) => {
            const groupWidth = series.length * barWidth + (series.length - 1) * gap;
            return (
              <g key={x}>
                {series.map((entry, position) => {
                  const value = entry.values[index] ?? 0;
                  if (value <= 0) {
                    return null;
                  }
                  const left = xOf(index) - groupWidth / 2 + position * (barWidth + gap);
                  const top = yOf(value);
                  const radius = Math.min(4, barWidth / 2, baseline - top);
                  return (
                    <path
                      key={entry.key}
                      fill={entry.color}
                      opacity={hover === null || hover === index ? 0.85 : 0.5}
                      d={`M${left},${baseline} V${top + radius} Q${left},${top} ${left + radius},${top} H${
                        left + barWidth - radius
                      } Q${left + barWidth},${top} ${left + barWidth},${top + radius} V${baseline} Z`}
                    />
                  );
                })}
                {(index === 0 || index === xs.length - 1 || x % 5 === 0) && (
                  <text className="chart__tick" x={xOf(index)} y={height - 6} textAnchor="middle">
                    {xLabel(x)}
                  </text>
                )}
              </g>
            );
          })}
          {upper.map((bound) => (
            <g key={bound.label}>
              <polyline
                points={bound.cumulative.map((value, index) => `${xOf(index)},${yOf(value)}`).join(' ')}
                fill="none"
                stroke={bound.color}
                strokeWidth={2}
                strokeDasharray="5 4"
                strokeLinecap="round"
              />
              <text className="chart__value" x={xOf(xs.length - 1) + 6} y={yOf(bound.cumulative.at(-1) ?? 0) + 3}>
                {format(bound.cumulative.at(-1) ?? 0)}
              </text>
            </g>
          ))}
          {series.map((entry, position) => {
            const values = cumulative[position] ?? [];
            const points = values.map((value, index) => `${xOf(index)},${yOf(value)}`).join(' ');
            return (
              <g key={entry.key}>
                <polyline
                  points={points}
                  fill="none"
                  stroke={entry.color}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {hover !== null && (
                  <circle
                    cx={xOf(hover)}
                    cy={yOf(values[hover] ?? 0)}
                    r={4}
                    fill={entry.color}
                    stroke="var(--chart-surface)"
                    strokeWidth={2}
                  />
                )}
                <text className="chart__value" x={xOf(xs.length - 1) + 6} y={yOf(values.at(-1) ?? 0) + 3}>
                  {format(values.at(-1) ?? 0)}
                </text>
              </g>
            );
          })}
        </svg>
        {hover !== null && (
          <TooltipView
            tooltip={{
              x: Math.min(Math.max(xOf(hover), 80), WIDTH - 80),
              y: 4,
              title: xLabel(xs[hover] ?? 0),
              rows: [
                ...series.flatMap((entry, position) => [
                  { label: `${entry.label} ce tour`, value: format(entry.values[hover] ?? 0), color: entry.color },
                  {
                    label: `${entry.label} cumulés`,
                    value: format(cumulative[position]?.[hover] ?? 0),
                    color: entry.color,
                  },
                ]),
                ...upper.flatMap((bound) => [
                  { label: `${bound.label} ce tour`, value: format(bound.values[hover] ?? 0), color: bound.color },
                  { label: `${bound.label} cumulés`, value: format(bound.cumulative[hover] ?? 0), color: bound.color },
                ]),
              ],
            }}
          />
        )}
      </div>
    </div>
  );
}

/** Raccourcit un libellé à la largeur disponible (estimation : ~6 px par caractère à 11 px). */
function truncate(label: string, width: number): string {
  const max = Math.max(4, Math.floor(width / 6));
  return label.length <= max ? label : `${label.slice(0, max - 1).trimEnd()}…`;
}

/** Arrondi « propre » juste au-dessus de la valeur, pour des graduations lisibles sans trop de vide. */
function niceCeil(value: number): number {
  const power = 10 ** Math.floor(Math.log10(value));
  const step = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((candidate) => candidate * power >= value) ?? 10;
  return step * power;
}
