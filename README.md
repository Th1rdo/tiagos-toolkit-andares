# Tiago's Toolkit: Andares

Passar de um andar a outro **sem janelas**, sobre os andares nativos (*Levels*) do Foundry v14.

Uma região com o comportamento **Passagem** (escada, elevador ou buraco) desenha um **ícone clicável** no mapa,
como as portas. Andar até lá não faz nada — só o clique. Quem usa a passagem vê o ecrã escurecer, ouve os passos
a subir ou a descer e aparece no outro andar, com a vista atrás do token.

## Como se usa
1. Fazer os andares na cena (*Levels*) e uma região onde fica a escada, ligada aos andares que une.
2. Na região, acrescentar o comportamento **Passagem** (tipo: escada / elevador / buraco; destino vazio = o outro
   andar; com mais de dois andares aparecem os botões Subir / Descer).
3. Nas definições do módulo, escolher os sons de subir e descer (por agora só a escada tem som).
4. Em jogo: selecionar o token, ir ao pé do ícone e clicar. Longe → «Chegue mais perto para usar.»

O mestre não fica às escuras (definição de cliente «mestreTambem», desligada). Há sempre uma saída ao fim de
poucos segundos: o ecrã nunca fica preso no preto.

**Os sons não vão no módulo** (cada mesa escolhe os seus em `somSubir` / `somDescer`).

## Instalar
Manifest: `https://github.com/Th1rdo/tiagos-toolkit-andares/releases/latest/download/module.json`

Requer Foundry **v14**.
