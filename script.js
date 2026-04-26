/**
 * GERADOR DE JORNAL - VERSÃO GRID 3 COLUNAS COM CATEGORIAS
 */

async function processarPlanilha() {
    const fileInput = document.getElementById('upload');
    const file = fileInput.files[0];

    if (!file) {
        alert("Por favor, selecione uma planilha .xlsx.");
        return;
    }

    const reader = new FileReader();
    reader.onload = async function (e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            
            // Usando a aba de dados (ajuste se necessário para sua planilha real)
            const sheetName = workbook.SheetNames[1] || workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            let jsonData = XLSX.utils.sheet_to_json(sheet);

            if (!jsonData || jsonData.length === 0) {
                alert("A planilha está vazia.");
                return;
            }

            // 1. Ordenação pela coluna 'ordem farma' ou 'ordem varejo' ou 'ordem'
            jsonData.sort((a, b) => {
                const ordemA = a['ordem farma'] || a['ordem varejo'] || a['ordem'] || 999;
                const ordemB = b['ordem farma'] || b['ordem varejo'] || b['ordem'] || 999;
                return ordemA - ordemB;
            });

            await gerarJornalGrid(jsonData);
        } catch (err) {
            console.error(err);
            alert("Erro ao processar planilha.");
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
        'card': 'card.html'
    };
    let nome = 'promocao.html';
    const t = tipo.toLowerCase();
    for (const k in mapeamento) if (t.includes(k)) { nome = mapeamento[k]; break; }
    
    try {
        const res = await fetch(`templates/${nome}`);
        return res.ok ? await res.text() : await (await fetch('templates/promocao.html')).text();
    } catch {
        return "";
    }
}

function preencherTemplate(html, item) {
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
    let out = html;
    for (const [k, v] of Object.entries(dados)) {
        const val = (v === undefined || v === null || v === 'nan') ? '' : v.toString();
        const regex = new RegExp(`{{${k}}}`, 'g');
        let sub = val;
        if (k === 'LOGO' && val && !val.startsWith('http')) sub = `assets/${val}.png`;
        out = out.replace(regex, sub);
    }
    // Ajuste de fontes
    out = out.replace(/\.\.\/fonts\//g, 'fonts/');
    return out;
}

async function gerarJornalGrid(data) {
    const container = document.getElementById('jornal');
    container.innerHTML = '<p>Gerando jornal...</p>';
    
    const templateCache = {};
    let currentCategory = '';
    let htmlFinal = '';

    // Estilos para o Grid
    const gridStyles = `
    <style>
        .jornal-body { background: #fff; font-family: Arial, sans-serif; padding: 20px; }
        .categoria-tarja { 
            background: #1F3C6E; color: #E0B84B; 
            width: 100%; padding: 15px; font-size: 32px; 
            font-weight: bold; text-align: center; 
            margin: 30px 0 20px 0; text-transform: uppercase;
            border-radius: 8px; clear: both;
        }
        .grid-container { 
            display: grid; 
            grid-template-columns: repeat(3, 1fr); 
            gap: 20px; 
            margin-bottom: 40px;
        }
        .card-mini { 
            width: 100%; 
            aspect-ratio: 700 / 1058;
            border: 1px solid #ddd;
            overflow: hidden;
            position: relative;
        }
        .card-mini iframe {
            width: 700px; height: 1058px;
            border: none;
            transform: scale(calc(100 / 100)); /* Ocupará a largura do container */
            transform-origin: top left;
        }
        @media print {
            .categoria-tarja { page-break-before: auto; }
        }
    </style>`;

    let jornalConteudo = '';
    
    for (const item of data) {
        // Identifica categoria (varejo ou farma)
        const cat = item['categoria varejo'] || item['categoria farma'] || item['CATEGORIA'] || 'OFERTAS';
        
        if (cat !== currentCategory) {
            if (currentCategory !== '') jornalConteudo += '</div>'; // Fecha grid anterior
            currentCategory = cat;
            jornalConteudo += `<div class="categoria-tarja">${currentCategory}</div>`;
            jornalConteudo += `<div class="grid-container">`;
        }

        const tipo = item['tipo'] || 'promocao';
        if (!templateCache[tipo]) templateCache[tipo] = await carregarTemplate(tipo);
        
        const cardHtml = preencherTemplate(templateCache[tipo], item);
        
        // No grid, precisamos que o card se ajuste. Usaremos srcdoc no iframe.
        // Para o arquivo final, injetaremos o HTML diretamente.
        jornalConteudo += `
            <div class="card-mini">
                <iframe srcdoc='${cardHtml.replace(/'/g, "&apos;")}' style="width:700px; height:1058px; border:none; transform: scale(0.48); transform-origin: top left;"></iframe>
            </div>`;
    }
    jornalConteudo += '</div>'; // Fecha último grid

    container.innerHTML = `
        <button class="btn-export" onclick="baixarJornalGrid()">📥 Baixar Jornal em Grid (HTML)</button>
        <div id="jornal-preview">${gridStyles}${jornalConteudo}</div>
    `;
    
    // Salva para o download
    window.ultimoJornalHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8">${gridStyles}</head><body class="jornal-body">${jornalConteudo}</body></html>`;
}

function baixarJornalGrid() {
    if (!window.ultimoJornalHtml) return;
    const blob = new Blob([window.ultimoJornalHtml], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'jornal_ofertas_grid.html';
    a.click();
}
