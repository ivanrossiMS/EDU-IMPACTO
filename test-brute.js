function bruteForceRepair(str) {
  const suffixes = ['', ']', '}', '}]', ']}', ']}]', '}]}', '"]}', '"]}]', '""}]', '""}]}'];
  for (const suffix of suffixes) {
    try { return JSON.parse(str + suffix); } catch (e) {}
  }
  for (let i = str.length; i > Math.max(0, str.length - 1000); i--) {
    const sub = str.substring(0, i);
    // Para evitar parse de JSON vazio ou muito curto
    if (sub.length < 10) break;
    for (const suffix of suffixes) {
      try {
        const parsed = JSON.parse(sub + suffix);
        // Validar se é array
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
      }
    }
  }
  throw new Error("Não foi possível recuperar o JSON.");
}

const badJson = `[
  {
    "codigo": "123",
    "disciplinas": [
      {
        "nome": "Mat",
        "media": "9,00"
      },
      {
        "nome": "Por`;
        
console.log(bruteForceRepair(badJson));
