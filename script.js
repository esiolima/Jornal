/**
 * GERADOR DE JORNAL PROFISSIONAL - VERSÃO DEFINITIVA
 * Integração robusta com templates e isolamento de estilos.
 */

async function processarPlanilha() {
    const fileInput = document.getElementById('upload');
    const file = fileInput.files[0];

    if (!file) {
        alert("Por favor, selecione uma planilha .xlsx primeiro.");
        return;
    }

    const reader = new FileReader();
    reader.onload = async function (e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            
            // Tenta pegar a aba de dados (geralmente a segunda na sua planilha)
            const sheetName = workbook.SheetNames.length > 1 ? workbook.SheetNames[1] : workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(sheet);

            if (!jsonData || jsonData.length === 0) {
                alert("A planilha parece estar vazia.");
                return;
            }

            await renderizarCards(jsonData);
        } catch (err) {
            console.error("Erro ao processar:", err);
            alert("Erro ao ler a planilha. Verifique o formato.");
        }
    };
    reader.readAsArrayBuffer(file);
}

async function carregarTemplate(tipo) {
    const mapeamento = {
        'cupom': 'cupom.html',
        'queda': 'queda.html',
        'cashback': 'cashback.html',
        'bc': 'bc.html',
        'card': 'card.html',
        'promocao': 'promocao.html'
    };

    let nomeArquivo = 'promocao.html';
    const t = tipo.toLowerCase();
    
    for (const key in mapeamento) {
        if (t.includes(key)) {
            nomeArquivo = mapeamento[key];
            break;
        }
    }

    try {
        const response = await fetch(`templates/${nomeArquivo}`);
        if (!response.ok) throw new Error();
        return await response.text();
    } catch {
        // Fallback para promoção se o arquivo não existir
        const fb = await fetch('templates/promocao.html');
        return await fb.text();
    }
}

function preencherTemplate(html, item) {
    // Campos da planilha mapeados para os placeholders {{FIELD}}
    const dados = {
        'LOGO': item['logo'] || item['FORNECEDOR '] || '',
        'TEXTO': item['texto'] || '',
        'VALOR': item['valor'] || '',
        'COMPLEMENTO': item['complemento'] || '',
        'LEGAL': item['legal'] || '',
        'UF': item['uf'] || '',
        'URN': item['urn'] || '',
        'SEGMENTO': item['segmento'] || ''
    };

    let finalHtml = html;
    
    // Substituição de Placeholders
    for (const [key, value] of Object.entries(dados)) {
        const val = (value === undefined || value === null || value === 'nan') ? '' : value.toString();
        const regex = new RegExp(`{{${key}}}`, 'g');
        
        let substituto = val;
        if (key === 'LOGO' && val && !val.startsWith('http')) {
            substituto = `assets/${val}.png`;
        }
        
        finalHtml = finalHtml.replace(regex, substituto);
    }

    // Correção de caminhos de fontes para o servidor
    finalHtml = finalHtml.replace(/\.\.\/fonts\//g, 'fonts/');

    return finalHtml;
}

async function renderizarCards(data) {
    const container = document.getElementById('jornal');
    container.innerHTML = '<div style="width:100%; text-align:center; padding:50px;"><h2>Processando ofertas...</h2></div>';
    
    const templateCache = {};
    const fragment = document.createDocumentFragment();

    for (const item of data) {
        const tipo = item['tipo'] || 'promocao';
        if (!templateCache[tipo]) {
            templateCache[tipo] = await carregarTemplate(tipo);
        }

        const cardHtml = preencherTemplate(templateCache[tipo], item);
        
        const wrapper = document.createElement('div');
        wrapper.className = 'card-wrapper';
        
        const iframe = document.createElement('iframe');
        iframe.className = 'card-iframe';
        iframe.srcdoc = cardHtml;
        
        wrapper.appendChild(iframe);
        fragment.appendChild(wrapper);
    }

    container.innerHTML = '';
    
    // Botão para Exportar HTML Consolidado
    const btnExport = document.createElement('button');
    btnExport.innerHTML = '📥 Baixar Jornal Consolidado (Pronto para Impressão)';
    btnExport.className = 'btn-export';
    btnExport.onclick = () => baixarHtmlConsolidado(data, templateCache);
    
    container.appendChild(btnExport);
    container.appendChild(fragment);
}

async function baixarHtmlConsolidado(data, cache) {
    let cardsHtml = '';
    
    for (const item of data) {
        const tipo = item['tipo'] || 'promocao';
        const html = preencherTemplate(cache[tipo], item);
        
        // Extrai apenas o conteúdo interno do body para evitar tags duplicadas
        const bodyContent = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] || html;
        const styleContent = html.match(/<style[^>]*>([\s\S]*)<\/style>/i)?.[0] || '';
        
        cardsHtml += `
        <div class="page-break">
            ${styleContent}
            <div class="card-render">
                ${bodyContent}
            </div>
        </div>`;
    }

    const finalDocument = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Jornal de Ofertas Exportado</title>
    <style>
        body { margin: 0; padding: 0; background: #525659; display: flex; flex-direction: column; align-items: center; }
        .page-break { 
            background: white; 
            width: 700px; 
            height: 1058px; 
            margin: 20px 0; 
            overflow: hidden; 
            position: relative;
            box-shadow: 0 0 15px rgba(0,0,0,0.5);
        }
        @media print {
            body { background: none; }
            .page-break { margin: 0; box-shadow: none; page-break-after: always; }
        }
        /* Reset para garantir que o conteúdo do card ocupe tudo */
        .card-render { width: 100%; height: 100%; }
    </style>
</head>
<body>
    ${cardsHtml}
</body>
</html>`;

    const blob = new Blob([finalDocument], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'jornal_completo.html';
    a.click();
}
