function gerarHTML() {
  const fileInput = document.getElementById('upload');
  const file = fileInput.files[0];

  if (!file) {
    alert("Por favor, faça o upload de uma planilha.");
    return;
  }

  const reader = new FileReader();

  reader.onload = function (e) {
    console.log("Arquivo carregado com sucesso.");

    const data = new Uint8Array(e.target.result);
    const workbook = XLSX.read(data, { type: 'array' });

    console.log("Planilha carregada:", workbook); // Verificar se a planilha foi carregada

    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(sheet);

    console.log("Dados lidos da planilha:", jsonData); // Verificar se os dados foram lidos

    if (!jsonData || jsonData.length === 0) {
      alert("A planilha não contém dados válidos.");
      return;
    }

    gerarJornal(jsonData);
  };

  reader.readAsArrayBuffer(file);
}

function gerarJornal(data) {
  let htmlContent = `
  <!DOCTYPE html>
  <html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Jornal de Ofertas - 3 Colunas</title>
    <style>
      * {
        box-sizing: border-box;
        font-family: 'Arial', sans-serif;
        margin: 0;
        padding: 0;
      }

      .container {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); /* Responsivo */
        gap: 20px; /* Espaçamento entre os cards */
        padding: 20px;
        max-width: 100%;
        margin: 0 auto;
      }

      .card {
        background-color: #ffffff;
        border: 10px solid #e0b84b; /* Borda dourada */
        border-radius: 15px;
        padding: 20px;
        text-align: center;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
        transition: transform 0.3s ease;
      }

      .card img {
        width: 100%;
        height: 200px;
        object-fit: cover;
        border-radius: 10px;
      }

      .card h3 {
        font-size: 22px;
        margin-top: 10px;
        color: #333;
      }

      .card p {
        font-size: 16px;
        color: #666;
        margin: 10px 0;
      }

      .card .price {
        font-size: 20px;
        color: #1a7d00;
        font-weight: bold;
      }

      .card:hover {
        transform: translateY(-10px);
        box-shadow: 0 10px 20px rgba(0, 0, 0, 0.15);
      }

      .tarja {
        background-color: #f1c40f;
        color: #333;
        font-size: 24px;
        padding: 10px 20px;
        text-align: center;
        font-weight: bold;
        margin-bottom: 20px;
      }
    </style>
  </head>
  <body>
    <div class="output-container">`;

  let currentCategory = '';

  // Gerar os cards baseados nos dados
  data.forEach(item => {
    console.log("Processando item:", item); // Verificar cada item da planilha

    // Separar por categoria
    if (item.CATEGORIA !== currentCategory) {
      // Se for uma nova categoria, adicionar a tarja
      if (currentCategory !== '') {
        htmlContent += `</div>`; // Fechar a seção de categoria anterior
      }

      currentCategory = item.CATEGORIA;
      htmlContent += `
        <div class="tarja">${currentCategory}</div>
        <div class="container">`;
    }

    // Adicionar o card para cada item
    htmlContent += `
    <div class="card">
      <img src="${item.IMAGEM}" alt="${item.NOME}">
      <h3>${item.NOME}</h3>
      <p>${item.DESCRICAO}</p>
      <div class="price">${item.PRECO}</div>
    </div>`;
  });

  htmlContent += `
  </div></body></html>`;

  console.log("HTML gerado:", htmlContent); // Verificar o HTML gerado

  // Exibir o HTML gerado para visualização
  document.getElementById('output').innerHTML = htmlContent;

  // Criar botão de download
  const downloadBtn = document.createElement('button');
  downloadBtn.textContent = 'Baixar Jornal';
  downloadBtn.onclick = () => {
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'jornal_ofertas.html';
    link.click();
  };

  // Adicionar o botão de download na página
  document.body.appendChild(downloadBtn);
}
