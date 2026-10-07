import test from "node:test";
import assert from "node:assert/strict";
import { candidatos, direcao, escolherDestino, vizinho, tempoNegro, tipoValido } from "../scripts/logica.js";

// uma casa de três andares, como as do Tiago: cave, rés-do-chão, 1.º
const cave = { id: "cave", nome: "Cave", base: -10 };
const rc = { id: "rc", nome: "R/C", base: 0 };
const primeiro = { id: "p1", nome: "1.º", base: 10 };
const andares = [primeiro, cave, rc];          // a ordem do Foundry não interessa

test("candidatos: os andares da região menos o atual, de cima para baixo", () => {
  assert.deepEqual(candidatos(andares, ["rc", "p1"], "rc").map(a => a.id), ["p1"]);
  assert.deepEqual(candidatos(andares, ["cave", "rc", "p1"], "rc").map(a => a.id), ["p1", "cave"]);
  // uma região sem andares marcados vale para todos (como no Foundry)
  assert.deepEqual(candidatos(andares, [], "p1").map(a => a.id), ["rc", "cave"]);
  assert.deepEqual(candidatos(andares, ["rc", "naoexiste"], "rc").map(a => a.id), []);
});

test("direção: subir ou descer pela altura do andar", () => {
  assert.equal(direcao(rc, primeiro), "subir");
  assert.equal(direcao(primeiro, cave), "descer");
  assert.equal(direcao(rc, rc), null);
});

test("escolherDestino: o configurado, se servir; senão o único possível; senão é preciso perguntar", () => {
  const dois = candidatos(andares, ["rc", "p1"], "rc");
  assert.equal(escolherDestino({ candidatos: dois, configurado: "" })?.id, "p1");
  const tres = candidatos(andares, ["cave", "rc", "p1"], "rc");
  assert.equal(escolherDestino({ candidatos: tres, configurado: "" }), null, "duas saídas: pergunta-se");
  assert.equal(escolherDestino({ candidatos: tres, configurado: "cave" })?.id, "cave");
  assert.equal(escolherDestino({ candidatos: tres, configurado: "rc" }), null, "o configurado é onde já está: pergunta-se");
  assert.equal(escolherDestino({ candidatos: [], configurado: "" }), null);
});

test("vizinho: subir vai ao andar logo acima, descer ao logo abaixo", () => {
  const tres = candidatos(andares, ["cave", "rc", "p1"], "rc");
  assert.equal(vizinho(tres, rc, "subir")?.id, "p1");
  assert.equal(vizinho(tres, rc, "descer")?.id, "cave");
  assert.equal(vizinho(candidatos(andares, ["rc", "p1"], "p1"), primeiro, "subir"), null);
});

test("o ecrã fica preto o tempo de uns passos, nem mais nem menos", () => {
  assert.equal(tempoNegro("escada", 3), 2200, "mais curto do que o som: o som acaba já com o ecrã a clarear");
  assert.equal(tempoNegro("escada", 0.5), 1200, "nunca menos que 1,2 s");
  assert.equal(tempoNegro("escada", null), 1800, "sem som: um tempo fixo");
  assert.equal(tempoNegro("buraco", null), 900, "cair é rápido");
  assert.equal(tempoNegro("elevador", null), 1800);
});

test("tipos de passagem", () => {
  assert.equal(tipoValido("escada"), "escada");
  assert.equal(tipoValido("elevador"), "elevador");
  assert.equal(tipoValido("buraco"), "buraco");
  assert.equal(tipoValido("teletransporte"), "escada");
});

import { perto, maisPerto } from "../scripts/logica.js";

test("perto: em cima da escada ou a uma casa dela; mais longe não", () => {
  const escada = { x: 1000, y: 500, width: 200, height: 200 };
  assert.ok(perto({ x: 1100, y: 600 }, escada, 100), "em cima");
  assert.ok(perto({ x: 950, y: 600 }, escada, 100), "na casa ao lado");
  assert.ok(!perto({ x: 850, y: 600 }, escada, 100), "duas casas ao lado");
  assert.ok(!perto(null, escada));
});

test("maisPerto: com vários tokens escolhidos, o que está ao pé da escada", () => {
  const escada = { x: 1000, y: 500, width: 200, height: 200 };
  const tokens = [{ id: "longe", centro: { x: 300, y: 300 } }, { id: "lado", centro: { x: 950, y: 520 } }, { id: "cima", centro: { x: 1100, y: 600 } }];
  assert.equal(maisPerto(tokens, escada, 100)?.id, "cima");
  assert.equal(maisPerto([tokens[0]], escada, 100), null);
});

import { andaresLigados, chegada } from "../scripts/logica.js";

// o caso do Tiago: a escada do 2.º andar e a do 1.º em sítios diferentes, cada uma no seu andar
const todos = ["cave", "rc", "p1"];
const escadaRC = { id: "eRC", tipo: "escada", andares: ["rc"], centro: { x: 500, y: 500 } };
const escadaP1 = { id: "eP1", tipo: "escada", andares: ["p1"], centro: { x: 1500, y: 300 } };

test("escadas separadas: cada uma leva ao andar da outra", () => {
  assert.deepEqual(andaresLigados([escadaRC, escadaP1], "eRC", "rc", todos), ["p1"]);
  assert.deepEqual(andaresLigados([escadaRC, escadaP1], "eP1", "p1", todos), ["rc"]);
  // um elevador não liga a uma escada
  const elev = { id: "el", tipo: "elevador", andares: ["cave"], centro: { x: 0, y: 0 } };
  assert.deepEqual(andaresLigados([escadaRC, escadaP1, elev], "eRC", "rc", todos), ["p1"]);
  // uma região só, nos dois andares (o modo antigo) continua a funcionar
  const dupla = { id: "d", tipo: "escada", andares: ["rc", "p1"], centro: { x: 0, y: 0 } };
  assert.deepEqual(andaresLigados([dupla], "d", "rc", todos), ["p1"]);
});

test("chegada: ao centro da escada de lá; na mesma região, fica onde está", () => {
  assert.deepEqual(chegada([escadaRC, escadaP1], "eRC", "p1", todos), { x: 1500, y: 300 });
  assert.deepEqual(chegada([escadaRC, escadaP1], "eP1", "rc", todos), { x: 500, y: 500 });
  const dupla = { id: "d", tipo: "escada", andares: ["rc", "p1"], centro: { x: 0, y: 0 } };
  assert.equal(chegada([dupla], "d", "p1", todos), null);
  // duas escadas no 1.º: vai para a mais perto desta
  const outra = { id: "eP1b", tipo: "escada", andares: ["p1"], centro: { x: 520, y: 480 } };
  assert.deepEqual(chegada([escadaRC, escadaP1, outra], "eRC", "p1", todos), { x: 520, y: 480 });
});
