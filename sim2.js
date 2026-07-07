function stringSimilarity(s1, s2) {
  if (!s1 || !s2) return 0;
  const str1 = s1.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, '');
  const str2 = s2.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, '');
  if (str1 === str2) return 1;
  const track = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
  for (let i = 0; i <= str1.length; i += 1) track[0][i] = i;
  for (let j = 0; j <= str2.length; j += 1) track[j][0] = j;
  for (let j = 1; j <= str2.length; j += 1) {
    for (let i = 1; i <= str1.length; i += 1) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      track[j][i] = Math.min(
        track[j][i - 1] + 1,
        track[j - 1][i] + 1,
        track[j - 1][i - 1] + indicator
      );
    }
  }
  const maxLen = Math.max(str1.length, str2.length);
  return (maxLen - track[str2.length][str1.length]) / maxLen;
}
console.log('Barbara:', stringSimilarity("Bárbara La Salvia Pontes Braga", "Bárbara La Salvia Pontes Braga"));
