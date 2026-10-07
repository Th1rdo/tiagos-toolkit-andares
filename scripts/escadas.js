import { MODULE_ID } from "./const.js";
import { maisPerto, tipoValido } from "./logica.js";
import { TIPO, usar, saidas, caixaDaRegiao } from "./passagem.js";
import { menu, moverPara } from "./editar.js";

/**
 * Os ícones das passagens no mapa, como os das portas: um por passagem, no andar que se está a
 * ver, ao centro da região. Clicar com um token ao pé leva-o (escadas.js → passagem.usar).
 *
 * Desenhados em PIXI na camada dos controlos (a mesma das portas): acompanham o zoom e o
 * arrastar do mapa sem contas à mão (a lição do POI com o `worldTransform`).
 */

let camada = null;
let aUsar = false;

/**
 * O símbolo desenhado à mão, não com a letra do Font Awesome: o v14 traz a «Font Awesome 7 Pro» e o nome
 * antigo («6 Pro») mostrava a caixa do carácter em falta («F229») no Forge do Tiago.
 */
function desenharSimbolo(tipo, r) {
  const s = new PIXI.Graphics();
  const cor = 0xf2e6c8, w = Math.max(1.5, r * 0.11), u = r * 0.42;
  s.lineStyle({ width: w, color: cor, alpha: 1, cap: "round", join: "round" });
  if (tipo === "elevador") {
    s.drawRoundedRect(-u * 0.75, -u, u * 1.5, u * 2, u * 0.15);
    s.moveTo(-u * 0.35, -u * 0.15).lineTo(0, -u * 0.6).lineTo(u * 0.35, -u * 0.15);
    s.moveTo(-u * 0.35, u * 0.15).lineTo(0, u * 0.6).lineTo(u * 0.35, u * 0.15);
  } else if (tipo === "buraco") {
    s.drawEllipse(0, 0, u, u * 0.6);
    s.lineStyle(0).beginFill(cor, 0.85).drawEllipse(0, u * 0.08, u * 0.6, u * 0.32).endFill();
  } else {
    // três degraus a subir para a direita
    s.moveTo(-u, u).lineTo(-u, u * 0.33).lineTo(-u * 0.33, u * 0.33).lineTo(-u * 0.33, -u * 0.33)
      .lineTo(u * 0.33, -u * 0.33).lineTo(u * 0.33, -u).lineTo(u, -u);
  }
  return s;
}

export const caixaDe = caixaDaRegiao;

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
    camada.addChild(icone({ regiao, comportamento, caixa, r: Math.max(13, g * 0.22) }));
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
    fundo.lineStyle(Math.max(1.5, r * 0.08), realce ? 0xf0d48a : 0xd8b66a, realce ? 1 : 0.75);
    fundo.beginFill(0x0c0c0e, realce ? 0.85 : 0.6).drawCircle(0, 0, r).endFill();
  };
  pintar(false);
  const simbolo = desenharSimbolo(tipo, r);
  simbolo.alpha = 0.85;
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
    simbolo.alpha = 1;
    c.scale.set(1.08);
    rotulo.text = game.i18n.localize(`ANDARES.Tipos.${tipo}`);
    rotulo.visible = true;
  });
  c.on("pointerout", () => { pintar(false); c.scale.set(1); simbolo.alpha = 0.85; rotulo.visible = false; });
  c.on("pointerdown", (ev) => {
    ev.stopPropagation();          // o clique é da escada, não do mapa (não desseleciona o token)
    if (ev.button === 2 && game.user.isGM) return void menu(comportamento.parent);
    if (ev.button !== 0) return;
    if (!game.user.isGM) return void clicar(comportamento, caixa);
    // o mestre: carregar e largar usa a escada; carregar e mexer arrasta-a para outro sítio
    const inicio = { x: ev.global.x, y: ev.global.y };
    const origem = { x: c.position.x, y: c.position.y };
    let arrastar = false;
    const mexer = (e) => {
      const p = canvas.canvasCoordinatesFromClient({ x: e.clientX, y: e.clientY });
      const r = canvas.app.view.getBoundingClientRect();
      const dx = e.clientX - r.left - inicio.x, dy = e.clientY - r.top - inicio.y;
      if (!arrastar && Math.hypot(dx, dy) < 6) return;
      arrastar = true;
      c.position.set(p.x, p.y);
    };
    const largar = (e) => {
      document.removeEventListener("pointermove", mexer, true);
      document.removeEventListener("pointerup", largar, true);
      if (!arrastar) return void clicar(comportamento, caixa);
      c.position.set(origem.x, origem.y);
      void moverPara(comportamento.parent, canvas.canvasCoordinatesFromClient({ x: e.clientX, y: e.clientY }));
    };
    document.addEventListener("pointermove", mexer, true);
    document.addEventListener("pointerup", largar, true);
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
