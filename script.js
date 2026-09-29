//Configuração da simulação 
const TEMPO_TOTAL = 60;                                  // min
const PASSO = 0.05;                                      // min
const NUM_PASSOS = Math.round(TEMPO_TOTAL / PASSO);
const INTERVALO_TABELA = 10;                             // min

// Última simulação 
let simulacaoAtual = null;

// ===== Elementos da página =====
const formulario = document.getElementById("formulario");
const inputK = document.getElementById("input-k");
const inputAmbiente = document.getElementById("input-ambiente");
const inputInicial = document.getElementById("input-inicial");
const mensagemErro = document.getElementById("mensagem-erro");
const areaResultados = document.getElementById("resultados");
const resFinal = document.getElementById("res-final");
const resDiferenca = document.getElementById("res-diferenca");
const resErro = document.getElementById("res-erro");
const tabelaCorpo = document.getElementById("tabela-corpo");
const canvas = document.getElementById("grafico");


// ===== Matemática =====

/** Solução analítica: T(t) = T_amb + (T0 - T_amb) * e^(-k t) */
function solucaoAnalitica(t, k, tAmb, t0) {
  return tAmb + (t0 - tAmb) * Math.exp(-k * t);
}

/** Resolve dT/dt = -k (T - T_amb) com Runge-Kutta de 4ª ordem. */
function resolverNumericamente(k, tAmb, t0) {
  const derivada = (T) => -k * (T - tAmb);
  const valores = [t0];

  for (let i = 0; i < NUM_PASSOS; i++) {
    const T = valores[i];
    const k1 = derivada(T);
    const k2 = derivada(T + (PASSO * k1) / 2);
    const k3 = derivada(T + (PASSO * k2) / 2);
    const k4 = derivada(T + PASSO * k3);
    valores.push(T + (PASSO * (k1 + 2 * k2 + 2 * k3 + k4)) / 6);
  }
  return valores;
}

/** Executa a simulação completa e compara com a solução analítica. */
function simular(k, tAmb, t0) {
  const numerica = resolverNumericamente(k, tAmb, t0);
  const analitica = numerica.map((_, i) => solucaoAnalitica(i * PASSO, k, tAmb, t0));
  const erroMaximo = Math.max(...numerica.map((v, i) => Math.abs(v - analitica[i])));

  return { k, tAmb, t0, numerica, analitica, erroMaximo };
}


// resultados e tabela 

function preencherIndicadores({ numerica, tAmb, erroMaximo }) {
  const final = numerica[NUM_PASSOS];
  resFinal.textContent = `${final.toFixed(2)} °C`;
  resDiferenca.textContent = `${Math.abs(final - tAmb).toFixed(2)} °C`;
  resErro.textContent = erroMaximo.toExponential(2);
}

function preencherTabela({ numerica, analitica }) {
  tabelaCorpo.innerHTML = "";

  for (let minuto = 0; minuto <= TEMPO_TOTAL; minuto += INTERVALO_TABELA) {
    const i = Math.round(minuto / PASSO);
    const linha = document.createElement("tr");
    linha.innerHTML = `
      <td>${minuto}</td>
      <td>${numerica[i].toFixed(2)}</td>
      <td>${analitica[i].toFixed(2)}</td>`;
    tabelaCorpo.appendChild(linha);
  }
}


// Interface: gráfico 

function corCss(nome) {
  return getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
}

function desenharGrafico() {
  if (!simulacaoAtual) return;

  const { numerica, tAmb } = simulacaoAtual;

  // Ajusta a resolução do canvas para telas de alta densidade
  const escala = window.devicePixelRatio || 1;
  const largura = canvas.clientWidth;
  const altura = canvas.clientHeight;
  canvas.width = largura * escala;
  canvas.height = altura * escala;

  const ctx = canvas.getContext("2d");
  ctx.setTransform(escala, 0, 0, escala, 0, 0);
  ctx.clearRect(0, 0, largura, altura);

  // Margens e conversão de valores para pixels
  const margem = { esquerda: 52, direita: 16, topo: 14, base: 40 };
  const areaLargura = largura - margem.esquerda - margem.direita;
  const areaAltura = altura - margem.topo - margem.base;

  let yMin = Math.min(tAmb, ...numerica);
  let yMax = Math.max(tAmb, ...numerica);
  if (yMax - yMin < 1) { yMin -= 1; yMax += 1; }
  const folga = (yMax - yMin) * 0.08;
  yMin -= folga;
  yMax += folga;

  const paraX = (t) => margem.esquerda + (t / TEMPO_TOTAL) * areaLargura;
  const paraY = (v) => margem.topo + (1 - (v - yMin) / (yMax - yMin)) * areaAltura;

  desenharEixos(ctx, { largura, altura, margem, yMin, yMax, paraX, paraY });
  desenharLinhaAmbiente(ctx, { largura, margem, tAmb, paraY });
  desenharCurva(ctx, { numerica, paraX, paraY });
}

function desenharEixos(ctx, { largura, altura, margem, yMin, yMax, paraX, paraY }) {
  ctx.font = "12px system-ui, sans-serif";
  ctx.lineWidth = 1;
  ctx.strokeStyle = corCss("--borda");
  ctx.fillStyle = corCss("--texto-suave");

  // Eixo x: tempo
  ctx.textAlign = "center";
  for (let t = 0; t <= TEMPO_TOTAL; t += 10) {
    const x = paraX(t);
    ctx.beginPath();
    ctx.moveTo(x, margem.topo);
    ctx.lineTo(x, altura - margem.base);
    ctx.stroke();
    ctx.fillText(t, x, altura - margem.base + 16);
  }
  ctx.fillText("tempo (min)", (margem.esquerda + largura - margem.direita) / 2, altura - 6);

  // Eixo y: temperatura
  ctx.textAlign = "right";
  for (let i = 0; i <= 5; i++) {
    const valor = yMin + ((yMax - yMin) * i) / 5;
    const y = paraY(valor);
    ctx.beginPath();
    ctx.moveTo(margem.esquerda, y);
    ctx.lineTo(largura - margem.direita, y);
    ctx.stroke();
    ctx.fillText(valor.toFixed(0), margem.esquerda - 8, y + 4);
  }

  ctx.save();
  ctx.translate(13, (margem.topo + altura - margem.base) / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = "center";
  ctx.fillText("temperatura (°C)", 0, 0);
  ctx.restore();
}

function desenharLinhaAmbiente(ctx, { largura, margem, tAmb, paraY }) {
  const y = paraY(tAmb);

  ctx.setLineDash([6, 5]);
  ctx.strokeStyle = corCss("--ambiente");
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(margem.esquerda, y);
  ctx.lineTo(largura - margem.direita, y);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = corCss("--ambiente");
  ctx.textAlign = "right";
  ctx.fillText("Temp. ambiente", largura - margem.direita - 4, y - 6);
}

function desenharCurva(ctx, { numerica, paraX, paraY }) {
  ctx.strokeStyle = corCss("--destaque");
  ctx.lineWidth = 2.5;
  ctx.lineJoin = "round";
  ctx.beginPath();

  // Usa 1 a cada 4 pontos
  for (let i = 0; i <= NUM_PASSOS; i += 4) {
    const x = paraX(i * PASSO);
    const y = paraY(numerica[i]);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}


//  Eventos 

formulario.addEventListener("submit", (evento) => {
  evento.preventDefault();

  const k = parseFloat(inputK.value);
  const tAmb = parseFloat(inputAmbiente.value);
  const t0 = parseFloat(inputInicial.value);

  if ([k, tAmb, t0].some(Number.isNaN)) {
    mensagemErro.textContent = "Preencha todos os campos com números válidos.";
    return;
  }
  if (k <= 0) {
    mensagemErro.textContent = "A constante k deve ser maior que zero.";
    return;
  }
  mensagemErro.textContent = "";

  simulacaoAtual = simular(k, tAmb, t0);
  areaResultados.hidden = false;
  preencherIndicadores(simulacaoAtual);
  preencherTabela(simulacaoAtual);
  desenharGrafico();
});

// Redesenha o gráfico ao redimensionar a janela ou trocar o tema
window.addEventListener("resize", desenharGrafico);
window
  .matchMedia("(prefers-color-scheme: dark)")
  .addEventListener("change", desenharGrafico);
