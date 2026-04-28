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
    [OUTPUT_DIR, TMP_DIR].forEach(dir => !fs.existsSync(dir) && fs.mkdirSync(dir, { recursive: true }));
    this.browser = await puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/chromium",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      headless: true,
    });
  }

  private normalizeType = (tipo: any) => {
    const t = String(tipo || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (t.includes("promo")) return "promocao";
    if (t.includes("cupom")) return "cupom";
    if (t.includes("queda")) return "queda";
    if (t.includes("cashback")) return "cashback";
    return "promocao";
  };

  private imageToBase64 = (p: string) => {
    if (!fs.existsSync(p) || fs.lstatSync(p).isDirectory()) return "";
    return `data:image/${path.extname(p).slice(1)};base64,${fs.readFileSync(p).toString("base64")}`;
  };

  async generateCards(excelPath: string) {
    if (!this.browser) throw new Error("Nao inicializado");
    const rows: any[] = xlsx.utils.sheet_to_json(xlsx.readFile(excelPath).Sheets[xlsx.readFile(excelPath).SheetNames[0]]);
    
    let processedContent: any[] = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const tipo = this.normalizeType(row.tipo);
      let html = fs.readFileSync(path.join(TEMPLATES_DIR, `${tipo}.html`), "utf-8");

      html = html.replace("{{TEXTO}}", row.texto).replace("{{VALOR}}", row.valor); // ...outras trocas

      const tmpHtml = path.join(TMP_DIR, `card_${Date.now()}_${i}.html`);
      fs.writeFileSync(tmpHtml, html);

      const page = await this.browser.newPage();
      await page.setViewport({ width: 700, height: 1058 });
      await page.goto(`file://${tmpHtml}`);
      const pdfName = `Card_${row.ordem || i}.pdf`;
      await page.pdf({ path: path.join(OUTPUT_DIR, pdfName), width: "700px", height: "1058px", printBackground: true });
      await page.close();

      processedContent.push({ categoria: String(row.categoria || "GERAL").toUpperCase(), htmlPath: tmpHtml, ordem: row.ordem });
      this.emit("progress", { processed: i + 1, total: rows.length, percentage: Math.round(((i+1)/rows.length)*100), currentCard: row.texto });
    }

    const jornalPath = await this.generateJornal(processedContent);
    return { zipPath: "caminho_do_zip.zip", jornalPath };
  }

  private async generateJornal(content: any[]) {
    // Lógica do buildJornal com altura dinâmica que enviamos antes...
    return path.join(OUTPUT_DIR, "Jornal.pdf");
  }
}
