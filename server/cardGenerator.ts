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

  initialize = async () => {
    if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

    this.browser = await puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/chromium",
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
      headless: true,
    });
  };

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
      const mimeType = ext === 'svg' ? 'image/svg+xml' : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
      return `data:${mimeType};base64,${fs.readFileSync(p).toString("base64")}`;
    } catch { return ""; }
  };

  generateCards = async (excelFilePath: string, sessionId: string) => {
    if (!this.browser) throw new Error("Browser não inicializado.");
    
    // Tratamento para garantir que o path seja string
    const targetPath = typeof excelFilePath === 'string' ? excelFilePath : (excelFilePath as any).filePath;
    
    const workbook = xlsx.readFile(targetPath);
    const rows: any[] = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: "" });
    const total = rows.length;
    let processedContent: any[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const tipoOriginal = String(row.tipo || "Geral");
      const tipoNormalizado = this.normalizeType(row.tipo); 
      const templatePath = path.join(TEMPLATES_DIR, `${tipoNormalizado}.html`);
      
      if (!fs.existsSync(templatePath)) continue;

      let html = fs.readFileSync(templatePath, "utf8");
      const logoBase64 = this.imageToBase64(path.join(LOGOS_DIR, String(row.logo || "")));
      const seloBase64 = row.selo ? this.imageToBase64(path.join(SELOS_DIR, `${row.selo}.png`)) : "";

      html = html
        .replace(/{{TEXTO}}/g, String(row.texto || ""))
        .replace(/{{VALOR}}/g, String(row.valor || ""))
        .replace(/{{LOGO}}/g, logoBase64)
        .replace(/{{SELO}}/g, seloBase64)
        .replace(/{{CATEGORIA}}/g, String(row.categoria || "GERAL").toUpperCase())
        .replace(/{{TIPO}}/g, tipoOriginal);

      const tmpHtmlPath = path.join(TMP_DIR, `card_${sessionId}_${i}.html`);
      fs.writeFileSync(tmpHtmlPath, html);

      const page = await this.browser.newPage();
      await page.setViewport({ width: 700, height: 1058 });
      await page.goto(`file://${tmpHtmlPath}`, { waitUntil: "networkidle0" });
      
      const pdfName = `Card_${i + 1}_${sessionId}.pdf`;
      const pdfPath = path.join(OUTPUT_DIR, pdfName);
      
      await page.pdf({ path: pdfPath, width: "700px", height: "1058px", printBackground: true });
      await page.close();

      processedContent.push({ pdfPath, pdfName });
      
      this.emit("progress", { 
        processed: i + 1, 
        total, 
        percentage: Math.round(((i + 1) / total) * 100),
        currentType: tipoOriginal 
      });
    }

    const zipFileName = `Cards_${sessionId}.zip`;
    const zipPath = path.join(OUTPUT_DIR, zipFileName);
    const output = fs.createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    await new Promise((resolve, reject) => {
      output.on("close", resolve);
      archive.on("error", reject);
      archive.pipe(output);
      processedContent.forEach(item => archive.file(item.pdfPath, { name: item.pdfName }));
      archive.finalize();
    });

    return { zipPath: zipFileName, jornalPath: "jornal_gerado.pdf" };
  };

  close = async () => {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  };
}
