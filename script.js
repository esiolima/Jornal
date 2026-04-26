function processarPlanilha() {
  const file = document.getElementById('upload').files[0];

  if (!file) {
    alert("Selecione uma planilha");
    return;
  }

  const reader = new FileReader();

  reader.onload = function(e) {
    const data = new Uint8Array(e.target.result);
    const workbook = XLSX.read(data, { type: 'array' });

    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(sheet);

    const dadosNormalizados = normalizarDados(json);

    console.log("DADOS NORMALIZADOS:", dadosNormalizados);

    gerarCards(dadosNormalizados);
  };

  reader.readAsArrayBuffer(file);
}

/* ========================= */
/* NORMALIZAÇÃO DE DADOS */
/* ========================= */

function normalizarDados(dados) {
  return dados.map(item => {

    const obj = {};

    for (let chave in item) {

      const chaveLimpa = chave
        .toString()
        .normalize("NFD") // remove acentos
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, '') // remove espaços invisíveis
        .toUpperCase();

      obj[chaveLimpa] = item[chave];
    }

    console.log("Colunas detectadas:", Object.keys(obj));

    return {
      TIPO: limparTexto(obj.TIPO),
      LOGO: obj.LOGO || "",
      SELO: obj.SELO || "",
      CUPOM: obj.CUPOM || "",
      TEXTO: obj.TEXTO || "",
      VALOR: obj.VALOR || "",
      COMPLEMENTO: obj.COMPLEMENTO || "",
      LEGAL: obj.LEGAL || "",
      URN: obj.URN || "",
      UF: obj.UF || "",
      SEGMENTO: limparCampo(
        obj.SEGMENTO || obj.SEGMENTO1 || obj.SEGMENTO_1 || ""
      )
    };
  });
}

/* ========================= */
/* LIMPEZA DE TEXTO */
/* ========================= */

function limparTexto(valor) {
  if (!valor) return "";

  return valor
    .toString()
    .trim()
    .toUpperCase();
}

function limparCampo(valor) {
  if (!valor) return "";

  return valor
    .toString()
    .trim()
    .replace(/\s+/g, ' ');
}

/* ========================= */
/* GERAÇÃO DOS CARDS */
/* ========================= */

async function gerarCards(dados) {
  const container = document.getElementById('jornal');
  container.innerHTML = "Gerando...";

  let htmlFinal = "";

  for (const item of dados) {

    if (!item.TIPO) continue;

    const templateFile = mapearTemplate(item.TIPO);

    if (!templateFile) continue;

    try {
      const response = await fetch(`templates/${templateFile}`);
      let template = await response.text();

      template = substituirCampos(template, item);

      htmlFinal += criarIframe(template);

    } catch (erro) {
      console.error("Erro ao carregar template:", erro);
    }
  }

  container.innerHTML = htmlFinal;
}

/* ========================= */
/* MAPEAMENTO DE TEMPLATE */
/* ========================= */

function mapearTemplate(tipo) {
  const mapa = {
    PROMO: "promocao.html",
    PROMOCAO: "promocao.html",
    CUPOM: "cupom.html",
    BC: "bc.html",
    QUEDA: "queda.html",
    CASHBACK: "cashback.html"
  };

  return mapa[tipo] || null;
}

/* ========================= */
/* SUBSTITUIÇÃO DE CAMPOS */
/* ========================= */

function substituirCampos(template, item) {
  return template
    .replaceAll('{{LOGO}}', item.LOGO)
    .replaceAll('{{TEXTO}}', item.TEXTO)
    .replaceAll('{{VALOR}}', item.VALOR)
    .replaceAll('{{COMPLEMENTO}}', item.COMPLEMENTO)
    .replaceAll('{{LEGAL}}', item.LEGAL)
    .replaceAll('{{UF}}', item.UF)
    .replaceAll('{{URN}}', item.URN)
    .replaceAll('{{SEGMENTO}}', item.SEGMENTO)
    .replaceAll('{{SELO}}', item.SELO)
    .replaceAll('{{CUPOM}}', item.CUPOM);
}

/* ========================= */
/* IFRAME */
/* ========================= */

function criarIframe(html) {
  const encoded = encodeURIComponent(html);

  return `
    <iframe src="data:text/html;charset=utf-8,${encoded}"></iframe>
  `;
}
