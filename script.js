function processarPlanilha() {
  const fileInput = document.getElementById('upload');
  const file = fileInput.files[0];

  if (!file) {
    alert("Selecione uma planilha.");
    return;
  }

  const reader = new FileReader();

  reader.onload = function(event) {
    const data = new Uint8Array(event.target.result);

    const workbook = XLSX.read(data, { type: 'array' });

    const primeiraAba = workbook.SheetNames[0];
    const sheet = workbook.Sheets[primeiraAba];

    const json = XLSX.utils.sheet_to_json(sheet);

    console.log("Dados lidos:", json);

    mostrarCards(json);
  };

  reader.readAsArrayBuffer(file);
}

async function mostrarCards(dados) {
  const container = document.getElementById('cards');

  // limpar antes
  container.innerHTML = "Carregando cards...";

  try {
    // carregar template
    const response = await fetch('templates/card.html');
    const template = await response.text();

    let htmlFinal = "";

    dados.forEach(item => {
      let card = template;

      const nome = item.NOME || item.PRODUTO || "Produto";
      const preco = item.PRECO || item.VALOR || 0;
      const categoria = item.CATEGORIA || "";

      card = card.replace('{{NOME}}', nome);
      card = card.replace('{{PRECO}}', formatarPreco(preco));
      card = card.replace('{{CATEGORIA}}', categoria);

      htmlFinal += card;
    });

    container.innerHTML = htmlFinal;

  } catch (erro) {
    console.error("Erro ao carregar template:", erro);
    container.innerHTML = "<p>Erro ao gerar os cards.</p>";
  }
}

function formatarPreco(valor) {
  const numero = Number(valor);

  if (isNaN(numero)) return "0,00";

  return numero
    .toFixed(2)
    .replace('.', ',');
}
