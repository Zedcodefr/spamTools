import {
  Activity, Anchor, ArrowLeftRight, Atom, Axe, Banknote, BatteryCharging, BicepsFlexed, Biohazard, Bird, Bomb,
  ChevronsUp, CircleDollarSign, Clover, CloudFog, Coins, CopyPlus, Crosshair, Dices, Droplets, Egg, Expand, Eye, EyeOff, Flame,
  Gem, Ghost, Gift, Hash, Heart, HeartHandshake, HeartPulse, Hourglass, Infinity as InfinityIcon, Leaf, Lock, Magnet,
  Megaphone, Mountain, Orbit, Percent, PiggyBank, Puzzle, Radar, Receipt, RefreshCcw, RefreshCw, Repeat, Repeat2,
  RotateCcw, Shield, ShieldBan, ShieldCheck, ShieldHalf, ShieldPlus, Shuffle, Skull, Snowflake, Sparkles, Split, Sword,
  Swords, Target, Timer, TimerReset, TrendingUp, Undo2, WandSparkles, Zap, type LucideIcon,
} from 'lucide-react';
import type { TraitIcon as TraitIconData } from '../../domain/Catalog.ts';
import { useCardEnvironment } from './CardEnvironment.tsx';

/**
 * Symboles génériques (Lucide) utilisés par la taxonomie des capacités côté serveur.
 * Un nom absent de la liste s'affiche avec l'icône par défaut.
 */
const SYMBOLS: Readonly<Record<string, LucideIcon>> = {
  Activity, Anchor, ArrowLeftRight, Atom, Axe, Banknote, BatteryCharging, BicepsFlexed, Biohazard, Bird, Bomb,
  ChevronsUp, CircleDollarSign, Clover, CloudFog, Coins, CopyPlus, Crosshair, Dices, Droplets, Egg, Expand, Eye, EyeOff, Flame,
  Gem, Ghost, Gift, Hash, Heart, HeartHandshake, HeartPulse, Hourglass, Infinity: InfinityIcon, Leaf, Lock, Magnet,
  Megaphone, Mountain, Orbit, Percent, PiggyBank, Puzzle, Radar, Receipt, RefreshCcw, RefreshCw, Repeat, Repeat2,
  RotateCcw, Shield, ShieldBan, ShieldCheck, ShieldHalf, ShieldPlus, Shuffle, Skull, Snowflake, Sparkles, Split,
  Sword, Swords, Target, Timer, TimerReset, TrendingUp, Undo2, WandSparkles, Zap,
};

/** Icône d'une capacité ou catégorie : image officielle du jeu, sinon symbole générique. */
export function TraitIcon({ icon, size = 18 }: { icon: TraitIconData; size?: number }) {
  const { assetUrl } = useCardEnvironment();
  if (icon.type === 'asset') {
    return <img className="trait-icon" src={assetUrl(icon.path)} alt="" width={size} height={size} />;
  }
  const Symbol = SYMBOLS[icon.name] ?? Sparkles;
  return <Symbol className="trait-icon" size={size} aria-hidden="true" />;
}
