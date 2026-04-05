export const DANGER_COLORS = {
  1: '#CCFF66',
  2: '#FFFF00',
  3: '#FF9900',
  4: '#FF0000',
  5: '#000000',
}

export const DANGER_LABELS = {
  1: 'Debole',
  2: 'Limitato',
  3: 'Marcato',
  4: 'Forte',
  5: 'Molto forte',
}

const AINEVA_START = { month: 12, day: 1 }
const AINEVA_END   = { month: 5,  day: 5 }

/** Returns true if today falls within the AINEVA active season (1 Dec – 5 May) */
export function isAinevaActive(date = new Date()) {
  const m = date.getMonth() + 1 // 1–12
  const d = date.getDate()
  if (m === 12 && d >= AINEVA_START.day) return true
  if (m < AINEVA_END.month) return true
  if (m === AINEVA_END.month && d <= AINEVA_END.day) return true
  return false
}

/**
 * Normalise an EAWS bulletin response to the shape the UI needs.
 * Returns null if data is unavailable.
 */
export function parseBulletin(data) {
  if (!data?.available || !data.bulletins?.length) return null
  const b = data.bulletins[0]

  // Highest danger rating across all elevations
  const maxDanger = b.dangerRatings?.length ? Math.max(...b.dangerRatings.map(r => r.mainValue)) : 0

  // Above/below treeline ratings
  const above = b.dangerRatings.find(r => r.elevation?.lowerBound) ?? null
  const below = b.dangerRatings.find(r => r.elevation?.upperBound) ?? null

  return {
    id: b.bulletinID,
    validTime: b.validTime,
    regions: b.regions,
    maxDanger,
    dangerAbove: above?.mainValue ?? maxDanger,
    dangerBelow: below?.mainValue ?? maxDanger,
    problems: b.avalancheProblems ?? [],
    highlights: b.highlights ?? '',
    comment: b.comment ?? '',
  }
}
