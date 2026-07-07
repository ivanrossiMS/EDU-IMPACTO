function stringSimilarity(s1, s2) {
  if (!s1 || !s2) return 0;
  s1 = s1.toLowerCase().trim();
  s2 = s2.toLowerCase().trim();
  
  if (s1 === s2) return 1.0;

  const m = s1.length, n = s2.length;
  if (m === 0) return n === 0 ? 1.0 : 0.0;
  if (n === 0) return 0.0;
  
  const d = [];
  for (let i = 0; i <= m; i++) d[i] = [i];
  for (let j = 0; j <= n; j++) d[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + cost
      );
    }
  }

  const distance = d[m][n];
  const maxLen = Math.max(m, n);
  return (maxLen - distance) / maxLen;
}

console.log(stringSimilarity("Arthur Luz Martins", "Arthur Luiz Martins"));
