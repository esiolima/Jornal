import { useState, useRef, useEffect } from "react";
import { io, Socket } from "socket.io-client";
import { trpc } from "@/lib/trpc"; 
import { Button } from "@/components/ui/button";
import { 
  Upload, 
  Download, 
  Hourglass, 
  FileText, 
  X,
  ShieldCheck
} from "lucide-react";

interface ProgressData {
  total: number;
  processed: number;
  percentage: number;
  currentCard: string;
}

export default function CardGenerator() {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [zipPath, setZipPath] = useState<string | null>(null);
  const [jornalPath, setJornalPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionId] = useState(() => `sess_${Math.random().toString(36).substring(2, 9)}`);
  
  const socketRef = useRef<Socket | null>(null);
  const generateMutation = trpc.card.generateCards.useMutation();

  // Versão da ferramenta
  const APP_VERSION = "v1.2.4";

  useEffect(() => {
    const socket = io();
    socket.on("connect", () => socket.emit("join", sessionId));
    socket.on("progress", (data: ProgressData) => setProgress(data));
    socket.on("error", (msg: string) => { setError(msg); setIsProcessing(false); });
    socketRef.current = socket;
    return () => { socket.disconnect(); };
  }, [sessionId]);

  const handleUpload = async () => {
    if (!file) return;
    setIsProcessing(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Falha no upload do arquivo Excel");
      const { filePath } = await res.json();

      const result = await generateMutation.mutateAsync({ filePath, sessionId });
      setZipPath(result.zipPath);
      setJornalPath(result.jornalPath);
    } catch (err: any) {
      setError(err.message || "Erro durante o processamento");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-8 flex flex-col justify-between">
      <div className="max-w-2xl mx-auto w-full space-y-8 flex-grow">
        <header className="text-center pt-8">
          <h1 className="text-4xl font-black tracking-tighter">
            GERADOR DE <span className="text-orange-500">CARDS</span>
          </h1>
          <p className="text-white/40 text-sm mt-2 uppercase tracking-widest">Processamento Automatizado PDF</p>
        </header>

        {error && (
          <div className="bg-red-500/10 border border-red-500/50 p-4 rounded-2xl flex justify-between items-start">
            <p className="text-red-400 text-sm">{error}</p>
            <button onClick={() => setError(null)} className="hover:text-red-300"><X size={18}/></button>
          </div>
        )}

        {!isProcessing && !zipPath ? (
          <div className="space-y-4 animate-in fade-in duration-500">
            <div 
              onClick={() => document.getElementById("file-input")?.click()}
              className="border-2 border-dashed border-white/10 rounded-3xl p-20 text-center hover:border-orange-500/50 transition-colors cursor-pointer bg-white/[0.02]"
            >
              <input id="file-input" type="file" accept=".xlsx" hidden onChange={(e) => setFile(e.target.files?.[0] || null)} />
              <Upload className="mx-auto mb-4 text-orange-500/80" size={48} />
              <p className="font-medium text-lg">{file ? file.name : "Arraste ou selecione a planilha Excel"}</p>
              <p className="text-white/30 text-sm mt-2">Formatos aceitos: .xlsx</p>
            </div>
            <Button onClick={handleUpload} disabled={!file} className="w-full bg-orange-600 hover:bg-orange-500 h-16 text-lg font-bold rounded-2xl shadow-lg shadow-orange-900/20">
              INICIAR GERAÇÃO
            </Button>
          </div>
        ) : isProcessing ? (
          <div className="bg-white/[0.03] p-10 rounded-3xl text-center space-y-6 border border-white/5 shadow-2xl">
            <div className="relative inline-block">
               <Hourglass className="animate-spin text-orange-500" size={40} />
            </div>
            <div className="space-y-2">
              <div className="w-full bg-white/10 h-3 rounded-full overflow-hidden">
                <div className="bg-orange-500 h-full transition-all duration-300" style={{ width: `${progress?.percentage || 0}%` }} />
              </div>
              <div className="flex justify-between text-xs font-mono text-white/40">
                <span>{progress?.processed || 0} DE {progress?.total || 0}</span>
                <span>{progress?.percentage || 0}%</span>
              </div>
            </div>
            <p className="font-medium text-orange-200">
              {progress?.currentCard ? `Processando: ${progress.currentCard}` : "Preparando ambiente..."}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 animate-in zoom-in-95 duration-300">
            <div className="bg-green-500/10 border border-green-500/30 p-6 rounded-3xl text-center mb-4">
              <ShieldCheck className="mx-auto text-green-500 mb-2" size={32} />
              <h3 className="text-xl font-bold">Processamento concluído!</h3>
            </div>
            <Button onClick={() => window.open(`/api/download?path=${zipPath}`)} className="bg-orange-600 hover:bg-orange-500 h-20 text-xl font-black tracking-tight rounded-2xl">
               <Download className="mr-3" /> BAIXAR CARDS (ZIP)
            </Button>
            <Button onClick={() => window.open(`/api/download?path=${jornalPath}`)} className="bg-blue-700 hover:bg-blue-600 h-16 text-lg font-bold rounded-2xl">
               <FileText className="mr-2" /> BAIXAR JORNAL (PDF)
            </Button>
            <button onClick={() => window.location.reload()} className="text-white/40 hover:text-white text-sm font-medium pt-4 uppercase tracking-tighter">
              Reiniciar processo
            </button>
          </div>
        )}
      </div>

      {/* RODAPÉ SOLICITADO */}
      <footer className="w-full max-w-2xl mx-auto mt-12 pt-6 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 text-white/30 text-[10px] uppercase tracking-[0.2em]">
        <div className="flex items-center gap-2">
          <span className="bg-white/10 px-2 py-0.5 rounded text-white/60 font-mono">{APP_VERSION}</span>
          <p>© 2026 – Todos os direitos reservados</p>
        </div>
        <p className="text-right">
          Desenvolvido por <span className="text-white/60 font-bold tracking-normal">SELPH MKT</span>
        </p>
      </footer>
    </div>
  );
}
