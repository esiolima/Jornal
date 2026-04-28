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

  async initialize() {
    if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

    this.browser = await puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/chromium",
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
      headless: true,
    });
  }

  private normalizeType = (tipo: any): string => {
    const t = String(tipo || "").toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (t.includes("promo")) return "promocao";
    if (t.includes("cupom")) return "cupom";
    if (t.includes("queda")) return "queda";
    if (t.includes("cashback")) return "cashback";
    return "promocao";
  };

  private imageToBase64 = (p: string): string => {
    try {
      if (!fs.existsSync(p) || fs.lstatSync(p).isDirectory()) return "";
      const ext = path.extname(p).replace(".", "").toLowerCase();
      return `data:image/${ext === 'svg' ? 'svg+xml' : ext};base64,${fs.readFileSync(p).toString("base64")}`;
    } catch { return ""; }
  };

  async generateCards(excelFilePath: string, sessionId: string) {
    if (!this.browser) throw new Error("Browser não inicializado.");
    
    const workbook = xlsx.readFile(excelFilePath);
    const rows: any[] = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: "" });
    
    let processedContent: any[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const tipo = this.normalizeType(row.tipo);
      const templatePath = path.join(TEMPLATES_DIR, `${tipo}.html`);
      
      if (!fs.existsSync(templatePath)) continue;

      let html = fs.readFileSync(templatePath, "utf8");
      // ... (lógica de substituição de variáveis {{TEXTO}}, {{VALOR}}, etc)

      const tmpHtmlPath = path.join(TMP_DIR, `card_${sessionId}_${i}.html`);
      fs.writeFileSync(tmpHtmlPath, html);

      const page = await this.browser.newPage();
      await page.setViewport({ width: 700, height: 1058 });
      await page.goto(`file://${tmpHtmlPath}`, { waitUntil: "networkidle0" });
      
      const pdfName = `Card_${i+1}_${sessionId}.pdf`;
      await page.pdf({ path: path.join(OUTPUT_DIR, pdfName), width: "700px", height: "1058px", printBackground: true });
      await page.close();

      processedContent.push({ categoria: String(row.categoria || "GERAL").toUpperCase(), htmlPath: tmpHtmlPath });
      
      this.emit("progress", { 
        processed: i + 1, 
        total: rows.length, 
        percentage: Math.round(((i + 1) / rows.length) * 100),
        currentCard: row.texto 
      });
    }

    return { zipPath: "cards.zip", jornalPath: "jornal.pdf" };
  }

  // MÉTODO CORRIGIDO
  close = async () => {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  };
}
