import { MODULE_ID } from "./const.js";
import { tempoNegro } from "./logica.js";

const esperar = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * A transição: o ecrã escurece, ouvem-se os passos, `meio()` muda o token de andar com tudo
 * preto, e o ecrã clareia já no andar novo. Só no ecrã de quem moveu o token.
 */
export async function transicao({ tipo = "escada", sentido = "subir", meio }) {
  const mestre = game.user.isGM;
  // o mestre a arrastar um NPC pelas escadas não precisa de ficar às escuras (definição)
  if (mestre && !game.settings.get(MODULE_ID, "mestreTambem")) return meio();

  const veu = document.createElement("div");
  veu.id = "andares-veu";
  // vigia geral: aconteça o que acontecer lá dentro, daqui a 9 s o véu sai. Um ecrã preto sem
  // saída foi o que os dois primeiros testes deram.
  const vigia = setTimeout(() => veu.remove(), 9000);
  veu.className = `andares-${tipo}`;
  document.body.append(veu);
  void veu.offsetWidth;
  veu.classList.add("andares-escuro");

  // os passos começam com o escurecer: ouve-se subir antes de se ver o andar de cima
  const segundos = await tocarPassos(tipo, sentido);
  await esperar(350);
  // rede de segurança: aconteça o que acontecer à mudança de andar, o véu sai — um ecrã preto
  // sem saída foi o que o primeiro teste deu (o move ficou pendurado)
  try { await Promise.race([meio(), esperar(5000).then(() => { throw new Error("a mudança de andar não respondeu em 5 s"); })]); }
  catch (e) { console.error(`${MODULE_ID} |`, e); }
  await esperar(Math.max(0, tempoNegro(tipo, segundos) - 350));
  veu.classList.remove("andares-escuro");
  await esperar(650);
  clearTimeout(vigia);
  veu.remove();
}

/** Toca o som da escada (subir ou descer). Devolve a duração em segundos, ou null. */
async function tocarPassos(tipo, sentido) {
  if (tipo !== "escada") return null;              // por agora só as escadas têm som
  const src = game.settings.get(MODULE_ID, sentido === "descer" ? "somDescer" : "somSubir")
    || game.settings.get(MODULE_ID, "somSubir");
  if (!src) return null;
  try {
    const AH = foundry.audio?.AudioHelper ?? globalThis.AudioHelper;
    // canal «ambiente»: são passos do mundo, seguem o volume de som ambiente de cada um.
    // Não se espera pelo som: o play só resolve quando o browser deixa tocar áudio, e num ecrã
    // em que ainda ninguém clicou isso pode nunca acontecer — a transição ficava presa no escuro.
    const a = AH.play({ src, volume: 0.8, loop: false, channel: "environment" }, false);
    const som = await Promise.race([a, esperar(300).then(() => null)]).catch(() => null);
    return Number.isFinite(som?.duration) ? som.duration : null;
  } catch (e) {
    console.warn(`${MODULE_ID} | não consegui tocar`, src, e);
    return null;
  }
}

/**
 * Numa escada com mais de dois andares: dois botões discretos, Subir e Descer, por cima do
 * mapa. Esc ou clicar fora desiste (o token fica onde está).
 */
export function perguntarSentido({ subir, descer, tipo }) {
  const opcoes = [["subir", subir, "fa-arrow-up"], ["descer", descer, "fa-arrow-down"]].filter(([, a]) => a);
  if (opcoes.length === 1) return Promise.resolve(opcoes[0][1]);
  return new Promise((resolve) => {
    const caixa = document.createElement("div");
    caixa.id = "andares-escolha";
    const t = (k, d) => game.i18n.format(k, d);
    caixa.innerHTML = opcoes.map(([s, a, i]) => `
      <button type="button" class="andares-opcao" data-s="${s}"><i class="fa-solid ${i}"></i>
        <span>${t(`ANDARES.${s === "subir" ? "Subir" : "Descer"}`, { andar: foundry.utils.escapeHTML(a.nome) })}</span></button>`).join("");
    document.body.append(caixa);
    const acabar = (valor) => {
      document.removeEventListener("keydown", tecla, true);
      document.removeEventListener("pointerdown", fora, true);
      caixa.remove();
      resolve(valor);
    };
    const tecla = (ev) => { if (ev.key === "Escape") { ev.preventDefault(); ev.stopPropagation(); acabar(null); } };
    const fora = (ev) => { if (!caixa.contains(ev.target)) acabar(null); };
    caixa.addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-s]");
      if (b) acabar(opcoes.find(([s]) => s === b.dataset.s)?.[1] ?? null);
    });
    document.addEventListener("keydown", tecla, true);
    setTimeout(() => document.addEventListener("pointerdown", fora, true), 0);
  });
}
