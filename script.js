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

    mostrarDados(json);
  };

  reader.readAsArrayBuffer(file);
}

function mostrarDados(dados) {
  const container = document.getElementById('resultado');

  if (!dados.length) {
    container.innerHTML = "<p>Nenhum dado encontrado.</p>";
    return;
  }

  let html = "<table border='1' cellpadding='8'>";

  // Cabeçalho
  html += "<tr>";
  Object.keys(dados[0]).forEach(col => {
    html += `<th>${col}</th>`;
  });
  html += "</tr>";

  // Linhas
  dados.forEach(linha => {
    html += "<tr>";
    Object.values(linha).forEach(valor => {
      html += `<td>${valor}</td>`;
    });
    html += "</tr>";
  });

  html += "</table>";

  container.innerHTML = html;
}
