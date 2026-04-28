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

  private normalizeType(tipo: string): string {
    if (!tipo) return "";
    const normalized = String(tipo)
      .toLowerCase()
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    if (normalized.includes("promo")) return "promocao";
    if (normalized.includes("cupom")) return "cupom";
    if (normalized.includes("queda")) return "queda";
    if (normalized.includes("cashback")) return "cashback";
    if (normalized === "bc") return "bc";
    return "";
  }

  private sanitizeFileName(value: string): string {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .toLowerCase()
      .trim();
  }

  private getUniqueFilePath(filePath: string): string {
    if (!fs.existsSync(filePath)) return filePath;
    const ext = path.extname(filePath);
    const name = path.basename(filePath, ext);
    const dir = path.dirname(filePath);
    let counter = 2;
    let newPath = "";
    do {
      newPath = path.join(dir, `${name}_v${counter}${ext}`);
      counter++;
    } while (fs.existsSync(newPath));
    return newPath;
  }

  private getDateStamp(): string {
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const dd = String(now.getDate()).padStart(2, "0");
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const aa = String(now.getFullYear()).slice(-2);
    const hh = String(now.getHours()).padStart(2, "0");
    const min = String(now.getMinutes()).padStart(2, "0");
    const ss = String(now.getSeconds()).padStart(2, "0");
    return `${dd}_${mm}_${aa}-${hh}_${min}_${ss}`;
  }

  private imageToBase64(imagePath: string): string {
    if (!imagePath || !fs.existsSync(imagePath) || fs.lstatSync(imagePath).isDirectory()) return "";
    const ext = path.extname(imagePath).replace(".", "").toLowerCase();
    const buffer = fs.readFileSync(imagePath);
    let mimeType = `image/${ext}`;
    if (ext === "svg") mimeType = "image/svg+xml";
    if (ext === "jpg") mimeType = "image/jpeg";
    return `data:${mimeType};base64,${buffer.toString("base64")}`;
  }

  private findLogoFile(logoName: string): string {
    if (!logoName || String(logoName).trim() === "") return "blank.png";
    const cleanName = String(logoName).trim();
    const extensions = [".png", ".jpg", ".jpeg", ".webp", ".svg"];
    if (fs.existsSync(path.join(LOGOS_DIR, cleanName))) return cleanName;
    const searchName = cleanName.toLowerCase();
    const filesInLogos = fs.readdirSync(LOGOS_DIR);
    for (const ext of extensions) {
      const target = searchName.endsWith(ext) ? searchName : searchName + ext;
      const found = filesInLogos.find(f => f.toLowerCase() === target);
      if (found) return found;
    }
    const validFiles = filesInLogos.filter(f => extensions.includes(path.extname(f).toLowerCase()));
    const prefixMatch = validFiles.find(f => path.parse(f).name.toLowerCase().startsWith(searchName));
    return prefixMatch || "blank.png";
  }

  async generateCards(excelFilePath: string, originalFileName?: string): Promise<string> {
    if (!this.browser) throw new Error("Motor de renderização não inicializado.");

    // Limpeza de ambiente
    if (fs.existsSync(OUTPUT_DIR)) {
      fs.readdirSync(OUTPUT_DIR).forEach(f => (f.endsWith(".pdf") || f.endsWith(".zip")) && fs.unlinkSync(path.join(OUTPUT_DIR, f)));
    }

    const workbook = xlsx.readFile(excelFilePath);
    const rows: any[] = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: "" });
    const total = rows.length;
    let processed = 0;

    if (total === 0) throw new Error("A planilha está vazia.");

    for (const row of rows) {
      try {
        const tipo = this.normalizeType(row.tipo);
        if (!tipo) throw new Error(`Tipo de card '${row.tipo}' não é válido.`);

        const templatePath = path.join(TEMPLATES_DIR, `${tipo}.html`);
        if (!fs.existsSync(templatePath)) throw new Error(`Template '${tipo}.html' não encontrado.`);

        let html = fs.readFileSync(templatePath, "utf8");
        const valorFinal = tipo !== "promocao" ? String(row.valor ?? "").replace(/%/g, "").trim() : String(row.valor ?? "");
        const logoBase64 = this.imageToBase64(path.join(LOGOS_DIR, this.findLogoFile(row.logo)));
        
        const seloRaw = String(row.selo ?? "").trim().toLowerCase();
        const seloFile = seloRaw === "nova" ? "acaonova.png" : seloRaw === "renovada" ? "acaorenovada.png" : "blank.png";
        const seloBase64 = seloRaw ? this.imageToBase64(path.join(SELOS_DIR, seloFile)) : "";

        html = html
          .replaceAll("{{TEXTO}}", String(row.texto ?? ""))
          .replaceAll("{{VALOR}}", valorFinal)
          .replaceAll("{{COMPLEMENTO}}", String(row.complemento ?? ""))
          .replaceAll("{{LEGAL}}", String(row.legal ?? ""))
          .replaceAll("{{SEGMENTO}}", String(row.segmento ?? "").trim())
          .replaceAll("{{CUPOM}}", String(row.cupom ?? ""))
          .replaceAll("{{UF}}", row.uf ? `UF: ${row.uf}` : "")
          .replaceAll("{{URN}}", row.urn ? `URN: ${row.urn}` : "")
          .replaceAll("{{LOGO}}", logoBase64)
          .replaceAll("{{SELO}}", seloBase64);

        const tmpHtmlPath = path.join(TMP_DIR, `card_${Date.now()}_${processed}.html`);
        fs.writeFileSync(tmpHtmlPath, html);

        const page = await this.browser.newPage();
        await page.setViewport({ width: 700, height: 1058 });
        await page.goto(`file://${tmpHtmlPath}`, { waitUntil: "networkidle0", timeout: 60000 });

        const ordem = row.ordem && String(row.ordem).trim() !== "" ? String(row.ordem).trim() : String(processed + 1);
        const categoria = this.sanitizeFileName(String(row.categoria || "sem-categoria"));
        const pdfPath = path.join(OUTPUT_DIR, `${ordem}_${tipo}_${categoria}.pdf`);

        await page.pdf({ path: pdfPath, width: "700px", height: "1058px", printBackground: true });
        await page.close();
        if (fs.existsSync(tmpHtmlPath)) fs.unlinkSync(tmpHtmlPath);

        processed++;
        this.emit("progress", {
          processed,
          total,
          percentage: Math.round((processed / total) * 100),
          currentCard: `Gerando: ${row.texto || 'Card ' + processed}`
        });

      } catch (err: any) {
        this.emit("error", `Linha ${processed + 1}: ${err.message}`);
        processed++; // Continua para o próximo mesmo com erro
      }
    }

    // Geração do ZIP
    const baseName = originalFileName ? path.parse(originalFileName).name : "cards";
    const zipPath = this.getUniqueFilePath(path.join(OUTPUT_DIR, `${baseName}_${this.getDateStamp()}.zip`));
    
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(zipPath);
      const archive = archiver("zip", { zlib: { level: 9 } });
      output.on("close", () => resolve(zipPath));
      archive.on("error", (err) => reject(new Error(`Erro no ZIP: ${err.message}`)));
      archive.pipe(output);
      fs.readdirSync(OUTPUT_DIR).forEach(f => f.endsWith(".pdf") && archive.file(path.join(OUTPUT_DIR, f), { name: f }));
      archive.finalize();
    });
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}
