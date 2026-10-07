import { MODULE_ID, log } from "./const.js";
import { Passagem, TIPO } from "./passagem.js";
import { desenhar, limpar } from "./escadas.js";

/**
 * Andares: passar de um andar a outro sem janelas.
 *
 * O v14 já tem andares (Levels) e o comportamento de região «Mudar de andar». O Tiago faz os
 * andares facilmente; o que custava era a passagem — a janela de confirmação parte a cena.
 * Este módulo acrescenta a «Passagem» (escada, elevador, buraco): um ícone no mapa, como uma
 * porta; clicar com o token ao pé escurece o ecrã, tocam os passos e o token aparece no outro
 * andar. Ver passagem.js e escadas.js.
 */
Hooks.once("init", () => {
  CONFIG.RegionBehavior.dataModels[TIPO] = Passagem;
  CONFIG.RegionBehavior.typeIcons[TIPO] = "fa-solid fa-stairs";

  const som = (chave) => ({
    name: `ANDARES.Config.${chave}`, hint: `ANDARES.Config.${chave}Dica`,
    scope: "world", config: true, type: String, default: "", filePicker: "audio"
  });
  game.settings.register(MODULE_ID, "somSubir", som("SomSubir"));
  game.settings.register(MODULE_ID, "somDescer", som("SomDescer"));
  game.settings.register(MODULE_ID, "mestreTambem", {
    name: "ANDARES.Config.Mestre", hint: "ANDARES.Config.MestreDica",
    scope: "client", config: true, type: Boolean, default: false
  });
});

Hooks.once("ready", () => log("pronto"));

// os ícones: quando a camada das portas acaba de se desenhar (também ao mudar de andar), e quando
// as passagens mudam. Só com o `canvasReady` não chegava: num cliente de jogador do teste local ele
// nunca disparou e a escada não aparecia.
Hooks.on("drawControlsLayer", () => desenhar());
Hooks.on("canvasReady", desenhar);
Hooks.on("canvasTearDown", limpar);
const redesenhar = foundry.utils.debounce(() => desenhar(), 50);
for (const h of ["createRegion", "updateRegion", "deleteRegion", "createRegionBehavior", "updateRegionBehavior", "deleteRegionBehavior"]) {
  Hooks.on(h, (doc) => { if ((doc.parent?.parent ?? doc.parent)?.id === canvas.scene?.id || doc.parent?.id === canvas.scene?.id) redesenhar(); });
}
