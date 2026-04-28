import { useState, useRef, useEffect } from "react";
import { io, Socket } from "socket.io-client";
import { trpc } from "@/lib/trpc"; 
import { Button } from "@/components/ui/button";
import { Upload, Download, Hourglass, FileText, X, ShieldCheck } from "lucide-react";

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
  const [isDragging, setIsDragging] = useState(false);
  const [sessionId] = useState(() => `sess_${Math.random().toString(36).substring(2, 9)}`);
  
  const socketRef = useRef<Socket | null>(null);
  const generateMutation = trpc.card.generateCards.useMutation();

  const APP_VERSION = "v1.2.5";

  useEffect(() => {
    const socket = io();
    socket.on("connect", () => socket.emit("join", sessionId));
    socket.on("progress", (data: ProgressData) => setProgress(data));
    socket.on("error", (msg: string) => { setError(msg); setIsProcessing(false); });
    socketRef.current = socket;
    return () => { socket.disconnect(); };
  }, [sessionId]);

  // Função para lidar com o arquivo solto (Drag and Drop)
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && (droppedFile.name.endsWith(".xlsx") || droppedFile.name.endsWith(".xls"))) {
      setFile(droppedFile);
    } else {
      setError("Por favor, arraste apenas arquivos Excel (.xlsx)");
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setIsProcessing(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Falha no upload");
      const { filePath } = await res.json();

      // Aqui enviamos a string do caminho, resolvendo o erro de "Received an instance of Object"
      const result = await generateMutation.mutateAsync({ filePath, sessionId });
      setZipPath(result.zipPath);
      setJornalPath(result.jornalPath);
    } catch (err: any) {
      setError(err.message || "Erro no processamento");
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
          <p className="text-white/40 text-sm mt-2 uppercase tracking-widest font-medium">Automação Selph MKT</p>
        </header>

        {error && (
          <div className="bg-red-500/10 border border-red-500/50 p-4 rounded-2xl flex justify-between items-center">
            <p className="text-red-400 text-xs font-mono">{error}</p>
            <button onClick={() => setError(null)}><X size={16}/></button>
          </div>
        )}

        {!isProcessing && !zipPath ? (
          <div className="space-y-4">
            <div 
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => document.getElementById("file-input")?.click()}
              className={`border-2 border-dashed rounded-3xl p-20 text-center transition-all cursor-pointer ${
                isDragging ? "border-orange-500 bg-orange-500/5 scale-[1.02]" : "border-white/10 bg-white/[0.02] hover:border-orange-500/30"
              }`}
            >
              <input id="file-input" type="file" accept=".xlsx" hidden onChange={(e) => setFile(e.target.files?.[0] || null)} />
              <Upload className={`mx-auto mb-4 ${isDragging ? "text-orange-500" : "text-orange-500/50"}`} size={48} />
              <p className="font-bold text-lg">{file ? file.name : "Arraste a planilha aqui ou clique"}</p>
            </div>
            <Button onClick={handleUpload} disabled={!file} className="w-full bg-orange-600 hover:bg-orange-500 h-16 text-lg font-black rounded-2xl">
              GERAR MATERIAIS
            </Button>
          </div>
        ) : isProcessing ? (
          <div className="bg-white/[0.03] p-10 rounded-3xl text-center space-y-6 border border-white/5">
            <Hourglass className="mx-auto animate-spin text-orange-500" size={40} />
            <div className="space-y-2">
              <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                <div className="bg-orange-500 h-full transition-all" style={{ width: `${progress?.percentage || 0}%` }} />
              </div>
              <p className="text-orange-200 text-sm italic">{progress?.currentCard || "Iniciando motores..."}</p>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 animate-in zoom-in-95">
            <div className="bg-green-500/10 border border-green-500/20 p-6 rounded-3xl text-center">
              <ShieldCheck className="mx-auto text-green-500 mb-2" size={32} />
              <h3 className="font-bold uppercase tracking-widest text-xs">Sucesso! Materiais Prontos</h3>
            </div>
            <Button onClick={() => window.open(`/api/download?path=${zipPath}`)} className="bg-orange-600 h-20 text-xl font-black rounded-2xl">
               <Download className="mr-3" /> DOWNLOAD ZIP
            </Button>
            <Button onClick={() => window.open(`/api/download?path=${jornalPath}`)} className="bg-blue-700 h-16 text-lg font-bold rounded-2xl">
               <FileText className="mr-2" /> DOWNLOAD JORNAL
            </Button>
            <button onClick={() => window.location.reload()} className="text-white/20 hover:text-white text-[10px] uppercase font-bold pt-4">Novo Processamento</button>
          </div>
        )}
      </div>

      <footer className="w-full max-w-2xl mx-auto mt-12 pt-6 border-t border-white/5 flex justify-between items-center text-white/20 text-[9px] uppercase tracking-[0.3em]">
        <div className="flex items-center gap-3">
          <span className="bg-white/5 px-2 py-0.5 rounded text-white/40">{APP_VERSION}</span>
          <p>© 2026</p>
        </div>
        <p>PRODUZIDO POR <span className="text-white/50 font-bold tracking-normal">SELPH MKT</span></p>
      </footer>
    </div>
  );
}
