import { MODULE_ID } from "./const.js";
import { candidatos, escolherDestino, direcao, vizinho, tipoValido, TIPOS } from "./logica.js";
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
      })
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

/** Para onde esta passagem leva um token que está neste andar (lista vazia = a lado nenhum). */
export function saidas(comportamento, token) {
  return candidatos(andaresDe(token.parent), [...(comportamento.parent.levels ?? [])], token._source.level);
}

/**
 * Usar a passagem com um token: escolher o andar (Subir/Descer só se houver dois caminhos),
 * escurecer, passos, mudar de andar no mesmo sítio, a vista atrás, clarear.
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
      await token.move(
        { x: token._source.x, y: token._source.y, elevation: base(nivel), level: nivel.id, action: token.movementAction },
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
