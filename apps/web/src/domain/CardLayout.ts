/**
 * Plan de rendu d'une carte publié par le jeu (/api/card-layout) : positions en pixels
 * sur une carte de `width` x `height`, à mettre à l'échelle de la taille affichée.
 * Les chemins d'images contiennent `{element}` / `{rarity}` à remplacer.
 */

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface ImageLayer extends Box {
  readonly image: string;
}

export interface CenteredText {
  readonly centerX?: number;
  readonly centerY: number;
  readonly x?: number;
  readonly width?: number;
  readonly fontSize: number;
  readonly color: string;
  readonly uppercase?: boolean;
}

export interface CardLayout {
  readonly width: number;
  readonly height: number;
  readonly cornerRadius: number;
  readonly font: { readonly family: string };
  readonly artwork: Box;
  readonly body: ImageLayer;
  readonly header: Box & { readonly gradient: readonly [string, string] };
  readonly name: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly fontSize: number;
    readonly lineHeight: number;
    readonly maxLines: number;
    readonly color: string;
    readonly uppercase: boolean;
    readonly shadow: string;
  };
  readonly rows: {
    readonly x: number;
    readonly width: number;
    readonly height: number;
    readonly top: number;
    readonly step: number;
    readonly max: number;
    readonly ability: {
      readonly bar: ImageLayer & { readonly filter?: string; readonly opacity?: number };
      readonly cooldown: ImageLayer & { readonly blend?: string };
      readonly cooldownText: CenteredText;
      readonly name: CenteredText;
    };
    readonly skill: {
      readonly lineLeft: ImageLayer;
      readonly lineRight: ImageLayer;
      readonly name: CenteredText;
    };
  };
  readonly hpBar: Box & {
    readonly radius: number;
    readonly color: string;
    readonly text: { readonly format: string; readonly fontSize: number; readonly color: string };
  };
  readonly border: { readonly width: number; readonly color: string; readonly radius: number };
  readonly rarityGem: ImageLayer;
  readonly elementOrb: ImageLayer;
  readonly spamton: ImageLayer & { readonly text: CenteredText };
}

export function fillTemplate(template: string, values: Readonly<Record<string, string>>): string {
  return template.replace(/\{(\w+)\}/g, (token, key: string) => values[key] ?? token);
}
