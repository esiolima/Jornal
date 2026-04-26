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

    console.log("Normalizado:", dadosNormalizados);

    gerarCards(dadosNormalizados);
  };

  reader.readAsArrayBuffer(file);
}

function normalizarDados(dados) {
  return dados.map(item => {

    const obj = {};

    for (let chave in item) {
      const chaveLimpa = chave
        .toString()
        .trim()
        .toUpperCase();

      obj[chaveLimpa] = item[chave];
    }

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
      SEGMENTO: obj.SEGMENTO || ""
    };
  });
}

function limparTexto(valor) {
  if (!valor) return "";
  return valor.toString().trim().toUpperCase();
}

async function gerarCards(dados) {
  const container = document.getElementById('jornal');
  container.innerHTML = "Gerando...";

  let htmlFinal = "";

  for (const item of dados) {

    if (!item.TIPO) continue;

    const templateFile = mapearTemplate(item.TIPO);

    if (!templateFile) continue;

    const response = await fetch(`templates/${templateFile}`);
    let template = await response.text();

    template = substituirCampos(template, item);

    htmlFinal += criarIframe(template);
  }

  container.innerHTML = htmlFinal;
}

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

function criarIframe(html) {
  const encoded = encodeURIComponent(html);

  return `
    <iframe src="data:text/html;charset=utf-8,${encoded}"></iframe>
  `;
}
