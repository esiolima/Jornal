const fs = require('fs');
const XLSX = require('xlsx');

// Função para gerar o HTML com base na planilha
function gerarHTML() {
  const fileInput = document.getElementById('upload');
  const file = fileInput.files[0];
  const reader = new FileReader();

  reader.onload = function (e) {
    const data = new Uint8Array(e.target.result);
    const workbook = XLSX.read(data, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(sheet);
    
    // Ordenando os dados pela coluna 'ORDEM'
    jsonData.sort((a, b) => a.ORDEN - b.ORDEN);

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

    // Gerando o HTML com base nos dados
    jsonData.forEach(item => {
      // Separar por categoria
      if (item.CATEGORIA !== currentCategory) {
        // Adicionar tarja de categoria antes de novos cards
        if (currentCategory !== '') {
          htmlContent += `</div>`; // Fechar a seção de categoria anterior
        }

        currentCategory = item.CATEGORIA;
        htmlContent += `
          <div class="tarja">${currentCategory}</div>
          <div class="container">`;
      }

      // Adicionando os cards
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
  };

  reader.readAsArrayBuffer(file);
}
