import { useState, useRef, useEffect } from "react";
import { io, Socket } from "socket.io-client";
import { trpc } from "@/lib/trpc"; // Ajuste conforme sua estrutura de tRPC
import { Button } from "@/components/ui/button";
import { 
  Upload, 
  CheckCircle2, 
  Download, 
  Hourglass, 
  Image as ImageIcon, 
  AlertCircle, 
  X,
  FileText
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
  const [isDragging, setIsDragging] = useState(false);
  const [sessionId] = useState(() => `session_${Math.random().toString(36).substr(2, 9)}`);
  
  const socketRef = useRef<Socket | null>(null);
  const generateCardsMutation = trpc.card.generateCards.useMutation();

  // Configuração do WebSocket para progresso em tempo real
  useEffect(() => {
    const socket = io({ 
      reconnection: true, 
      reconnectionAttempts: 5 
    });

    socket.on("connect", () => {
      socket.emit("join", sessionId);
    });

    socket.on("progress", (data: ProgressData) => {
      setProgress(data);
    });

    socket.on("error", (message: string) => {
      setError(message);
      setIsProcessing(false);
    });

    socketRef.current = socket;
    return () => { socket.disconnect(); };
  }, [sessionId]);

  const handleFileSelect = (selectedFile: File | null | undefined) => {
    if (!selectedFile) return;
    if (!selectedFile.name.endsWith(".xlsx")) {
      setError("Por favor, selecione apenas arquivos Excel (.xlsx)");
      return;
    }
    setFile(selectedFile);
    setError(null);
    setZipPath(null);
    setJornalPath(null);
  };

  const handleUpload = async () => {
    if (!file) return;
    setIsProcessing(true);
    setError(null);
    setProgress({ total: 0, processed: 0, percentage: 0, currentCard: "Iniciando..." });

    try {
      const formData = new FormData();
      formData.append("file", file);

      // 1. Upload do arquivo para o servidor
      const uploadResponse = await fetch("/api/upload", { 
        method: "POST", 
        body: formData 
      });
      
      if (!uploadResponse.ok) throw new Error("Falha no upload do arquivo.");

      const { filePath, fileName } = await uploadResponse.json();

      // 2. Chamada da Mutação para processar os cards e o jornal
      const result = await generateCardsMutation.mutateAsync({ 
        filePath, 
        sessionId, 
        originalFileName: fileName 
      });
      
      if (result.success) {
        setZipPath(result.zipPath);
        setJornalPath(result.jornalPath);
      }
    } catch (err: any) {
      setError(err.message || "Erro inesperado ao processar a planilha.");
    } finally {
      setIsProcessing(false);
    }
  };

  const resetProcess = () => {
    setFile(null);
    setZipPath(null);
    setJornalPath(null);
    setProgress(null);
    setError(null);
  };

  return (
    <div className="relative min-h-screen bg-[#08080f] text-white font-sans overflow-x-hidden">
      {/* Background Decorativo */}
      <div className="absolute inset-0 pointer-events-none opacity-30">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-orange-600/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-600/20 blur-[120px] rounded-full" />
      </div>

      {/* Popup de Erro Detalhado */}
      {error && (
        <div className="fixed top-10 left-1/2 -translate-x-1/2 z-[100] w-full max-w-lg px-4 animate-in fade-in slide-in-from-top-5">
          <div className="bg-red-950/80 border border-red-500/50 backdrop-blur-xl p-5 rounded-2xl flex items-start gap-4 shadow-2xl">
            <AlertCircle className="w-6 h-6 text-red-500 shrink-0 mt-1" />
            <div className="flex-1">
              <h3 className="font-bold text-red-200 uppercase tracking-wider text-sm">Erro Detectado</h3>
              <p className="text-red-300/90 text-sm mt-1 leading-relaxed">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="hover:rotate-90 transition-transform p-1">
              <X className="w-5 h-5 text-red-400" />
            </button>
          </div>
        </div>
      )}

      <div className="relative z-10 max-w-4xl mx-auto px-6 pt-20 pb-20">
        <header className="text-center space-y-4 mb-16">
          <h1 className="text-6xl font-black tracking-tighter leading-none">
            GERADOR DE <span className="text-orange-500">CARDS</span>
          </h1>
          <p className="text-white/40 text-lg max-w-xl mx-auto">
            Transforme planilhas em cards profissionais e jornais diagramados automaticamente.
          </p>
        </header>

        <main className="max-w-2xl mx-auto">
          {/* ESTADO INICIAL: Seleção de Arquivo */}
          {!isProcessing && !zipPath && (
            <div className="space-y-8 animate-in fade-in duration-500">
              <div 
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFileSelect(e.dataTransfer.files[0]); }}
                onClick={() => document.getElementById("file-input")?.click()}
                className={`
                  group relative border-2 border-dashed rounded-3xl p-16 transition-all duration-300 cursor-pointer
                  ${isDragging ? 'border-orange-500 bg-orange-500/10' : 'border-white/10 bg-white/5 hover:border-orange-500/40'}
                `}
              >
                <input id="file-input" type="file" accept=".xlsx" onChange={(e) => handleFileSelect(e.target.files?.[0])} className="hidden" />
                <div className="flex flex-col items-center gap-6">
                  <div className="w-20 h-20 rounded-full bg-orange-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Upload className="w-10 h-10 text-orange-500" />
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-bold">Arraste sua planilha Excel</p>
                    <p className="text-white/30 text-sm mt-2">Suporta apenas arquivos .xlsx</p>
                  </div>
                </div>
              </div>

              {file && (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between animate-in slide-in-from-bottom-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-500/20 rounded-lg"><CheckCircle2 className="w-5 h-5 text-green-500" /></div>
                    <span className="font-medium truncate max-w-[250px]">{file.name}</span>
                  </div>
                  <Button variant="ghost" onClick={() => setFile(null)} className="hover:bg-red-500/10 hover:text-red-500">Remover</Button>
                </div>
              )}

              <Button 
                onClick={handleUpload} 
                disabled={!file}
                className="w-full bg-orange-600 hover:bg-orange-700 h-16 rounded-2xl text-xl font-black shadow-xl shadow-orange-950/20 disabled:opacity-30 transition-all"
              >
                INICIAR PROCESSAMENTO
              </Button>
            </div>
          )}

          {/* ESTADO: Processando */}
          {isProcessing && progress && (
            <div className="bg-white/5 border border-white/10 rounded-3xl p-12 text-center space-y-8 animate-in zoom-in-95">
              <div className="relative w-24 h-24 mx-auto">
                <Hourglass className="w-full h-full text-orange-500 animate-spin-slow" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold uppercase tracking-widest">Processando Cards</h2>
                <p className="text-white/40 text-sm">{progress.currentCard}</p>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between text-sm font-bold">
                  <span className="text-orange-500">{progress.processed} de {progress.total}</span>
                  <span>{progress.percentage}%</span>
                </div>
                <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                  <div 
                    className="h-full bg-gradient-to-r from-orange-600 to-orange-400 transition-all duration-500" 
                    style={{ width: `${progress.percentage}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ESTADO FINAL: Download dos Arquivos */}
          {zipPath && (
            <div className="bg-white/5 border border-white/10 rounded-3xl p-12 text-center space-y-10 animate-in zoom-in-95">
              <div className="w-24 h-24 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-12 h-12 text-green-500" />
              </div>
              
              <div className="space-y-2">
                <h2 className="text-3xl font-black uppercase">Sucesso!</h2>
                <p className="text-white/40">Seus documentos foram gerados e estão prontos para download.</p>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <Button 
                  onClick={() => window.location.href=`/api/download?path=${zipPath}`}
                  className="bg-orange-600 hover:bg-orange-700 h-16 rounded-2xl font-bold flex items-center justify-center gap-3 text-lg"
                >
                  <Download className="w-6 h-6" /> BAIXAR PACOTE ZIP (CARDS)
                </Button>

                {jornalPath && (
                  <Button 
                    onClick={() => window.location.href=`/api/download?path=${jornalPath}`}
                    className="bg-blue-600 hover:bg-blue-700 h-16 rounded-2xl font-bold flex items-center justify-center gap-3 text-lg"
                  >
                    <FileText className="w-6 h-6" /> BAIXAR JORNAL DIAGRAMADO (PDF)
                  </Button>
                )}

                <button 
                  onClick={resetProcess}
                  className="mt-4 text-white/20 hover:text-white transition-colors text-sm font-medium uppercase tracking-widest"
                >
                  Fazer novo upload
                </button>
              </div>
            </div>
          )}
        </main>

        <footer className="mt-20 text-center border-t border-white/5 pt-10">
          <p className="text-white/10 text-xs font-medium tracking-widest uppercase">
            Sistema de Automação de Cards — Desenvolvido por Esio Lima
          </p>
        </footer>
      </div>
    </div>
  );
}
