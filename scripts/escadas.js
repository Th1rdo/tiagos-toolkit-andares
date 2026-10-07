import { MODULE_ID } from "./const.js";
import { maisPerto, tipoValido } from "./logica.js";
import { TIPO, usar, saidas } from "./passagem.js";

/**
 * Os ícones das passagens no mapa, como os das portas: um por passagem, no andar que se está a
 * ver, ao centro da região. Clicar com um token ao pé leva-o (escadas.js → passagem.usar).
 *
 * Desenhados em PIXI na camada dos controlos (a mesma das portas): acompanham o zoom e o
 * arrastar do mapa sem contas à mão (a lição do POI com o `worldTransform`).
 */

let camada = null;
let aUsar = false;

const ICONES = { escada: "", elevador: "", buraco: "" };     // fa-stairs · fa-elevator · fa-circle

/** A caixa (x, y, largura, altura) das formas de uma região. */
export function caixaDe(regiao) {
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

/** As passagens ativas que existem no andar que se está a ver. */
function passagensAqui() {
  const nivel = canvas.level?.id;
  const lista = [];
  for (const regiao of canvas.scene?.regions ?? []) {
    const niveis = [...(regiao.levels ?? [])];
    if (niveis.length && nivel && !niveis.includes(nivel)) continue;
    for (const b of regiao.behaviors) if (b.type === TIPO && !b.disabled) lista.push({ regiao, comportamento: b });
  }
  return lista;
}

export function desenhar() {
  limpar();
  // (não `canvas.ready`: num cliente de jogador vinha falso com a cena já desenhada e não aparecia nada)
  if (!canvas?.scene || !canvas.controls) return;
  camada = new PIXI.Container();
  camada.name = "andaresPassagens";
  camada.sortableChildren = true;
  const g = canvas.grid?.size ?? 100;
  for (const { regiao, comportamento } of passagensAqui()) {
    const caixa = caixaDe(regiao);
    if (!caixa) continue;
    camada.addChild(icone({ regiao, comportamento, caixa, r: Math.max(18, g * 0.3) }));
  }
  canvas.controls.addChild(camada);
}

export function limpar() {
  camada?.destroy({ children: true });
  camada = null;
}

function icone({ comportamento, caixa, r }) {
  const tipo = tipoValido(comportamento.system.tipo);
  const c = new PIXI.Container();
  c.position.set(caixa.x + caixa.width / 2, caixa.y + caixa.height / 2);
  c.eventMode = "static";
  c.cursor = "pointer";
  c.hitArea = new PIXI.Circle(0, 0, r * 1.15);

  const fundo = new PIXI.Graphics();
  const pintar = (realce) => {
    fundo.clear();
    fundo.lineStyle(Math.max(2, r * 0.09), realce ? 0xf0d48a : 0xd8b66a, 1);
    fundo.beginFill(0x0c0c0e, realce ? 0.95 : 0.8).drawCircle(0, 0, r).endFill();
  };
  pintar(false);
  const simbolo = new PIXI.Text(ICONES[tipo], {
    fontFamily: "Font Awesome 6 Pro", fontWeight: "900", fontSize: r * 1.05, fill: 0xf2e6c8
  });
  simbolo.anchor.set(0.5);
  const rotulo = new PIXI.Text("", {
    fontFamily: "Signika, sans-serif", fontSize: Math.max(12, r * 0.55), fill: 0xffffff,
    stroke: 0x000000, strokeThickness: 4
  });
  rotulo.anchor.set(0.5, 0);
  rotulo.position.set(0, r * 1.25);
  rotulo.visible = false;
  c.addChild(fundo, simbolo, rotulo);

  c.on("pointerover", () => {
    pintar(true);
    c.scale.set(1.08);
    rotulo.text = game.i18n.localize(`ANDARES.Tipos.${tipo}`);
    rotulo.visible = true;
  });
  c.on("pointerout", () => { pintar(false); c.scale.set(1); rotulo.visible = false; });
  c.on("pointerdown", (ev) => {
    if (ev.button !== 0) return;
    ev.stopPropagation();          // o clique é da escada, não do mapa (não desseleciona o token)
    clicar(comportamento, caixa);
  });
  return c;
}

/** Clicaram numa passagem: qual token vai? O controlado mais perto; um jogador sem nenhum controlado usa o seu. */
async function clicar(comportamento, caixa) {
  if (aUsar) return;
  const nivel = canvas.level?.id;
  const aqui = (t) => t.isOwner && (!nivel || t.document.level === nivel);
  let tokens = canvas.tokens.controlled.filter(aqui);
  if (!tokens.length && !game.user.isGM) tokens = canvas.tokens.placeables.filter(aqui);
  const escolhido = maisPerto(tokens.map(t => ({ t, centro: t.center })), caixa, canvas.grid?.size ?? 100)?.t;
  if (!escolhido) {
    ui.notifications.info(game.i18n.localize(tokens.length ? "ANDARES.ChegaPerto" : "ANDARES.SemToken"));
    return;
  }
  if (!saidas(comportamento, escolhido.document).length) return;
  aUsar = true;
  try { await usar(comportamento, escolhido.document); }
  catch (e) { console.error(`${MODULE_ID} |`, e); }
  finally { aUsar = false; }
}
