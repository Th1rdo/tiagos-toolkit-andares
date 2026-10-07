import { TIPOS, tipoValido } from "./logica.js";
import { TIPO, caixaDaRegiao } from "./passagem.js";

/**
 * O lado do mestre, sem regiões nem comportamentos à vista. O Tiago: *«simplesmente criar uma
 * escada e conectar com outra escada»*. Por trás, cada escada é uma região de uma casa, só no
 * andar onde foi posta, com o comportamento Passagem; `ligada` aponta para a região da outra.
 *
 * - Botão «Escada» → clicar onde ela fica → mudar de andar → clicar onde ela chega. Ligadas.
 * - Arrastar o ícone muda-a de sítio. Botão direito: ligar a outra, tipo, apagar.
 */

const t = (k, d) => game.i18n.format(`ANDARES.Editar.${k}`, d ?? {});

/** «Agora clica…»: um ícone fantasma segue o rato; o clique devolve o ponto. Esc / botão direito desistem. */
function clicarNoMapa(aviso, { aceitar = () => true } = {}) {
  return new Promise((resolve) => {
    const vista = canvas?.app?.view;
    if (!vista) return resolve(null);
    const fantasma = document.createElement("div");
    fantasma.className = "andares-fantasma";
    fantasma.innerHTML = `<i class="fa-solid fa-stairs"></i>`;
    const faixa = document.createElement("div");
    faixa.className = "andares-aviso";
    faixa.textContent = aviso;
    document.body.append(fantasma, faixa);

    const mover = (ev) => {
      fantasma.style.transform = `translate(${ev.clientX - 18}px, ${ev.clientY - 18}px)`;
      fantasma.classList.add("andares-visivel");
    };
    const acabar = (valor) => {
      document.removeEventListener("pointerdown", clicar, true);
      document.removeEventListener("pointermove", mover, true);
      document.removeEventListener("keydown", tecla, true);
      document.removeEventListener("contextmenu", direito, true);
      fantasma.remove(); faixa.remove();
      resolve(valor);
    };
    const clicar = (ev) => {
      if (ev.target !== canvas.app?.view) return;
      ev.preventDefault(); ev.stopImmediatePropagation();
      if (ev.button === 2) return acabar(null);
      if (ev.button !== 0) return;
      const p = canvas.canvasCoordinatesFromClient({ x: ev.clientX, y: ev.clientY });
      if (aceitar(p)) acabar(p);
    };
    const direito = (ev) => { if (ev.target === canvas.app?.view) { ev.preventDefault(); ev.stopImmediatePropagation(); } };
    const tecla = (ev) => { if (ev.key === "Escape") { ev.preventDefault(); ev.stopImmediatePropagation(); acabar(null); } };
    // no documento (não só na vista): mudar de andar a meio pode trocar o elemento do canvas
    document.addEventListener("pointerdown", clicar, true);
    document.addEventListener("pointermove", mover, true);
    document.addEventListener("keydown", tecla, true);
    document.addEventListener("contextmenu", direito, true);
  }).finally(() => document.querySelectorAll(".andares-fantasma, .andares-aviso").forEach(e => e.remove()));
}

/** A casa da grelha onde caiu o clique (canto e lado). */
function casa(p) {
  const g = canvas.scene.grid;
  const lado = g.size;
  if (g.type === CONST.GRID_TYPES.GRIDLESS) return { x: p.x - lado / 2, y: p.y - lado / 2, lado };
  return { x: Math.floor(p.x / lado) * lado, y: Math.floor(p.y / lado) * lado, lado };
}

/** As escadas (regiões com Passagem) do andar que se está a ver. */
function escadasAqui() {
  const nivel = canvas.level?.id;
  return canvas.scene.regions.filter(r => r.behaviors.some(b => b.type === TIPO)
    && (!r.levels?.size || !nivel || r.levels.has(nivel)));
}

/** A escada deste andar em que se clicou (com uma casa de folga), se houver. */
function escadaEm(p) {
  const g = canvas.scene.grid.size;
  return escadasAqui().find(r => {
    const c = caixaDaRegiao(r);
    return c && p.x >= c.x - g / 2 && p.x <= c.x + c.width + g / 2 && p.y >= c.y - g / 2 && p.y <= c.y + c.height + g / 2;
  }) ?? null;
}

const comportamento = (regiao) => regiao?.behaviors.find(b => b.type === TIPO) ?? null;

async function criarEscada(p, tipo = "escada") {
  const { x, y, lado } = casa(p);
  const nivel = canvas.level?.id;
  const [regiao] = await canvas.scene.createEmbeddedDocuments("Region", [{
    name: game.i18n.localize(`ANDARES.Tipos.${tipo}`),
    color: "#d8b66a",
    shapes: [{ type: "rectangle", x, y, width: lado, height: lado, rotation: 0 }],
    levels: nivel ? [nivel] : [],
    behaviors: [{ type: TIPO, name: game.i18n.localize(`ANDARES.Tipos.${tipo}`), system: { tipo, destino: "", ligada: "" } }]
  }]);
  return regiao;
}

/** Liga duas escadas (e desfaz as ligações antigas de cada uma). */
async function ligarPar(a, b) {
  const atualizar = [];
  for (const r of [a, b]) {
    const antiga = canvas.scene.regions.get(comportamento(r)?.system.ligada);
    if (antiga && antiga.id !== a.id && antiga.id !== b.id) atualizar.push([antiga, ""]);
  }
  atualizar.push([a, b.id], [b, a.id]);
  for (const [r, alvo] of atualizar) await comportamento(r)?.update({ "system.ligada": alvo });
}

const nomeAndar = (regiao) => {
  const id = [...(regiao?.levels ?? [])][0];
  return canvas.scene.levels?.get(id)?.name ?? "—";
};

/** Botão «Escada»: pôr uma, e logo a seguir a do outro andar. */
export async function novaEscada() {
  if (!canvas.scene) return;
  if ((canvas.scene.levels?.size ?? 0) < 2) return ui.notifications.warn(t("SemAndares"));
  const p = await clicarNoMapa(t("ClicaOnde"));
  if (!p) return;
  const a = await criarEscada(p);
  await ligarDesde(a);
}

/** Ligar uma escada a outra: clicar numa escada de outro andar, ou num sítio vazio (cria lá uma). */
export async function ligarDesde(a) {
  const andarA = [...(a.levels ?? [])][0];
  const p = await clicarNoMapa(t("AgoraOutroAndar", { andar: nomeAndar(a) }), {
    aceitar: () => {
      if (canvas.level?.id && canvas.level.id === andarA) { ui.notifications.info(t("MudaDeAndar")); return false; }
      return true;
    }
  });
  if (!p) return ui.notifications.info(t("FicouSozinha"));
  const b = escadaEm(p) ?? await criarEscada(p, tipoValido(comportamento(a)?.system.tipo));
  if (b.id === a.id) return;
  await ligarPar(a, b);
  ui.notifications.info(t("Ligadas", { a: nomeAndar(a), b: nomeAndar(b) }));
}

/** Botão direito numa escada (mestre). */
export async function menu(regiao) {
  const b = comportamento(regiao);
  if (!b) return;
  const tipo = tipoValido(b.system.tipo);
  const par = canvas.scene.regions.get(b.system.ligada);
  const escolha = await foundry.applications.api.DialogV2.wait({
    window: { title: game.i18n.localize(`ANDARES.Tipos.${tipo}`), icon: "fa-solid fa-stairs" },
    content: `<p>${par ? t("LigadaA", { andar: nomeAndar(par) }) : t("NaoLigada")}</p>`,
    buttons: [
      { action: "ligar", label: t("Ligar"), icon: "fa-solid fa-link", default: true },
      ...TIPOS.filter(x => x !== tipo).map(x => ({ action: `tipo:${x}`, label: t("Tornar", { tipo: game.i18n.localize(`ANDARES.Tipos.${x}`) }), icon: "fa-solid fa-shuffle" })),
      { action: "apagar", label: t("Apagar"), icon: "fa-solid fa-trash" }
    ],
    rejectClose: false
  });
  if (escolha === "ligar") return ligarDesde(regiao);
  if (escolha?.startsWith("tipo:")) {
    const novo = escolha.slice(5);
    for (const r of [regiao, par].filter(Boolean)) {
      await comportamento(r).update({ "system.tipo": novo, name: game.i18n.localize(`ANDARES.Tipos.${novo}`) });
      await r.update({ name: game.i18n.localize(`ANDARES.Tipos.${novo}`) });
    }
  }
  if (escolha === "apagar") {
    if (par && comportamento(par)?.system.ligada === regiao.id) await comportamento(par).update({ "system.ligada": "" });
    await regiao.delete();
  }
}

/** Arrastar o ícone: a escada vai para a casa onde se larga. */
export async function moverPara(regiao, p) {
  const c = caixaDaRegiao(regiao);
  if (!c) return;
  const { x, y } = casa(p);
  const dx = x - c.x, dy = y - c.y;
  if (!dx && !dy) return;
  const shapes = regiao.toObject().shapes.map(s => {
    const n = { ...s };
    if ("x" in n) { n.x += dx; n.y += dy; }
    if (n.points) n.points = n.points.map((v, i) => v + (i % 2 ? dy : dx));
    return n;
  });
  await regiao.update({ shapes });
}

