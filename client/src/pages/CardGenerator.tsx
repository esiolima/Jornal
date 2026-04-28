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
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      headless: true,
    });
  }

  // Mudamos para Arrow Function para evitar o erro de "this.normalizeType is not a function"
  private normalizeType = (tipo: string): string => {
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
  };

  private sanitizeFileName = (value: string): string => {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .toLowerCase()
      .trim();
  };

  private imageToBase64 = (imagePath: string): string => {
    if (!imagePath || !fs.existsSync(imagePath) || fs.lstatSync(imagePath).isDirectory()) return "";
    const ext = path.extname(imagePath).replace(".", "").toLowerCase();
    const buffer = fs.readFileSync(imagePath);
    let mimeType = `image/${ext}`;
    if (ext === "svg") mimeType = "image/svg+xml";
    if (ext === "jpg") mimeType = "image/jpeg";
    return `data:${mimeType};base64,${buffer.toString("base64")}`;
  };

  private findLogoFile = (logoName: string): string => {
    if (!logoName || String(logoName).trim() === "") return "blank.png";
    const cleanName = String(logoName).trim();
    const extensions = [".png", ".jpg", ".jpeg", ".webp", ".svg"];
    const filesInLogos = fs.readdirSync(LOGOS_DIR);
    
    for (const ext of extensions) {
      const target = cleanName.toLowerCase().endsWith(ext) ? cleanName.toLowerCase() : cleanName.toLowerCase() + ext;
      const found = filesInLogos.find(f => f.toLowerCase() === target);
      if (found) return found;
    }
    return "blank.png";
  };

  async generateCards(excelFilePath: string, originalFileName?: string): Promise<{ zipPath: string, jornalPath: string }> {
    if (!this.browser) throw new Error("Browser não iniciado");

    const workbook = xlsx.readFile(excelFilePath);
    const rows: any[] = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: "" });
    const total = rows.length;
    
    // Limpeza
    fs.readdirSync(OUTPUT_DIR).forEach(f => (f.endsWith(".pdf") || f.endsWith(".zip")) && fs.unlinkSync(path.join(OUTPUT_DIR, f)));

    let processedContent: any[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const tipo = this.normalizeType(row.tipo);
        if (!tipo) continue;

        const templatePath = path.join(TEMPLATES_DIR, `${tipo}.html`);
        let html = fs.readFileSync(templatePath, "utf8");

        const logoBase64 = this.imageToBase64(path.join(LOGOS_DIR, this.findLogoFile(row.logo)));
        const seloRaw = String(row.selo ?? "").trim().toLowerCase();
        const seloFile = seloRaw === "nova" ? "acaonova.png" : "acaorenovada.png";
        const seloBase64 = seloRaw ? this.imageToBase64(path.join(SELOS_DIR, seloFile)) : "";

        html = html
          .replaceAll("{{TEXTO}}", String(row.texto ?? ""))
          .replaceAll("{{VALOR}}", String(row.valor ?? ""))
          .replaceAll("{{LOGO}}", logoBase64)
          .replaceAll("{{SELO}}", seloBase64)
          .replaceAll("{{SEGMENTO}}", String(row.segmento ?? ""))
          .replaceAll("{{LEGAL}}", String(row.legal ?? ""))
          .replaceAll("{{UF}}", String(row.uf ?? ""))
          .replaceAll("{{URN}}", String(row.urn ?? ""));

        const tmpHtmlPath = path.join(TMP_DIR, `card_${Date.now()}_${i}.html`);
        fs.writeFileSync(tmpHtmlPath, html);

        const page = await this.browser.newPage();
        await page.setViewport({ width: 700, height: 1058 });
        await page.goto(`file://${tmpHtmlPath}`, { waitUntil: "networkidle0" });
        
        const pdfName = `${row.ordem || i + 1}_${tipo}_${this.sanitizeFileName(row.categoria || "geral")}.pdf`;
        const pdfPath = path.join(OUTPUT_DIR, pdfName);
        await page.pdf({ path: pdfPath, width: "700px", height: "1058px", printBackground: true });
        await page.close();

        processedContent.push({
          categoria: String(row.categoria || "GERAL").toUpperCase(),
          html: tmpHtmlPath,
          ordem: Number(row.ordem || i + 1)
        });

        this.emit("progress", { processed: i + 1, total, percentage: Math.round(((i + 1) / total) * 100), currentCard: row.texto });
      } catch (err: any) {
        this.emit("error", `Erro na linha ${i + 1}: ${err.message}`);
      }
    }

    const jornalPath = await this.buildJornal(processedContent);

    // ZIP
    const zipPath = path.join(OUTPUT_DIR, `Cards_${Date.now()}.zip`);
    const output = fs.createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.pipe(output);
    fs.readdirSync(OUTPUT_DIR).forEach(f => {
        if (f.endsWith(".pdf") && f !== path.basename(jornalPath)) {
            archive.file(path.join(OUTPUT_DIR, f), { name: f });
        }
    });
    await archive.finalize();

    return { zipPath, jornalPath };
  }

  private async buildJornal(content: any[]): Promise<string> {
    const jornalTemplatePath = path.join(TEMPLATES_DIR, "jornal.html");
    const jornalTemplate = fs.readFileSync(jornalTemplatePath, "utf8");
    
    const grupos = content.reduce((acc, curr) => {
      acc[curr.categoria] = acc[curr.categoria] || [];
      acc[curr.categoria].push(curr);
      return acc;
    }, {});

    let htmlFinal = "";
    for (const [cat, cards] of Object.entries(grupos)) {
      (cards as any[]).sort((a, b) => a.ordem - b.ordem);
      htmlFinal += `
        <div class="categoria-secao">
          <div class="tarja-categoria">${cat}</div>
          <div class="cards-grid">
            ${(cards as any[]).map(c => `<div class="card-mini-wrapper"><iframe src="file://${c.html}"></iframe></div>`).join("")}
          </div>
        </div>`;
    }

    const page = await this.browser!.newPage();
    await page.setContent(jornalTemplate.replace("{{CONTEUDO}}", htmlFinal));
    
    const bodyHeight = await page.evaluate(() => document.body.scrollHeight);
    const jornalFile = path.join(OUTPUT_DIR, `Jornal_Diagramado_${Date.now()}.pdf`);
    
    await page.pdf({
      path: jornalFile,
      width: "1200px",
      height: `${bodyHeight + 100}px`,
      printBackground: true,
      margin: { top: "0px", bottom: "0px", left: "0px", right: "0px" }
    });

    await page.close();
    return jornalFile;
  }

  async close() {
    if (this.browser) await this.browser.close();
  }
}
