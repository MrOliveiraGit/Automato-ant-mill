# Automato — relatório do projeto

**Moinhos de formigas numa simulação de agentes com feromônio, e o que o vento faz com eles**

Repositório: `MrOliveiraGit/Automato-ant-mill` · período: 2026-09-11 → 2026-09-28 · 10 commits em 4 branches

---

## 1. Resumo

O projeto simula formigas numa grade de 100 × 100. Cada formiga é um agente individual, e todas compartilham um único campo de feromônio. O objetivo é reproduzir o **moinho de formigas** (*ant mill*), a "espiral da morte" em que formigas de correição andam em círculo sem parar, seguindo a trilha umas das outras. A partir disso, o projeto faz uma pergunta científica:

> **O vento, ao deslocar as trilhas de feromônio, muda a chance de um moinho surgir?**

O trabalho passou por dois modelos de movimento:

| | Movimento v1 (commits `54fd7bd` → `4085dfc`) | Movimento v2, "formiga de correição" (`7c124f7` → `6082cec`) |
|---|---|---|
| Como a formiga se move | Passos na grade; passeio aleatório + voos de Lévy; segue a trilha **só se existir um alvo de comida (POI)**, e é puxada para ele | Posição contínua, velocidade constante; duas antenas; vira para o lado com mais feromônio; nada além disso |
| Moinhos surgindo do zero | **0 moinhos em 120 execuções** (em todas as intensidades de vento e layouts de obstáculo) | **Moinhos em ~80–90% das execuções**, sem nenhuma regra que fale em rotação |
| Efeito do vento | A colônia é empurrada contra a parede a favor do vento; continua sem moinhos | Vento forte **destrói** moinhos; vento fraco gera moinhos **mais frequentes, menores e mais curtos**; as paredes são um fator de confusão |

Em nenhum lugar do código o moinho é imposto. A regra de virada é simétrica entre esquerda e direita, e nada se refere a um centro, a um círculo ou a um sentido de rotação. A única exceção é o **Teste A (`ring`)**, que *começa* de propósito com um moinho pronto. Ele verifica se um moinho se mantém sozinho; não diz nada sobre como um moinho se forma.

---

## 2. Linha do tempo

```
master             54fd7bd ── 0f61a19
                                 │
poi-lifespan                     ├── 03bcb80 ── 9531694
                                 │
wind-on-pheromone                └── 1016866 ── b2d048a ── fe297df ── 4085dfc
                                                                         │
army-ant-movement                                                        └── 7c124f7 ── 6082cec
                                                                                           │
project-report                                                                             └── (este relatório)
```

| # | Data | Commit | Branch | Conceito | Por quê | Resultado |
|---|---|---|---|---|---|---|
| 1 | 11/09 | `54fd7bd` | master | Primeira simulação: campo de feromônio + direção por memória/reforço (v1) | Ponto de partida, baseado em Li & Chen | As formigas vão até o POI; moinhos apenas "ocasionais" |
| 2 | 11/09 | `0f61a19` | master | Remove o código do Conway (Jogo da Vida) | Código morto da origem do projeto | O código passa a ser só o modelo de formigas |
| 3 | 18/09 | `03bcb80` | poi-lifespan | A comida (POI) acaba depois de 300 ticks | Comida real é finita | O POI desbota e some |
| 4 | 25/09 | `9531694` | poi-lifespan | Continuar seguindo trilhas depois que o POI acaba | Bug: as formigas paravam de seguir o feromônio quando a comida acabava | Trilhas continuam sendo seguidas |
| 5 | 25/09 | `1016866` | wind-on-pheromone | Só formatação (Prettier) | Deixar legível o diff seguinte | Nenhuma mudança de comportamento |
| 6 | 25/09 | `b2d048a` | wind-on-pheromone | Vento como advecção do feromônio; trilhas A↔B; detector de moinho; execução em lote | Testar a hipótese do vento | **0/120 moinhos**; o vento empurra a colônia contra a parede |
| 7 | 28/09 | `fe297df` | wind-on-pheromone | AGENTS.md versionado | Selecionado por engano | — |
| 8 | 28/09 | `4085dfc` | wind-on-pheromone | AGENTS.md deixa de ser versionado | Manter o arquivo privado | — |
| 9 | 28/09 | `7c124f7` | army-ant-movement | Novo movimento: formiga de correição cega com duas antenas (v2) | O v1 nunca formava moinho e foi considerado irrealista | Anel se mantém 10/10; **moinhos surgem em ~90%** |
| 10 | 28/09 | `6082cec` | army-ant-movement | Experimentos de vento E1–E3 no v2 | Refazer a pergunta com um modelo capaz de formar moinhos | Vento forte mata moinhos; vento fraco → mais moinhos, menores |

---

## 3. Contexto: o moinho de formigas e o artigo

**A biologia.** Formigas de correição são quase cegas e se orientam só pelo feromônio. Cada formiga segue a trilha deixada pelas da frente e deposita a sua própria trilha enquanto anda. Nenhuma formiga sabe onde está o ninho ou a comida. Um moinho (Beebe 1921; Schneirla 1944) acontece quando um grupo perde a trilha principal e a cabeça da coluna encontra a própria cauda. A partir daí o laço fechado se mantém sozinho, porque cada formiga continua fazendo exatamente o que sempre fez.

**O artigo.** Li & Chen, *Exploring the Ant Mill: Numerical and Analytical Investigations of Mixed Memory-Reinforcement Systems* (arXiv:1703.06859), faz duas tentativas de modelar o fenômeno.

1. *Rejeitada:* uma densidade no espaço de fase posição–velocidade, $\rho(\vec x, \theta, t)$. A equação é linear, então não tem solução não trivial e não consegue produzir uma espiral.
2. *Aceita:* um modelo contínuo de fluido com densidade $\rho$, feromônio $g$ e velocidade $\vec v$:

$$
\frac{\partial \rho}{\partial t} + \vec v\cdot\nabla\rho = \nabla\cdot\left(\nabla\rho - \rho\,\frac{\beta}{\alpha+\beta g}\,\nabla g\right)
$$

$$
\frac{\partial g}{\partial t} = \lambda\rho - g
\qquad\qquad
\frac{\partial \vec v}{\partial t} + \vec v\cdot\nabla\vec v = b\,\nabla g
$$

O acoplamento entre densidade e feromônio torna o sistema não linear. Essa não linearidade permite uma solução estacionária em **espiral**, com simetria axial, que o artigo mostra ser estável.

Dois ingredientes a produzem: **reforço**, porque as formigas são puxadas a favor do gradiente de feromônio, e **memória**, porque a velocidade persiste, então as formigas continuam indo para onde já iam.

**Onde este código se encaixa.** A simulação mantém formigas *individuais*, no estilo da primeira tentativa (a rejeitada), mas dá a cada formiga a *lei de força local* do modelo aceito. É uma aproximação lagrangiana, baseada em agentes, de um resultado euleriano e contínuo. Por isso o moinho aqui não é garantido como o estado estacionário do artigo: moinhos se formam, se fundem e se desfazem, com variação de uma execução para outra.

---

## 4. A física e a matemática

### 4.1 O campo de feromônio (reação–difusão)

O feromônio $g(x,y,t)$ fica na grade. Sem vento:

$$
\frac{\partial g}{\partial t} = D\,\nabla^2 g \;+\; \lambda\rho \;-\; \mu g
$$

- $D\nabla^2 g$: difusão, o feromônio se espalhando.
- $\lambda\rho$: depósito, onde $\rho$ é o número de formigas na célula e $\lambda$ é `deposit` = 0,2 por formiga por tick.
- $\mu g$: evaporação, com $\mu$ = `evaporation` = 0,05 por tick.

**Discretização.** Euler explícito com $\Delta t = 1$ tick e $\Delta x = 1$ célula, usando o laplaciano de 5 pontos:

$$
g^{n+1}_{i,j} = g^n_{i,j} + D\left(g_{i+1,j}+g_{i-1,j}+g_{i,j+1}+g_{i,j-1}-4g_{i,j}\right) - \mu\, g_{i,j}
$$

Nas bordas, um vizinho que não existe conta como igual à própria célula, então nenhum feromônio atravessa as paredes (fluxo zero, condição de Neumann).

**Por que é estável.** O coeficiente de $g_{i,j}$ é $1-4D-\mu = 0{,}93 > 0$, e o de cada vizinho é $D>0$. O novo valor é, portanto, uma média ponderada de valores antigos não negativos, menos o decaimento. O feromônio nunca fica negativo nem explode.

**Escalas úteis** (explicam boa parte do comportamento):

| Grandeza | Fórmula | Valor |
|---|---|---|
| Tempo de vida do feromônio | $1/\mu$ | 20 ticks (2 s na tela) |
| Distância de difusão nesse tempo | $\sqrt{D/\mu}$ | 0,32 célula: o feromônio praticamente fica onde foi depositado |
| Nível estacionário sob uma formiga parada | $\lambda(1-\mu)/\mu$ | 3,8 |

Como a difusão é muito fraca, o campo de feromônio é essencialmente **um histórico recente de por onde as formigas andaram**, que se apaga em uns 20 ticks. Uma trilha só sobrevive se as formigas continuarem passando por ela.

### 4.2 Vento: advecção do feromônio

O vento é uma velocidade uniforme $\vec v_w=(v_x,v_y)$ que carrega o feromônio. Isso acrescenta um termo de advecção:

$$
\frac{\partial g}{\partial t} = D\nabla^2 g \;-\; \vec v_w\cdot\nabla g \;+\; \lambda\rho \;-\; \mu g
$$

O vento age **só sobre $g$**. Nenhuma linha do código de movimento lê o vento. A formiga só o percebe pelos valores de feromônio que suas antenas leem. Isso foi verificado: com o depósito desligado, as trajetórias das formigas são idênticas com e sem vento.

**Esquema upwind de primeira ordem.** Em cada eixo, a derivada é tomada do lado de onde o vento vem:

$$
\vec v_w\cdot\nabla g \;\approx\; |v_x|\,(g_{i,j} - g_{\text{upwind},x}) + |v_y|\,(g_{i,j} - g_{\text{upwind},y})
$$

*Por que não diferenças centrais?* Diferenças centrais com Euler explícito são incondicionalmente instáveis para advecção: criam oscilações e concentrações negativas.

**Estabilidade e positividade.** Com o termo upwind, a atualização fica

$$
g^{n+1} = (1-4D-\mu-|v_x|-|v_y|)\,g + (D+|v_x|)\,g_{\text{up},x} + D\,g_{\text{down},x} + (D+|v_y|)\,g_{\text{up},y} + D\,g_{\text{down},y}
$$

Todos os coeficientes são não negativos exatamente quando

$$
|v_x| + |v_y| \;\le\; 1 - 4D - \mu = 0{,}93 \text{ células/tick}
$$

É uma condição do tipo CFL. `advectionVelocity()` reduz qualquer vento mais forte até esse limite, mantendo a direção. Testes de estresse com velocidades pedidas de até $10^6$ continuam finitos e $\ge 0$.

**Bordas.** Ar limpo ($g=0$) entra pela borda de onde o vento vem, e o feromônio sai livremente pela borda oposta.

**Verificações feitas:**
- Com $\vec v_w = 0$, o solver é idêntico bit a bit ao antigo, que só tinha difusão.
- Uma mancha de feromônio perde massa exatamente pelo fator de evaporação $0{,}95^{20}$ em 20 ticks.

**Velocidade de deriva (um pequeno efeito da discretização).** Tome o primeiro momento $M_1=\sum_i i\,g_i$ e a massa $M=\sum_i g_i$ da atualização upwind em 1-D:

$$
M' = (1-\mu)M,\qquad M_1' = (1-\mu)M_1 + v\,M
\;\Rightarrow\;
\bar x' = \bar x + \frac{v}{1-\mu}
$$

Uma mancha, portanto, se desloca $v/(1-\mu)\approx 1{,}05\,v$ células por tick. O valor medido (6,316 células em 20 ticks com $v=0{,}3$) bate exatamente.

**Difusão numérica (uma ressalva importante).** A análise da equação modificada do upwind de primeira ordem, com $\Delta x=\Delta t=1$, dá

$$
g_t + v g_x = \underbrace{\tfrac{1}{2}|v|(1-|v|)}_{D_{\text{num}}}\, g_{xx} + \dots
$$

O próprio esquema borra o campo na direção do vento:

| Vento | $v$ | $D_{\text{num}}$ | vs. $D$ físico $=0{,}005$ |
|---|---|---|---|
| fraco | 0,05 | 0,024 | ~5× |
| moderado | 0,15 | 0,064 | ~13× |
| forte | 0,40 | 0,12 | ~24× |

Parte da "perturbação das trilhas" nos ventos mais fortes é, portanto, borrão numérico, e não transporte real.

**Como as intensidades foram escolhidas.** Uma porção de feromônio vive cerca de $1/\mu$ ticks, então percorre um **comprimento de advecção** $L = v/\mu$:

| Vento | $L$ | Significado |
|---|---|---|
| fraco | ~1 célula | quase não desloca a trilha |
| moderado | ~3 células | cerca de metade da distância entre as duas pistas |
| forte | ~8 células | mais que a distância entre as pistas |

### 4.3 Movimento v1 (commits 1–8): formigas na grade com um alvo de comida

Cada formiga ocupa uma célula da grade. A cada tick:

1. Se está num **voo de Lévy**, continua andando numa direção fixa. O comprimento do voo é $L = U^{-1/(\mu_L-1)}$, com $U$ uniforme, $\mu_L=1{,}5$ e limite de 20. Isso dá uma cauda em lei de potência $P(L>\ell)=\ell^{-(\mu_L-1)}$: muitos voos curtos e alguns muito longos.
2. Senão, **só se existir um POI (comida)**, com probabilidade 0,8 chama `steerTowardTrail`:
   - Gradiente a partir dos 8 vizinhos: $\vec G=\sum_k \hat u_k\,g_k$.
   - Saturado, para que traços fracos não contem: $\vec G_s=\hat G\,\dfrac{|G|}{\alpha+|G|}$. É a ideia do $\beta/(\alpha+\beta g)$ do artigo.
   - Sinal: $\vec S = \text{normaliza}(3\,\vec G_s + 2\,\hat r_{\text{POI}})$.
   - Memória: $\vec d_{\text{novo}}=\text{normaliza}(0{,}5\,\vec d_{\text{antigo}} + 0{,}5\,\vec S + \text{ruído})$.
   - Passa para a célula vizinha mais alinhada com $\vec d_{\text{novo}}$.
3. Senão, dá um passo aleatório em 4 direções, com 1% de chance de começar um voo de Lévy.

**Por que o v1 não conseguia formar moinho** (foi o que o primeiro experimento de vento revelou):

- **Um atrator pontual aponta todas as direções para dentro.** O termo $\hat r_{\text{POI}}$ faz todas as formigas convergirem para a comida e formarem um aglomerado trêmulo. Um moinho precisa de direções *ao longo* de um laço, não em direção ao centro. No cenário clássico, cerca de 60 formigas terminaram a menos de 4 células do POI, com velocidade ~0,3 e nenhuma rotação.
- **Sem POI, não havia seguimento de trilha** (`followChance` = 0), então o feromônio era ignorado até alguém colocar comida.
- **Passos na grade** só traçam "escadinhas" em 8 direções, e não círculos suaves.
- **Memória fraca.** Com `memoryWeight` = 0,5, a direção esquece metade de si mesma a cada tick.

### 4.4 Movimento v2 (commits 9–10): a formiga de correição cega

**Estado.** Uma posição contínua $(x,y)$ em unidades de célula e uma direção $\theta$. A direção é **toda a memória** da formiga.

**Da lei de força do artigo a uma regra de virada.** O artigo muda a velocidade por $\partial\vec v/\partial t = b\nabla g$. Se a velocidade escalar $s$ é constante, a componente de $b\nabla g$ ao longo da direção não altera o movimento; só a componente perpendicular altera. Chamando de $\hat n$ a normal à esquerda da formiga:

$$
\frac{d\theta}{dt} = \frac{b}{s}\,\left(\nabla g\cdot\hat n\right)
$$

**As antenas medem exatamente isso.** Dois sensores ficam $d$ = 3 células à frente, a $\pm\varphi$ = ±45°. Em primeira ordem:

$$
g_E - g_D \;\approx\; 2d\sin\varphi\;(\nabla g\cdot\hat n)
$$

($E$ = antena esquerda, $D$ = direita.) As antenas ficam a 4,2 células uma da outra. As leituras são interpoladas bilinearmente entre os centros das células, para que a diferença varie suavemente em vez de saltar quando uma antena cruza a borda de uma célula. Nada atrás da formiga é percebido, então a trilha que ela acabou de deixar não a puxa para trás.

**A regra que o código aplica a cada tick:**

$$
\Delta\theta = \operatorname{clamp}\!\left(b\,\frac{g_E-g_D}{\alpha+g_E+g_D},\;\pm\theta_{\max}\right) + \sigma\,\xi,\qquad \xi\sim\mathcal N(0,1)
$$

| Símbolo | Parâmetro | Padrão | Papel |
|---|---|---|---|
| $b$ | `turnGain` | 1 | força da virada em direção à antena mais forte |
| $\alpha$ | `turnSaturation` | 0,05 | abaixo disso, diferenças pesam pouco (a saturação do artigo) |
| $\theta_{\max}$ | `maxTurn` | 0,5 rad | raio mínimo de curva $s/\theta_{\max}$ = 2 células |
| $\sigma$ | `turnNoise` | 0,1 rad | ruído aleatório na direção a cada tick |
| $s$ | `speed` | 1 célula/tick | constante; as formigas nunca param |

Depois a formiga anda $s$ na direção $\theta$. Paredes e obstáculos refletem a direção como um espelho reflete a luz: a componente da velocidade que atravessaria a parede é invertida.

**Por que isso pode formar um moinho sem nada "de moinho" no código:**

- **Simetria.** A regra não muda se trocarmos esquerda por direita. Nenhum sentido de rotação é favorecido, e nenhum centro ou círculo aparece em lugar nenhum. Um moinho só pode surgir quando uma trilha *se fecha sobre si mesma*.
- **Um anel é autoconsistente.** Uma formiga numa trilha circular de raio $R$ precisa virar $s/R$ por tick para continuar nela. Numa trilha curva, a antena de dentro fica mais perto da trilha que a de fora, então $g_{\text{dentro}}>g_{\text{fora}}$ e a formiga vira para dentro. Como a virada é proporcional ao desequilíbrio, a persistência da direção e o puxão lateral da trilha conseguem se equilibrar. Isso exige $\theta_{\max}\ge s/R$. Para $R$ = 15, a virada necessária é 0,067 rad por tick, bem abaixo de 0,5.
- **Realimentação positiva.** Formigas seguem trilhas, seguir deposita mais feromônio, e trilhas mais fortes atraem mais formigas. Trilhas abertas evaporam em uns 20 ticks se ninguém passar, enquanto um laço fechado é percorrido continuamente. Por isso os laços vencem as trilhas abertas. É o "reforço" do artigo.
- **O ruído é o parâmetro de controle.** O ruído na direção funciona como uma difusão rotacional. A direção de uma formiga livre se descorrelaciona como $e^{-\sigma^2 t/2}$, então o seu **comprimento de persistência** é $\ell_p = 2s/\sigma^2$:

| $\sigma$ | $\ell_p$ | Resultado medido |
|---|---|---|
| 0,1 | 200 células | moinhos se formam |
| 0,2 | 50 células | moinhos se formam |
| 0,3 | 22 células | a maioria dos moinhos colapsa |

Um moinho típico tem circunferência $2\pi\cdot23\approx145$ células. Quando o ruído faz a formiga perder a direção em bem menos que uma volta, seguir a trilha não basta para segurá-la. É uma explicação heurística (ignora o puxão de volta da trilha), mas bate com as medições.

### 4.5 Detectando um moinho (`millMetrics.ts`)

O detector só observa; nunca interfere na simulação.

**Por que não o parâmetro de ordem clássico?** O parâmetro de ordem rotacional padrão (Couzin et al. 2002) é

$$
O_r = \left|\frac{1}{N}\sum_i \hat r_i\times\hat v_i\right|
$$

em que $\hat r_i$ aponta do centro para a formiga $i$ e $\hat v_i$ é a direção do seu movimento. Em torno de um centro arbitrário $c$, até uma translação pura dá $\sum_i(\vec r_i-c)\times\vec v = N(\bar r - c)\times\vec v\ne0$. Em particular, duas **pistas retas em sentidos opostos**, a própria condição inicial do experimento de vento, marcam cerca de 0,3 sem que ninguém esteja andando em círculo. Sozinho, $O_r$ acusaria moinhos falsos.

**Detector em duas etapas:**

1. **Cada formiga está mesmo dando voltas?** A direção dela é a do seu deslocamento líquido em 5 ticks. O detector acumula o quanto essa direção gira numa janela exponencial de $W$ = 300 ticks:
   $$w_i \leftarrow w_i\left(1-\tfrac1W\right)+\Delta\theta_i$$
   A formiga está *dando voltas* se $|w_i|\ge 2\pi$ (uma volta completa) **e** $|w_i| \ge 0{,}3\sum|\Delta\theta_i|$ (girou principalmente para um lado). Viradas acima de 60° num único tick são inversões e são ignoradas, em vez de contar como ±π; sem essa regra, formigas indo e voltando acumulavam rotação falsa.
2. **Elas giram juntas?** Tome as formigas que dão voltas no sentido majoritário (as *participantes*) e o centroide delas. O *alinhamento* é a fração das participantes cujo momento angular em torno desse centroide tem o sentido do giro. O estado é **girando** quando há ≥ 15 participantes e alinhamento ≥ 0,8. Laços independentes espalhados pela grade ficam perto de 0,5.

Uma execução conta como **"formou moinho"** quando um episódio contínuo de giro completa ≥ 1 volta inteira.

**Calibração contra respostas conhecidas:**

| Situação | Resultado |
|---|---|
| Moinhos circulares sintéticos (15–40 formigas, raio 4–15), um moinho à deriva, um aglomerado correndo em volta de um anel, um circuito oval em volta das duas pistas | Detectados; contagem de participantes exata (ex.: 40/40, raio 7,7 para um raio real de 8) |
| Pistas em sentidos opostos, laços independentes espalhados, passeios aleatórios puros | Nunca acusados |
| Moinhos de raio ≥ 20 | Detectados só em parte |

### 4.6 Estatística

- **Desenho pareado.** A execução $r$ de cada intensidade de vento usa a mesma semente. As condições iniciais são idênticas; só a dinâmica aleatória muda.
- **Proporção de execuções com moinho:** intervalo de Wilson de 95%
  $$\frac{\hat p + \frac{z^2}{2n} \pm z\sqrt{\frac{\hat p(1-\hat p)}{n}+\frac{z^2}{4n^2}}}{1+\frac{z^2}{n}},\qquad z=1{,}96$$
- **Vento vs. sem vento, mesmas sementes: teste exato de McNemar.** Só contam as sementes cujo resultado mudou: $b$ perderam o moinho, $c$ ganharam.
  $$p = \min\!\left(1,\;2\sum_{k=0}^{\min(b,c)}\binom{b+c}{k}2^{-(b+c)}\right)$$
  Exemplo: vento fraco agregado, 5 perdidos e 19 ganhos, dá $p = 2\cdot 55455/2^{24} \approx 0{,}007$.
- **Métricas contínuas:** média ± erro padrão $s/\sqrt n$, e diferenças pareadas nas colunas Δ.

---

## 5. Commit a commit

### 1 · `54fd7bd` — Commit inicial (11/09/2026, master)
- **Conceito:** um autômato celular em canvas com campo de feromônio (difusão + evaporação + depósito) e formigas guiadas por memória e reforço até um ponto de interesse, com passeio aleatório e voos de Lévy para explorar. É o movimento v1, §4.3.
- **Por quê:** ponto de partida, baseado livremente em Li & Chen.
- **Resultado:** as formigas encontram a comida e se amontoam nela. O moinho era descrito como "um punhado de formigas circulando um obstáculo por um tempo". Isso nunca foi medido, e o detector criado depois não encontrou nenhum moinho duradouro com esse modelo.

### 2 · `0f61a19` — Remove o código do Conway (11/09/2026, master)
- **Conceito:** apaga as regras do Jogo da Vida que não eram usadas, a interface `Rules` e `Cell.alive`.
- **Por quê:** sobra da origem do projeto; só o modelo de formigas roda.
- **Resultado:** código mais simples, sem mudança de comportamento.

### 3 · `03bcb80` — Comida que acaba (18/09/2026, poi-lifespan)
- **Conceito:** cada POI tem um tempo de vida (padrão 300 ticks). Ele desbota enquanto se esgota e depois some.
- **Por quê:** fontes de comida reais são finitas.
- **Resultado:** os POIs somem com o tempo. Isso expôs o bug corrigido no commit seguinte.

### 4 · `9531694` — Continuar seguindo trilhas depois que a comida acaba (25/09/2026, poi-lifespan)
- **Conceito:** a regra "só segue trilhas se existir um POI" virou "só se *já tiver existido* um POI".
- **Por quê:** quando o último POI acabava, a probabilidade de seguir caía para 0 e as formigas ignoravam uma trilha já estabelecida.
- **Resultado:** as trilhas continuam sendo seguidas depois que a comida acaba. *Esta branch nunca foi integrada, e o movimento v2 depois removeu os POIs de vez.*

### 5 · `1016866` — Formatação com Prettier (25/09/2026, wind-on-pheromone)
- **Conceito / por quê:** só formatação, para que o diff do commit seguinte mostre apenas mudanças reais.
- **Resultado:** nenhuma mudança de comportamento.

### 6 · `b2d048a` — Plataforma do experimento de vento (25/09/2026, wind-on-pheromone)
- **Conceito:**
  - vento como advecção do feromônio, com o esquema upwind e o limite de estabilidade da §4.2;
  - pistas A→B / B→A geradas com semente;
  - o detector de moinho da §4.5;
  - execução pareada em lote sem navegador (`npm run experiment`);
  - na tela: seta do vento, painel de métricas, teclas 1–4.
- **Por quê:** testar se a perturbação das trilhas pelo vento favorece moinhos, com o vento agindo só sobre o feromônio.
- **Validação:**
  - sem vento, o código antigo é reproduzido exatamente;
  - o vento nunca move as formigas diretamente;
  - o feromônio fica $\ge 0$ e finito;
  - passeio aleatório, voos de Lévy, memória, obstáculos e POIs continuam funcionando.
- **Resultado (piloto, 10 execuções pareadas × 4 ventos × 3 layouts de obstáculo):** **0/10 moinhos em todas as condições.** O vento carregou todo o sistema de trilhas a favor do vento, mais ou menos na velocidade do vento, até a colônia ficar presa contra a parede. Um vento cruzado também quebrou as duas pistas em aglomerados que derivavam. A conclusão foi que o gargalo era o modelo, e não o vento.

### 7–8 · `fe297df`, `4085dfc` — AGENTS.md (28/09/2026, wind-on-pheromone)
- **Conceito / por quê:** um arquivo local de orientações para outra ferramenta foi versionado por engano e depois retirado.
- **Resultado:** nenhuma mudança de código. O arquivo continua só local, excluído do git.

### 9 · `7c124f7` — Movimento de formiga de correição (28/09/2026, army-ant-movement)
- **Conceito:** o movimento v2 da §4.4 (posição contínua, velocidade constante, duas antenas, virada proporcional com saturação, ruído na direção, paredes que refletem). Removidos o POI, os voos de Lévy e as fases de passeio aleatório. Adicionados cenários neutros de teste (`random`, `column`, `ring`) e `npm run movement` com varreduras de parâmetros.
- **Por quê:** o v1 nunca formava moinho e foi considerado irrealista para formigas de correição, que são cegas, estão sempre andando e só seguem trilhas. O objetivo era ter uma base neutra capaz de formar moinhos antes de estudar perturbações.
- **Resultados:**
  - **Teste A** (`ring`, o único moinho *semeado*): se mantém em 10/10 execuções, com as 200 formigas participando por cerca de 28 voltas. Mostra que a regra consegue sustentar um moinho.
  - **Teste B** (`random`: posições e direções aleatórias, *sem feromônio*): um moinho se forma em **10/10** execuções, com a primeira volta depois de 510 ± 126 ticks e 73% das formigas em colunas. Aqui o moinho **emerge**.
  - **Robustez:** moinhos se formam em 8–9 de 10 execuções para $b\in\{0{,}5;\,1;\,2\}$ com $\sigma\le0{,}2$. Com $\sigma=0{,}3$ caem para 0–5 de 10, então o ruído é o parâmetro de controle (§4.4).

### 10 · `6082cec` — Experimentos de vento no movimento de correição (28/09/2026, army-ant-movement)
- **Conceito:** adicionados diagnósticos de raio do moinho e de contato com a parede, e três experimentos pareados com vento cruzado e sem obstáculos.
- **Por quê:** refazer a pergunta do vento com um modelo que realmente forma moinhos.
- **Resultados:**

**E1 — o vento destrói um moinho existente?** (`ring`, 20 execuções × 2000 ticks)

| Vento | Moinho (≥ 1 volta) | Girando, último quarto | Voltas | Formigas perto das paredes |
|---|---|---|---|---|
| nenhum | 20/20 | 100% | 27,6 | 0% |
| fraco | 20/20 | 43 ± 7% | 14,3 | 10% |
| moderado | 20/20 | 33 ± 5% | 4,2 | 15% |
| forte | 5/20 (p < 0,001) | 6 ± 3% | 0,7 | 19% |

**E2 — moinhos do zero, parâmetros padrão** (`random`, 40 execuções × 3000 ticks)

| Vento | Moinhos | Perdidos / ganhos, p | % girando (Δ pareado) | Raio do moinho | Moinho tocando a parede |
|---|---|---|---|---|---|
| nenhum | 33/40 | | 46 ± 4 | 23 ± 1 | 42 ± 5% |
| fraco | 39/40 | 1 / 7; 0,07 | 45 ± 2 (−1 ± 5) | 15 ± 0,4 | 61 ± 3% |
| moderado | 37/40 | 3 / 7; 0,34 | 30 ± 2 (−16 ± 5) | 13 ± 0,5 | 58 ± 2% |
| forte | 10/40 | 27 / 4; < 0,001 | 9 ± 1 (−37 ± 4) | 12 ± 0,6 | 62 ± 2% |

**E3 — moinhos do zero onde eles são raros** ($\sigma$ = 0,3, 40 execuções × 3000 ticks)

| Vento | Moinhos | Perdidos / ganhos, p | % girando (Δ pareado) | Raio do moinho | Moinho tocando a parede |
|---|---|---|---|---|---|
| nenhum | 21/40 | | 23 ± 4 | 22 ± 1,5 | 38 ± 5% |
| fraco | 29/40 | 4 / 12; 0,08 | 19 ± 2 (−4 ± 4) | 16 ± 0,6 | 71 ± 4% |
| moderado | 16/40 | 12 / 7; 0,36 | 6 ± 1 (−16 ± 4) | 16 ± 1,0 | 75 ± 4% |
| forte | 0/40 | 21 / 0; < 0,001 | 0,3 ± 0,1 (−22 ± 4) | 28 ± 1,1 | 90 ± 5% |

---

## 6. O que os resultados significam

1. **Um moinho pode emergir de um seguimento de trilha puramente local e simétrico.** Com o movimento v2, formigas aleatórias sem nenhuma trilha inicial se organizam sozinhas em colunas, depois em laços, e em geral num único moinho grande. Nenhuma linha de código fala em rotação. Isso reproduz, num modelo de agentes, a afirmação qualitativa de Li & Chen de que memória mais reforço produz uma circulação que se sustenta sozinha.
2. **Vento forte suprime moinhos** em todos os experimentos. Ele destrói um moinho existente (E1), quase impede novos (E2: 10/40; E3: 0/40) e reduz o tempo girando. Fisicamente, o comprimento de advecção $v/\mu\approx8$ células é maior que a estrutura de uma trilha, então a trilha já não fica onde as formigas andaram.
3. **Vento fraco torna um *episódio* de moinho mais provável.** Somando E2 e E3, 5 sementes perderam o moinho e 19 ganharam ($p\approx0{,}007$). Mas esses moinhos são menores (raio ~15 contra ~23) e duram menos, e o tempo total girando não aumenta. **O vento produz moinhos mais frequentes, mais curtos e menores, não mais tempo em moinho.**
4. **As paredes são um fator de confusão.** Sem vento, moinhos de raio ~23 numa arena de 100 células tocam uma parede cerca de 40% do tempo; com vento isso sobe para 60–90%, porque a colônia é empurrada contra a parede a favor do vento. O aumento com vento fraco, portanto, **ainda não pode ser atribuído ao vento agindo sobre as trilhas**, e não aos laços presos contra a parede.

**Resposta à pergunta até aqui:** o vento é principalmente **destrutivo** para os moinhos. O único indício de efeito favorável (vento fraco) é estatisticamente real, mas está misturado com o efeito da borda da arena.

---

## 7. Limitações

- **Modelo de agentes, não as EDPs do artigo.** O moinho não tem garantia de ser estacionário; há variação entre execuções.
- **As constantes** foram escolhidas por raciocínio mais varreduras de parâmetros, não deduzidas do artigo.
- **Arena pequena e fechada.** As paredes refletem as formigas, os moinhos as tocam com frequência, e um vento constante leva tudo contra uma parede.
- **Difusão numérica.** O upwind de primeira ordem acrescenta 5–24× a difusão física nas intensidades de vento usadas (§4.2).
- **Vento idealizado.** É uniforme e atravessa obstáculos: sem esteira, sem rajadas.
- **Sem aglomeração física.** As formigas não se excluem (uma célula comporta qualquer número delas), e o raio mínimo de curva de 2 células permite "bolas" apertadas de formigas girando, menores que moinhos reais.
- **O detector é uma heurística calibrada.** Exige ≥ 15 participantes e detecta só em parte moinhos de raio ≥ 20.

## 8. Próximos passos sugeridos

- **Eliminar o efeito das paredes:** usar bordas periódicas (a arena "dá a volta"), o que exige que o detector desfaça essa volta nas posições, ou uma arena muito maior que um moinho. Depois refazer E2 e E3.
- **Separar transporte de borrão:** incluir um controle com a mesma difusão extra, mas sem vento, ou usar um esquema de segunda ordem com limitador de fluxo, menos difusivo.
- **Perturbar sem empurrar:** usar vento em rajadas ou oscilante com média zero, para perturbar as trilhas sem jogar a colônia contra uma parede.
- **Definir a base:** decidir se a taxa de ~80–90% de moinhos sem vento é alta demais, e usar `turnNoise` como controle (0,3 dá ~50%).
- **Obstáculos:** só reintroduzi-los depois que a base neutra estiver definida.

## 9. Como reproduzir os resultados

```
git checkout army-ant-movement
npm install
npm run movement -- --scenario ring   --runs 10                       # Teste A
npm run movement -- --scenario random --runs 10 --ticks 3000          # Teste B
npm run movement -- --scenario random --runs 10 --ticks 3000 \
  --sweep turnGain=0.5,1,2 --sweep turnNoise=0.05,0.1,0.2,0.3         # robustez
npm run experiment -- --scenario ring   --runs 20 --ticks 2000        # E1
npm run experiment -- --scenario random --runs 40 --ticks 3000        # E2
npm run experiment -- --scenario random --runs 40 --ticks 3000 --set turnNoise=0.3   # E3
npm run dev    # depois abra /?scenario=random e use as teclas 1–4 para os ventos
```
