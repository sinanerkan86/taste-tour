import { ADS, CHEFS, LAB, OFFLINE, PERK, type ChefId, type PerkId, type ResearchId } from '../../core/economy';
import { t, tDurationShort, type TranslationKey } from '../../i18n';

// Player-facing texts for Kitchen Lab research and franchise perks.

export function researchName(id: ResearchId): string {
  return t(`research.${id}` as TranslationKey);
}

// What a research project gives at `level` (level 0 shows the base value where that makes sense).
export function researchEffect(id: ResearchId, level: number): string {
  const key = `research.effect.${id}` as TranslationKey;
  switch (id) {
    case 'spices':
      return t(key, { value: Math.round(level * LAB.spicesIncome * 100) });
    case 'suppliers':
      return t(key, { value: Math.round((1 - (1 - LAB.suppliersDiscount) ** level) * 100) });
    case 'nightShift':
      return t(key, { value: tDurationShort(OFFLINE.baseCapSeconds + level * LAB.nightShiftSeconds) });
    case 'tourGuide':
      return t(key, { value: Math.round(level * LAB.tourGuideTip * 100) });
    case 'eventPlanner':
      return t(key, { value: tDurationShort(ADS.rushSeconds + level * LAB.eventPlannerSeconds) });
  }
}

export function perkName(id: PerkId): string {
  return t(`perk.${id}.name` as TranslationKey);
}

// What the perk does once it reaches `level`.
export function perkDescription(id: PerkId, level: number): string {
  const key = `perk.${id}.desc` as TranslationKey;
  switch (id) {
    case 'manager':
      return t(key, { value: Math.round(PERK.managerDiscount * 100) });
    case 'headStart':
      return t(key, { value: PERK.headStartLevels[Math.min(level, PERK.headStartLevels.length) - 1] ?? 1 });
    case 'chain':
      return t(key, { value: Math.round(level * PERK.chainIncome * 100) });
    case 'brand':
      return t(key, { value: Math.round(level * PERK.brandStars * 100) });
    case 'grant':
      return t(key, { value: Math.round(level * PERK.grantSpeed * 100) });
    default:
      return t(key);
  }
}

export function chefName(id: ChefId): string {
  return t(`chef.${id}` as TranslationKey);
}

// What a chef's skill gives at `level` (seconds for offline and Rush, percent for the rest).
export function chefSkillText(id: ChefId, level: number): string {
  const { skill, perLevel } = CHEFS[id];
  const amount = level * perLevel;
  const value = skill === 'offline' || skill === 'rush' ? tDurationShort(amount) : `${Math.round(amount * 100)}%`;
  return t(`chef.skill.${skill}` as TranslationKey, { value });
}
