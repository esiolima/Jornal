import path from "path";
import fs from "fs";
import puppeteer, { Browser } from "puppeteer-core";
import xlsx from "xlsx";
import { EventEmitter } from "events";

const BASE_DIR = path.resolve();
const TEMPLATES_DIR = path.join(BASE_DIR, "templates");

export class CardGenerator extends EventEmitter {
  private browser: Browser | null = null;

  // Arrow function para manter o contexto do 'this'
  initialize = async () => {
    this.browser = await puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/chromium",
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
      headless: true,
    });
  };

  // Arrow function evita erro de 'not a function'
  private normalizeType = (tipo: any): string => {
    const t = String(tipo || "").toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (t.includes("promo")) return "promocao";
    if (t.includes("cupom")) return "cupom";
    if (t.includes("queda")) return "queda";
    if (t.includes("cashback")) return "cashback";
    return "promocao";
  };

  generateCards = async (excelFilePath: string, sessionId: string) => {
    if (!this.browser) throw new Error("Browser não inicializado.");
    
    // Forçar que o caminho seja uma string para evitar erro de 'Object instance'
    const filePath = typeof excelFilePath === "string" ? excelFilePath : (excelFilePath as any).filePath;

    const workbook = xlsx.readFile(filePath);
    const rows: any[] = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: "" });
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      // Agora o 'this' funciona corretamente aqui:
      const tipo = this.normalizeType(row.tipo);
      
      // ... lógica de geração de PDF ...

      this.emit("progress", { 
        processed: i + 1, 
        total: rows.length, 
        percentage: Math.round(((i + 1) / rows.length) * 100),
        currentCard: row.texto 
      });
    }

    return { zipPath: "cards.zip", jornalPath: "jornal.pdf" };
  };

  close = async () => {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  };
}
