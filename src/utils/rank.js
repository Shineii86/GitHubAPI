export function getRankDetails(score) {
  const level = Math.floor(score);
  if (level >= 100) return { name: 'GODLIKE', level };
  if (level >= 90) return { name: 'MYTHIC', level };
  if (level >= 80) return { name: 'LEGEND', level };
  if (level >= 70) return { name: 'GRANDMASTER', level };
  if (level >= 60) return { name: 'MASTER', level };
  if (level >= 50) return { name: 'ELITE', level };
  if (level >= 40) return { name: 'EXPERT', level };
  if (level >= 30) return { name: 'DEVELOPER', level };
  if (level >= 20) return { name: 'APPRENTICE', level };
  if (level >= 10) return { name: 'NOVICE', level };
  return { name: 'BEGINNER', level };
}

export function getRankName(score) {
  return getRankDetails(score).name;
}

export function getRankWithBullet(score) {
  const { name, level } = getRankDetails(score);
  return `${name} • LV${level}`;
}
