/**
 * Lógica pura dos andares: sem Foundry, sem DOM — testada em Node.
 * Um andar aqui é { id, nome, base } (base = a elevação de baixo do andar).
 */

export const TIPOS = ["escada", "elevador", "buraco"];
export const tipoValido = (t) => (TIPOS.includes(t) ? t : "escada");

/**
 * Para onde se pode ir a partir de uma passagem: os andares a que a região pertence, menos o
 * atual (uma região sem andares marcados vale para todos, como no Foundry). De cima para baixo.
 */
export function candidatos(andares = [], idsDaRegiao = [], atual = null) {
  const daRegiao = idsDaRegiao.length ? andares.filter(a => idsDaRegiao.includes(a.id)) : andares;
  return daRegiao.filter(a => a.id !== atual).sort((a, b) => b.base - a.base);
}

export function direcao(origem, destino) {
  if (!origem || !destino || origem.base === destino.base) return null;
  return destino.base > origem.base ? "subir" : "descer";
}

/**
 * O destino sem perguntar nada: o que o mestre configurou (se não for onde o token já está),
 * ou o único possível. Com duas ou mais saídas e nada configurado, devolve null — pergunta-se.
 */
export function escolherDestino({ candidatos: lista = [], configurado = "" }) {
  if (configurado) return lista.find(a => a.id === configurado) ?? null;
  return lista.length === 1 ? lista[0] : null;
}

/** Numa escada de vários andares: subir é o andar logo acima, descer o logo abaixo. */
export function vizinho(lista = [], origem, sentido) {
  const acima = lista.filter(a => a.base > origem.base).sort((a, b) => a.base - b.base);
  const abaixo = lista.filter(a => a.base < origem.base).sort((a, b) => b.base - a.base);
  return (sentido === "subir" ? acima[0] : abaixo[0]) ?? null;
}

/**
 * Quanto tempo o ecrã fica preto, em ms. Uns passos: o som acaba já com o ecrã a clarear
 * (fica mais natural do que esperar que o último passo se cale no escuro). Cair é rápido.
 */
export function tempoNegro(tipo, segundosDeSom) {
  if (tipo === "buraco") return 900;
  if (!(segundosDeSom > 0)) return 1800;
  return Math.round(Math.min(3200, Math.max(1200, segundosDeSom * 1000 - 800)));
}

/**
 * O token está perto da escada? O centro dele dentro do retângulo da escada, alargado uma casa
 * para cada lado — como uma porta, usa-se ao pé dela, não do outro lado da sala.
 */
export function perto(centro, caixa, grelha = 100) {
  if (!centro || !caixa) return false;
  const m = grelha;
  return centro.x >= caixa.x - m && centro.x <= caixa.x + caixa.width + m
    && centro.y >= caixa.y - m && centro.y <= caixa.y + caixa.height + m;
}

/** De vários tokens controlados, o que está mais perto do centro da escada (só entre os que estão perto). */
export function maisPerto(tokens = [], caixa, grelha = 100) {
  const c = { x: caixa.x + caixa.width / 2, y: caixa.y + caixa.height / 2 };
  return tokens.filter(t => perto(t.centro, caixa, grelha))
    .sort((a, b) => Math.hypot(a.centro.x - c.x, a.centro.y - c.y) - Math.hypot(b.centro.x - c.x, b.centro.y - c.y))[0] ?? null;
}
