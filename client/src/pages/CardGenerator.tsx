import { useState, useRef, useEffect } from "react";
import { io, Socket } from "socket.io-client";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Upload, CheckCircle2, Download, Hourglass, Image as ImageIcon } from "lucide-react";

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
  const [error, setError] = useState<string | null>(null);
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const [isDragging, setIsDragging] = useState(false);
  const [originalFileName, setOriginalFileName] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const [, setLocation] = useLocation();

  const generateCardsMutation = trpc.card.generateCards.useMutation();

  useEffect(() => {
    const socket = io({ reconnection: true, reconnectionDelay: 1000, reconnectionDelayMax: 5000, reconnectionAttempts: 5 });
    socket.on("connect", () => { socket.emit("join", sessionId); });
    socket.on("progress", (data: ProgressData) => setProgress(data));
    socket.on("error", (message: string) => { setError(message); setIsProcessing(false); });
    socketRef.current = socket;
    return () => { socket.disconnect(); };
  }, [sessionId]);

  const handleFileSelect = (selectedFile: File | null | undefined) => {
    if (!selectedFile) return;
    setFile(selectedFile);
    setError(null);
    setZipPath(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => handleFileSelect(e.target.files?.[0]);
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files[0]);
  };

  const handleUpload = async () => {
    if (!file) return;
    setIsProcessing(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const uploadResponse = await fetch("/api/upload", { method: "POST", body: formData });
      const { filePath, fileName } = await uploadResponse.json();
      setOriginalFileName(fileName);
      const result = await generateCardsMutation.mutateAsync({ filePath, sessionId, originalFileName: fileName });
      if (result.success) setZipPath(result.zipPath);
    } catch (err) {
      setIsProcessing(false);
    }
  };

  return (
    <div className="relative min-h-screen font-sans overflow-hidden bg-[#08080f] text-white">
      {/* Background Gradient */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0" style={{
          background: `
            radial-gradient(ellipse 60% 50% at 10% 100%, rgba(220,90,20,0.3) 0%, transparent 65%),
            radial-gradient(ellipse 50% 60% at 90% 0%, rgba(30,80,200,0.35) 0%, transparent 60%),
            radial-gradient(ellipse 40% 40% at 50% 110%, rgba(180,60,10,0.2) 0%, transparent 55%)
          `
        }}></div>
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-6 pt-24">
        <div className="max-w-2xl mx-auto space-y-10 text-center">
          
          <header className="space-y-4">
            <h1 className="text-5xl font-extrabold leading-tight tracking-tight">
              Transforme suas <br/><span className="text-orange-400">planilhas</span> em cards
            </h1>
            <p className="text-white/50 text-lg">
              Converta dados Excel em cards PDF profissionais em segundos.
            </p>
          </header>

          <div className="space-y-6">
            {!isProcessing && !zipPath && (
              <>
                <div 
                  onClick={() => document.getElementById("file-input")?.click()}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`group relative border-2 border-dashed rounded-2xl p-16 transition-all duration-300 bg-white/5 cursor-pointer ${isDragging ? 'border-orange-400 bg-orange-500/5' : 'border-orange-500/30 hover:border-orange-500/50'}`}
                >
                  <div className="flex flex-col items-center space-y-4">
                    <div className="w-16 h-16 rounded-full bg-orange-500/15 flex items-center justify-center">
                      <Upload className="w-8 h-8 text-orange-400" />
                    </div>
                    <div>
                      <p className="text-xl font-medium">Clique ou arraste seu arquivo</p>
                      <p className="text-sm text-white/30 mt-2">Apenas arquivos .xlsx — máximo 10 MB</p>
                    </div>
                  </div>
                  <input id="file-input" type="file" accept=".xlsx" onChange={handleInputChange} className="hidden" />
                </div>

                {file && (
                  <div className="bg-white/5 rounded-xl p-4 flex items-center justify-between border border-white/10 max-w-md mx-auto">
                    <div className="flex items-center space-x-3">
                      <CheckCircle2 className="w-5 h-5 text-orange-400" />
                      <span className="text-sm font-medium truncate">{file.name}</span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setFile(null)} className="text-white/40 hover:text-white">Remover</Button>
                  </div>
                )}

                <div className="flex gap-4 max-w-md mx-auto">
                  <Button 
                    onClick={handleUpload} 
                    disabled={!file} 
                    className="flex-1 bg-orange-600 hover:bg-orange-700 text-white h-14 rounded-xl font-bold text-lg shadow-lg shadow-orange-900/20 disabled:opacity-50"
                  >
                    Processar planilha
                  </Button>
                  <Button 
                    onClick={() => setLocation("/logos")} 
                    className="bg-white/10 hover:bg-white/15 text-white border border-white/10 h-14 px-6 rounded-xl font-medium flex items-center gap-2"
                  >
                    <ImageIcon className="w-5 h-5" />
                    Logos
                  </Button>
                </div>
              </>
            )}

            {isProcessing && progress && (
              <div className="bg-white/5 rounded-2xl p-10 border border-white/10 space-y-8">
                <div className="animate-spin inline-block"><Hourglass className="w-12 h-12 text-orange-400" /></div>
                <h2 className="text-2xl font-bold">Processando Cards...</h2>
                <div className="max-w-sm mx-auto space-y-3">
                  <div className="flex justify-between text-sm text-white/50">
                    <span>{progress.currentCard}</span>
                    <span className="text-orange-400 font-bold">{progress.percentage}%</span>
                  </div>
                  <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-orange-500 transition-all duration-300" style={{ width: `${progress.percentage}%` }}></div>
                  </div>
                </div>
              </div>
            )}

            {zipPath && (
              <div className="bg-white/5 rounded-2xl p-10 border border-white/10 space-y-8">
                <CheckCircle2 className="w-16 h-16 text-teal-400 mx-auto" />
                <h2 className="text-2xl font-bold">Concluído com sucesso!</h2>
                <div className="max-w-sm mx-auto space-y-4">
                  <Button onClick={() => window.location.href=`/api/download?zipPath=${zipPath}`} className="w-full bg-teal-600 hover:bg-teal-700 text-white h-14 rounded-xl font-bold text-lg">
                    <Download className="w-5 h-5 mr-2" /> Baixar Cards (ZIP)
                  </Button>
                  <Button variant="ghost" onClick={() => { setFile(null); setZipPath(null); setIsProcessing(false); }} className="text-white/40">Novo processamento</Button>
                </div>
              </div>
            )}
          </div>
        </div>

        <footer className="mt-32 py-8 border-t border-white/5 text-center text-white/20 text-xs">
          Desenvolvido por Esio Lima — V2.3.3
        </footer>
      </div>
    </div>
  );
}
