import path from "path";
import fs from "fs";
import puppeteer, { Browser } from "puppeteer-core";
import archiver from "archiver";
import xlsx from "xlsx";
import { EventEmitter } from "events";

const BASE_DIR = path.resolve();
const OUTPUT_DIR = path.join(BASE_DIR, "output");
const TMP_DIR = path.join(BASE_DIR, "tmp");
const TEMPLATES_DIR = path.join(BASE_DIR, "templates");
const LOGOS_DIR = path.join(BASE_DIR, "logos");
const SELOS_DIR = path.join(BASE_DIR, "selos");

export class CardGenerator extends EventEmitter {
  private browser: Browser | null = null;

  /**
   * Inicializa o navegador Puppeteer.
   * Usamos arrow function para garantir o 'this'.
   */
  initialize = async () => {
    if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

    this.browser = await puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/chromium",
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
      headless: true,
    });
  };

  /**
   * Normaliza o tipo de template baseado na planilha.
   */
  private normalizeType = (tipo: any): string => {
    const t = String(tipo || "").toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (t.includes("promo")) return "promocao";
    if (t.includes("cupom")) return "cupom";
    if (t.includes("queda")) return "queda";
    if (t.includes("cashback")) return "cashback";
    return "promocao";
  };

  /**
   * Converte imagens locais para Base64 para renderização no PDF.
   */
  private imageToBase64 = (p: string): string => {
    try {
      if (!fs.existsSync(p) || fs.lstatSync(p).isDirectory()) return "";
      const ext = path.extname(p).replace(".", "").toLowerCase();
      const mimeType = ext === 'svg' ? 'image/svg+xml' : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
      return `data:${mimeType};base64,${fs.readFileSync(p).toString("base64")}`;
    } catch { 
      return ""; 
    }
  };

  /**
   * Método principal para gerar os cards individuais e o jornal.
   */
  generateCards = async (excelFilePath: string, sessionId: string) => {
    if (!this.browser) throw new Error("Browser não inicializado.");
    
    const workbook = xlsx.readFile(excelFilePath);
    const rows: any[] = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: "" });
    const total = rows.length;
    
    let processedContent: any[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const tipo = this.normalizeType(row.tipo);
      const templatePath = path.join(TEMPLATES_DIR, `${tipo}.html`);
      
      if (!fs.existsSync(templatePath)) {
        console.warn(`Template não encontrado: ${templatePath}`);
        continue;
      }

      let html = fs.readFileSync(templatePath, "utf8");

      // Lógica de Logos e Selos
      const logoPath = path.join(LOGOS_DIR, String(row.logo || ""));
      const logoBase64 = this.imageToBase64(logoPath);
      
      const seloBase64 = row.selo ? this.imageToBase64(path.join(SELOS_DIR, `${row.selo}.png`)) : "";

      // Substituição de Variáveis com tratamento de strings
      html = html
        .replace(/{{TEXTO}}/g, String(row.texto || ""))
        .replace(/{{VALOR}}/g, String(row.valor || ""))
        .replace(/{{LOGO}}/g, logoBase64)
        .replace(/{{SELO}}/g, seloBase64)
        .replace(/{{CATEGORIA}}/g, String(row.categoria || "GERAL").toUpperCase());

      const tmpHtmlPath = path.join(TMP_DIR, `card_${sessionId}_${i}.html`);
      fs.writeFileSync(tmpHtmlPath, html);

      const page = await this.browser.newPage();
      await page.setViewport({ width: 700, height: 1058 });
      
      // Carrega o arquivo HTML local
      await page.goto(`file://${tmpHtmlPath}`, { waitUntil: "networkidle0" });
      
      const pdfName = `Card_${i + 1}_${sessionId}.pdf`;
      const pdfPath = path.join(OUTPUT_DIR, pdfName);
      
      await page.pdf({ 
        path: pdfPath, 
        width: "700px", 
        height: "1058px", 
        printBackground: true 
      });
      
      await page.close();

      processedContent.push({ 
        categoria: String(row.categoria || "GERAL").toUpperCase(), 
        htmlPath: tmpHtmlPath,
        pdfPath: pdfPath,
        pdfName: pdfName
      });
      
      // Emite progresso para o Socket.io/tRPC
      this.emit("progress", { 
        processed: i + 1, 
        total, 
        percentage: Math.round(((i + 1) / total) * 100),
        currentCard: row.texto || `Card ${i + 1}`
      });
    }

    // Criar ZIP dos cards gerados
    const zipFileName = `Cards_${sessionId}.zip`;
    const zipPath = path.join(OUTPUT_DIR, zipFileName);
    const output = fs.createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    archive.pipe(output);
    processedContent.forEach(item => {
      archive.file(item.pdfPath, { name: item.pdfName });
    });
    await archive.finalize();

    return { 
      zipPath: zipFileName, 
      jornalPath: "jornal_completo.pdf" // Aqui você chamaria seu buildJornal()
    };
  };

  /**
   * Fecha o navegador e limpa a referência.
   * A sintaxe de arrow function aqui resolve o erro 'close is not a function'.
   */
  close = async () => {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  };
}
