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

/**
 * Escadas em sítios diferentes em cada andar. Uma região do Foundry tem a mesma forma em todos os
 * andares a que pertence — o Tiago desenhou a escada no 2.º e ela apareceu no 1.º no mesmo sítio,
 * e mexer numa mexia na outra. Por isso cada andar pode ter a SUA região, e as passagens do mesmo
 * tipo ligam-se sozinhas: de uma escada chega-se aos andares onde há outra escada.
 *
 * passagens: [{ id, tipo, andares: [ids] (vazio = todos), centro: {x, y} }]
 * Devolve os ids dos andares a que se chega a partir da passagem `deId`, estando no andar `atual`.
 */
export function andaresLigados(passagens = [], deId, atual, todos = []) {
  const de = passagens.find(p => p.id === deId);
  if (!de) return [];
  const naRegiao = (p) => (p.andares?.length ? p.andares : todos);
  const ids = new Set(naRegiao(de));
  for (const p of passagens) if (p.id !== deId && p.tipo === de.tipo) for (const a of naRegiao(p)) ids.add(a);
  ids.delete(atual);
  return [...ids].filter(id => todos.includes(id));
}

/**
 * Onde o token aparece no andar de destino. Se a própria região também existe lá (uma escada só,
 * desenhada nos dois andares), fica onde está: `null`. Senão, no centro da passagem do mesmo tipo
 * nesse andar mais perto desta (duas escadas no prédio → cada uma leva à sua).
 */
export function chegada(passagens = [], deId, destino, todos = []) {
  const de = passagens.find(p => p.id === deId);
  if (!de) return null;
  const naRegiao = (p) => (p.andares?.length ? p.andares : todos);
  if (naRegiao(de).includes(destino)) return null;
  const la = passagens.filter(p => p.id !== deId && p.tipo === de.tipo && naRegiao(p).includes(destino));
  const d = (p) => Math.hypot(p.centro.x - de.centro.x, p.centro.y - de.centro.y);
  return la.sort((a, b) => d(a) - d(b))[0]?.centro ?? null;
}
