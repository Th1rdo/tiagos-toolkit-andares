# Tiago's Toolkit: Andares

Passar de um andar a outro **sem janelas**, sobre os andares nativos (*Levels*) do Foundry v14.

Uma região com o comportamento **Passagem** (escada, elevador ou buraco) desenha um **ícone clicável** no mapa,
como as portas. Andar até lá não faz nada — só o clique. Quem usa a passagem vê o ecrã escurecer, ouve os passos
a subir ou a descer e aparece no outro andar, com a vista atrás do token.

## Como se usa
1. Fazer os andares na cena (*Levels*).
2. Botão **Escada** (ferramentas dos tokens) → clicar onde fica a escada → mudar para o outro andar → clicar onde
   ela chega. Ficam ligadas, cada uma no seu sítio do mapa. (Clicar numa escada que já lá está liga às duas.)
3. **Arrastar** o ícone muda a escada de sítio. **Botão direito**: ligar a outra escada, passar a elevador ou
   buraco, apagar.
4. Nas definições do módulo, escolher os sons de subir e descer (por agora só a escada tem som).
5. Em jogo: o jogador vai com o token ao pé do ícone e clica. Aparece ao pé da escada do outro andar.

Por trás, cada escada é uma região de uma casa, só no seu andar, com o comportamento **Passagem**. Ainda se pode
fazer à mão (uma região nos dois andares = a escada no mesmo sítio dos dois).

O mestre não fica às escuras (definição de cliente «mestreTambem», desligada). Há sempre uma saída ao fim de
poucos segundos: o ecrã nunca fica preso no preto.

**Os sons não vão no módulo** (cada mesa escolhe os seus em `somSubir` / `somDescer`).

## Instalar
Manifest: `https://github.com/Th1rdo/tiagos-toolkit-andares/releases/latest/download/module.json`

Requer Foundry **v14**.
