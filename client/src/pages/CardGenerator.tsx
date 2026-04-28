import { useState, useRef, useEffect } from "react";
import { io, Socket } from "socket.io-client";
import { trpc } from "@/lib/trpc"; 
import { Button } from "@/components/ui/button";
import { Upload, Download, Hourglass, FileText, X, ShieldCheck } from "lucide-react";

export default function CardGenerator() {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<any>(null);
  const [zipPath, setZipPath] = useState<string | null>(null);
  const [jornalPath, setJornalPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [sessionId] = useState(() => `sess_${Math.random().toString(36).substring(2, 9)}`);
  
  const socketRef = useRef<Socket | null>(null);
  const generateMutation = trpc.card.generateCards.useMutation();

  useEffect(() => {
    const socket = io();
    socket.on("connect", () => socket.emit("join", sessionId));
    socket.on("progress", (data) => setProgress(data));
    socket.on("error", (msg) => { setError(msg); setIsProcessing(false); });
    socketRef.current = socket;
    return () => { socket.disconnect(); };
  }, [sessionId]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile?.name.endsWith(".xlsx")) {
      setFile(droppedFile);
    } else {
      setError("Por favor, envie um arquivo Excel (.xlsx)");
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setIsProcessing(true);
    setZipPath(null);
    setJornalPath(null);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();

      // Correção para evitar erro de 'instance of Object'
      const result = await generateMutation.mutateAsync({ 
        filePath: String(data.filePath), 
        sessionId 
      });
      
      setZipPath(result.zipPath);
      setJornalPath(result.jornalPath);
    } catch (err: any) {
      setError(err.message || "Erro no processamento");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white p-8 flex flex-col justify-between font-sans">
      <div className="max-w-2xl mx-auto w-full space-y-8 flex-grow">
        <header className="text-center pt-8">
          <h1 className="text-4xl font-black italic tracking-tighter">
            GERADOR <span className="text-orange-500">PRO</span>
          </h1>
        </header>

        {error && (
          <div className="bg-red-500/10 border border-red-500/50 p-4 rounded-2xl flex justify-between items-center animate-in fade-in zoom-in-95">
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
                isDragging ? "border-orange-500 bg-orange-500/10 scale-[1.02]" : "border-white/10 bg-white/[0.02] hover:border-orange-500/20"
              }`}
            >
              <input id="file-input" type="file" accept=".xlsx" hidden onChange={(e) => setFile(e.target.files?.[0] || null)} />
              <Upload className={`mx-auto mb-4 ${isDragging ? "text-orange-500" : "text-orange-500/50"}`} size={48} />
              <p className="font-bold text-lg">{file ? file.name : "Arraste a planilha aqui ou clique"}</p>
            </div>
            <Button onClick={handleUpload} disabled={!file} className="w-full bg-orange-600 hover:bg-orange-500 h-16 text-lg font-black rounded-2xl transition-all shadow-lg shadow-orange-900/20">
              GERAR MATERIAIS
            </Button>
          </div>
        ) : isProcessing ? (
          <div className="bg-white/5 p-10 rounded-3xl space-y-6 border border-white/10 shadow-2xl">
            <Hourglass className="mx-auto animate-spin text-orange-500" size={32} />
            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <div className="flex flex-col">
                  <span className="text-[10px] text-white/30 uppercase tracking-tighter">Total</span>
                  <span className="text-xl font-black">{progress?.total || "0"}</span>
                </div>
                <div className="text-center">
                  <span className="text-[10px] text-orange-500/50 uppercase tracking-widest font-bold">Processando</span>
                  <p className="text-sm font-bold text-orange-200 uppercase tracking-tight">{progress?.currentType || "---"}</p>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[10px] text-white/30 uppercase tracking-tighter">Concluídos</span>
                  <span className="text-xl font-black text-green-500">{progress?.processed || "0"}</span>
                </div>
              </div>
              <div className="w-full bg-white/10 h-3 rounded-full overflow-hidden border border-white/5">
                <div className="bg-gradient-to-r from-orange-600 to-orange-400 h-full transition-all duration-500" style={{ width: `${progress?.percentage || 0}%` }} />
              </div>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 animate-in fade-in zoom-in-95 duration-500">
            <div className="bg-green-500/10 border border-green-500/20 p-6 rounded-3xl text-center mb-2">
              <ShieldCheck className="mx-auto text-green-500 mb-2" size={32} />
              <h3 className="font-bold text-sm uppercase">Processamento Finalizado</h3>
            </div>
            <Button onClick={() => window.open(`/api/download?path=${zipPath}`)} className="bg-orange-600 hover:bg-orange-500 h-20 text-xl font-black rounded-2xl shadow-lg flex items-center justify-center gap-3 transition-transform active:scale-95">
               <Download size={28} /> DOWNLOAD ZIP (CARDS)
            </Button>
            <Button onClick={() => window.open(`/api/download?path=${jornalPath}`)} className="bg-blue-700 hover:bg-blue-600 h-16 text-lg font-bold rounded-2xl flex items-center justify-center gap-3 transition-transform active:scale-95">
               <FileText size={24} /> DOWNLOAD JORNAL (PDF)
            </Button>
            <button onClick={() => window.location.reload()} className="text-white/20 hover:text-white text-[10px] uppercase font-bold pt-6 tracking-[0.2em]">Novo Processamento</button>
          </div>
        )}
      </div>

      <footer className="w-full max-w-2xl mx-auto mt-12 pt-6 border-t border-white/5 flex justify-between items-center text-[10px] text-white/20 uppercase tracking-[0.2em]">
        <p>v1.2.7</p>
        <p>Desenvolvido por <span className="text-white/50 font-bold">SELPH MKT</span></p>
      </footer>
    </div>
  );
}
