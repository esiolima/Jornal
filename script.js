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

    gerarCards(json);
  };

  reader.readAsArrayBuffer(file);
}

async function gerarCards(dados) {
  const container = document.getElementById('jornal');
  container.innerHTML = "Gerando...";

  let htmlFinal = "";

  for (const item of dados) {

    const tipo = (item.TIPO || "").toUpperCase();

    const templateFile = mapearTemplate(tipo);

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
    .replaceAll('{{LOGO}}', item.LOGO || '')
    .replaceAll('{{TEXTO}}', item.TEXTO || '')
    .replaceAll('{{VALOR}}', item.VALOR || '')
    .replaceAll('{{COMPLEMENTO}}', item.COMPLEMENTO || '')
    .replaceAll('{{LEGAL}}', item.LEGAL || '')
    .replaceAll('{{UF}}', item.UF || '')
    .replaceAll('{{URN}}', item.URN || '')
    .replaceAll('{{SEGMENTO}}', item.SEGMENTO || '')
    .replaceAll('{{SELO}}', item.SELO || '')
    .replaceAll('{{CUPOM}}', item.CUPOM || '');
}

function criarIframe(html) {
  const encoded = encodeURIComponent(html);

  return `
    <iframe src="data:text/html;charset=utf-8,${encoded}"></iframe>
  `;
}
