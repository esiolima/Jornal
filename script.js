async function processarPlanilha() {
  const fileInput = document.getElementById('upload');
  const file = fileInput.files[0];

  if (!file) {
    alert("Por favor, faça o upload de uma planilha.");
    return;
  }

  const reader = new FileReader();

  reader.onload = async function (e) {
    const data = new Uint8Array(e.target.result);
    const workbook = XLSX.read(data, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[1]] || workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(sheet);

    if (!jsonData || jsonData.length === 0) {
      alert("A planilha não contém dados válidos.");
      return;
    }

    await gerarJornalComTemplates(jsonData);
  };

  reader.readAsArrayBuffer(file);
}

async function carregarTemplate(tipo) {
  let nomeArquivo = 'promocao.html';
  const t = tipo.toLowerCase();
  
  if (t.includes('cupom')) nomeArquivo = 'cupom.html';
  else if (t.includes('queda')) nomeArquivo = 'queda.html';
  else if (t.includes('cashback')) nomeArquivo = 'cashback.html';
  else if (t.includes('bc')) nomeArquivo = 'bc.html';
  else if (t.includes('card')) nomeArquivo = 'card.html';

  try {
    const response = await fetch(`templates/${nomeArquivo}`);
    if (!response.ok) throw new Error(`Template ${nomeArquivo} não encontrado`);
    return await response.text();
  } catch (error) {
    console.error(error);
    const fallback = await fetch('templates/promocao.html');
    return await fallback.text();
  }
}

function preencherTemplate(html, item) {
  const mapeamento = {
    'LOGO': item['logo'] || item['FORNECEDOR '] || '',
    'TEXTO': item['texto'] || '',
    'VALOR': item['valor'] || '',
    'COMPLEMENTO': item['complemento'] || '',
    'LEGAL': item['legal'] || '',
    'UF': item['uf'] || '',
    'URN': item['urn'] || '',
    'SEGMENTO': item['segmento'] || ''
  };

  let templatePreenchido = html;
  for (const [key, value] of Object.entries(mapeamento)) {
    const regex = new RegExp(`{{${key}}}`, 'g');
    // Se for LOGO e não for uma URL, podemos tentar formatar ou deixar para o usuário ajustar as imagens
    let valorFinal = value;
    if (key === 'LOGO' && value && !value.toString().startsWith('http')) {
        // Tenta buscar na pasta assets se for apenas o nome
        valorFinal = `assets/${value}.png`; 
    }
    templatePreenchido = templatePreenchido.replace(regex, valorFinal === 'nan' ? '' : valorFinal);
  }
  return templatePreenchido;
}

async function gerarJornalComTemplates(data) {
  const container = document.getElementById('jornal');
  container.innerHTML = '<p style="text-align:center">Gerando cards... aguarde.</p>';
  
  const fragment = document.createDocumentFragment();
  
  // Cache de templates para não baixar o mesmo arquivo várias vezes
  const templateCache = {};

  for (const item of data) {
    const tipo = item['tipo'] || 'promocao';
    
    if (!templateCache[tipo]) {
      templateCache[tipo] = await carregarTemplate(tipo);
    }

    const htmlCard = preencherTemplate(templateCache[tipo], item);
    
    const iframe = document.createElement('iframe');
    iframe.style.width = '700px';
    iframe.style.height = '1058px';
    iframe.style.border = 'none';
    iframe.style.margin = '10px';
    iframe.style.boxShadow = '0 4px 10px rgba(0,0,0,0.2)';
    
    fragment.appendChild(iframe);
    
    // Injetar o conteúdo no iframe após ele ser adicionado ao DOM (ou via srcdoc)
    iframe.srcdoc = htmlCard;
  }

  container.innerHTML = '';
  container.appendChild(fragment);

  // Adicionar botão de download do pack (opcional, aqui gera o HTML da galeria)
  const downloadBtn = document.createElement('button');
  downloadBtn.textContent = 'Baixar Pack de Ofertas (HTML)';
  downloadBtn.style.display = 'block';
  downloadBtn.style.margin = '20px auto';
  downloadBtn.onclick = () => {
    const fullHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Pack de Ofertas</title>
        <style>
          body { background: #eee; display: flex; flex-wrap: wrap; justify-content: center; padding: 20px; }
          .card-container { margin: 10px; background: white; }
        </style>
      </head>
      <body>
        ${Array.from(container.querySelectorAll('iframe')).map(ifrm => `<div class="card-container">${ifrm.srcdoc}</div>`).join('\n')}
      </body>
      </html>
    `;
    const blob = new Blob([fullHtml], { type: 'text/html' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'pack_ofertas.html';
    link.click();
  };
  container.prepend(downloadBtn);
}
