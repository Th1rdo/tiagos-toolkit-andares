import { MODULE_ID } from "./const.js";
import { escolherDestino, direcao, vizinho, tipoValido, andaresLigados, chegada, TIPOS } from "./logica.js";
import { transicao, perguntarSentido } from "./transicao.js";

/**
 * A passagem: um comportamento de região que diz «aqui há uma escada (ou elevador, ou buraco)
 * entre estes andares». Não reage ao movimento: usa-se como uma porta — clicando no ícone
 * dela (escadas.js) com o token ao pé.
 *
 * Primeiro foi ao entrar na região, como o «Mudar de andar» do Foundry. O Tiago mudou de ideias
 * antes de publicar: *«character wanting to go to the stairs but not wanting to go up»* — ir até
 * à escada não é querer subi-la.
 */
const { RegionBehaviorType } = foundry.data.regionBehaviors;

export class Passagem extends RegionBehaviorType {
  static LOCALIZATION_PREFIXES = ["ANDARES.Passagem", "BEHAVIOR.TYPES.base"];

  static defineSchema() {
    const f = foundry.data.fields;
    return {
      tipo: new f.StringField({
        required: true, blank: false, initial: "escada",
        choices: () => Object.fromEntries(TIPOS.map(t => [t, `ANDARES.Tipos.${t}`]))
      }),
      // vazio = automático: o outro andar da região (ou Subir/Descer, se houver mais de um)
      destino: new f.StringField({
        required: true, blank: true, initial: "",
        choices: () => ({
          "": "ANDARES.Automatico",
          ...Object.fromEntries((canvas?.scene?.levels?.contents ?? []).map(l => [l.id, l.name]))
        })
      }),
      // a região da escada do outro lado (posta pelo botão «Escada»); vazio = ligação automática
      ligada: new f.StringField({ required: true, blank: true, initial: "" })
    };
  }

  static events = {};
}

export const TIPO = `${MODULE_ID}.passagem`;

/** A elevação de baixo de um andar (null = sem fundo). */
export function base(nivel) {
  const e = nivel?.elevation ?? {};
  return e.base ?? e.bottom ?? 0;
}

/** Os andares de uma cena no formato da lógica pura. */
export const andaresDe = (cena) => (cena.levels?.contents ?? []).map(l => ({ id: l.id, nome: l.name, base: base(l) }));

/** As passagens da cena no formato da lógica pura (id = o da região). */
export function passagensDe(cena) {
  const lista = [];
  for (const regiao of cena.regions ?? []) {
    const b = regiao.behaviors.find(b => b.type === TIPO && !b.disabled);
    const caixa = b && caixaDaRegiao(regiao);
    if (caixa) lista.push({ id: regiao.id, tipo: tipoValido(b.system.tipo), andares: [...(regiao.levels ?? [])],
      centro: { x: caixa.x + caixa.width / 2, y: caixa.y + caixa.height / 2 } });
  }
  return lista;
}

/** A caixa (x, y, largura, altura) das formas de uma região. */
export function caixaDaRegiao(regiao) {
  const xs = [], ys = [];
  for (const f of regiao.shapes ?? []) {
    if (f.type === "rectangle") { xs.push(f.x, f.x + f.width); ys.push(f.y, f.y + f.height); }
    else if (f.type === "ellipse") { xs.push(f.x - f.radiusX, f.x + f.radiusX); ys.push(f.y - f.radiusY, f.y + f.radiusY); }
    else if (f.points?.length) for (let i = 0; i < f.points.length; i += 2) { xs.push(f.points[i]); ys.push(f.points[i + 1]); }
  }
  if (!xs.length) return null;
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

/** Para onde esta passagem leva um token que está neste andar, de cima para baixo (vazia = a lado nenhum). */
export function saidas(comportamento, token) {
  const cena = token.parent;
  const andares = andaresDe(cena);
  const par = ligadaDe(comportamento);
  if (par) {
    const ids = [...(par.levels ?? [])].filter(id => id !== token._source.level);
    if (ids.length) return andares.filter(a => ids.includes(a.id)).sort((a, b) => b.base - a.base);
  }
  const ids = andaresLigados(passagensDe(cena), comportamento.parent.id, token._source.level, andares.map(a => a.id));
  return andares.filter(a => ids.includes(a.id)).sort((a, b) => b.base - a.base);
}

/** A região da escada ligada a esta (botão «Escada»), se ainda existir. */
export function ligadaDe(comportamento) {
  const id = comportamento.system?.ligada;
  return id ? comportamento.parent?.parent?.regions?.get(id) ?? null : null;
}

/** Onde fica o canto do token para o centro dele cair em `centro`, encostado à grelha. */
function cantoPara(token, centro) {
  const g = token.parent.grid;
  const w = token.width * g.size, h = token.height * g.size;
  let x = centro.x - w / 2, y = centro.y - h / 2;
  if (g.type === CONST.GRID_TYPES.SQUARE) { x = Math.round(x / g.size) * g.size; y = Math.round(y / g.size) * g.size; }
  return { x, y };
}

/**
 * Usar a passagem com um token: escolher o andar (Subir/Descer só se houver dois caminhos),
 * escurecer, passos, mudar de andar (ao pé da escada de lá), a vista atrás, clarear.
 */
export async function usar(comportamento, token) {
  const sistema = comportamento.system;
  const cena = token.parent;
  const lista = saidas(comportamento, token);
  if (!lista.length) return;
  const andares = andaresDe(cena);
  const origem = andares.find(a => a.id === token._source.level) ?? { id: null, nome: "", base: token.elevation ?? 0 };

  let destino = escolherDestino({ candidatos: lista, configurado: sistema.destino });
  if (!destino) {
    destino = await perguntarSentido({ subir: vizinho(lista, origem, "subir"), descer: vizinho(lista, origem, "descer") });
    if (!destino) return;
  }
  const nivel = cena.levels.get(destino.id);
  await transicao({
    tipo: tipoValido(sistema.tipo),
    sentido: direcao(origem, destino),
    // isto acontece com o ecrã preto: ninguém vê o token a mudar de andar
    meio: async () => {
      // a escada do outro andar pode estar noutro sítio do mapa: o token aparece ao pé dela
      const par = ligadaDe(comportamento);
      const caixaPar = par && caixaDaRegiao(par);
      const centro = caixaPar ? { x: caixaPar.x + caixaPar.width / 2, y: caixaPar.y + caixaPar.height / 2 }
        : chegada(passagensDe(cena), comportamento.parent.id, nivel.id, andares.map(a => a.id));
      const { x, y } = centro ? cantoPara(token, centro) : { x: token._source.x, y: token._source.y };
      await token.move(
        { x, y, elevation: base(nivel), level: nivel.id, action: token.movementAction },
        { animate: false, constrainOptions: { ignoreWalls: true } }
      );
      // a vista vai com o token. O Foundry já muda sozinho a vista de quem controla o token; pedir
      // outra mudança enquanto ele carrega dava o aviso «não podes mudar de cena enquanto carrega»
      // por cima do ecrã preto (teste no v14 local). Espera-se que acabe e só se pede se faltar.
      for (let i = 0; i < 40 && canvas.loading; i++) await new Promise(r => setTimeout(r, 50));
      if (cena.isView && canvas.level?.id !== nivel.id) await cena.view({ level: nivel.id, controlledTokens: [token.id] });
    }
  });
}
