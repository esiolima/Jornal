import { useState, useRef, useEffect } from "react";
import { io, Socket } from "socket.io-client";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Upload, CheckCircle2, AlertCircle, Download, Hourglass, Image, Sun, Moon } from "lucide-react";

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
  const [isDark, setIsDark] = useState(true);
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

  // Handlers omitidos para brevidade (mantenha os originais)
  const handleFileSelect = (selectedFile: File | null | undefined) => { /* ... */ };
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => { handleFileSelect(e.target.files?.[0]); };
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files[0]);
  };

  const handleUpload = async () => {
    if (!file) { setError("Por favor, selecione um arquivo"); return; }
    setIsProcessing(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const uploadResponse = await fetch("/api/upload", { method: "POST", body: formData });
      if (!uploadResponse.ok) throw new Error("Erro ao fazer upload");
      const { filePath, fileName } = await uploadResponse.json();
      setOriginalFileName(fileName);
      const result = await generateCardsMutation.mutateAsync({ filePath, sessionId, originalFileName: fileName });
      if (result.success) setZipPath(result.zipPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao processar");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = async () => { /* ... mantenha original ... */ };

  return (
    <div className="relative min-h-screen font-sans overflow-hidden bg-[#08080f] text-white selection:bg-orange-500/30">
      {/* Background Gradient do Protótipo */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0" style={{
          background: `
            radial-gradient(ellipse 60% 50% at 10% 100%, rgba(220,90,20,0.35) 0%, transparent 65%),
            radial-gradient(ellipse 50% 60% at 90% 0%, rgba(30,80,200,0.4) 0%, transparent 60%),
            radial-gradient(ellipse 40% 40% at 50% 110%, rgba(180,60,10,0.2) 0%, transparent 55%)
          `
        }}></div>
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-6">
        {/* Nav */}
        <nav className="flex justify-between items-center py-6 border-b border-white/10 mb-12">
          <span className="text-xl font-semibold tracking-tight">Gerador de <span className="text-orange-400">Cards</span></span>
          <button onClick={() => setIsDark(!isDark)} className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center hover:bg-white/5 transition-colors">
            {isDark ? <Sun className="w-4 h-4 text-orange-400" /> : <Moon className="w-4 h-4" />}
          </button>
        </nav>

        <div className="grid lg:grid-cols-3 gap-12">
          <div className="lg:col-span-2 space-y-8">
            {/* Hero Section */}
            <header>
              <span className="inline-block px-3 py-1 rounded-full bg-orange-500/15 border border-orange-500/35 text-orange-400 text-[11px] font-medium tracking-wider mb-6 uppercase">
                Versão 2.3.1
              </span>
              <h1 className="text-5xl font-extrabold leading-[1.1] tracking-tight mb-4">
                Transforme suas <br/><span className="text-orange-400">planilhas</span> em cards
              </h1>
              <p className="text-white/50 text-lg max-w-lg">
                Converta dados Excel em cards PDF profissionais em segundos. Rápido, paralelo e sem complicação.
              </p>
            </header>

            {/* Main Action Area */}
            <div className="space-y-4">
              {!isProcessing && !zipPath && (
                <>
                  <div 
                    onClick={() => document.getElementById("file-input")?.click()}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`group relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-300 bg-white/5 ${isDragging ? 'border-orange-400 bg-orange-500/5' : 'border-orange-500/40 hover:border-orange-500/60'}`}
                  >
                    <div className="flex flex-col items-center space-y-4">
                      <div className="w-16 h-16 rounded-full bg-orange-500/15 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Upload className="w-8 h-8 text-orange-400" />
                      </div>
                      <div>
                        <p className="text-lg font-medium text-white">Clique ou arraste seu arquivo</p>
                        <p className="text-sm text-white/30 mt-1">Apenas arquivos .xlsx — máximo 10 MB</p>
                      </div>
                    </div>
                    <input id="file-input" type="file" accept=".xlsx" onChange={handleInputChange} className="hidden" />
                  </div>

                  {file && (
                    <div className="bg-white/5 rounded-xl p-4 flex items-center justify-between border border-white/10">
                      <div className="flex items-center space-x-3">
                        <CheckCircle2 className="w-5 h-5 text-orange-400" />
                        <span className="text-sm font-medium">{file.name}</span>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setFile(null)} className="text-white/40 hover:text-white">Remover</Button>
                    </div>
                  )}

                  <div className="flex gap-3">
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
                      <Image className="w-5 h-5" />
                      Gerenciar logos
                    </Button>
                  </div>
                </>
              )}

              {/* Progress and Success States (Estilizados com as cores do tema) */}
              {isProcessing && progress && (
                <div className="bg-white/5 rounded-2xl p-8 border border-white/10 text-center space-y-6">
                  <div className="animate-spin inline-block"><Hourglass className="w-12 h-12 text-orange-400" /></div>
                  <h2 className="text-2xl font-bold">Processando Cards...</h2>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm text-white/50 mb-1">
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
                <div className="bg-white/5 rounded-2xl p-8 border border-white/10 text-center space-y-6">
                   <CheckCircle2 className="w-16 h-16 text-teal-400 mx-auto" />
                   <h2 className="text-2xl font-bold">Concluído com sucesso!</h2>
                   <Button onClick={handleDownload} className="w-full bg-teal-600 hover:bg-teal-700 text-white h-14 rounded-xl font-bold text-lg">
                     <Download className="w-5 h-5 mr-2" /> Baixar Cards (ZIP)
                   </Button>
                   <Button variant="ghost" onClick={() => { setFile(null); setZipPath(null); }} className="text-white/40">Processar novo arquivo</Button>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar Features */}
          <div className="flex flex-col gap-4">
            <FeatureCard 
              icon={<StarIcon color="orange" />} 
              title="Múltiplos tipos" 
              desc="Cupons, promoções, cashback e BC" 
            />
            <FeatureCard 
              icon={<BoltIcon color="blue" />} 
              title="Processamento rápido" 
              desc="Paralelo com progresso em tempo real" 
            />
            <FeatureCard 
              icon={<DownloadIcon color="teal" />} 
              title="Download fácil" 
              desc="Todos os cards em um arquivo ZIP" 
            />
          </div>
        </div>

        <footer className="mt-20 py-8 border-t border-white/5 text-center text-white/20 text-xs">
          Desenvolvido por Esio Lima &mdash; Versão 2.3.1
        </footer>
      </div>
    </div>
  );
}

// Componentes auxiliares para manter o código limpo
function FeatureCard({ icon, title, desc }: { icon: any, title: string, desc: string }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:bg-white/[0.07] transition-colors">
      <div className="flex gap-4 items-start">
        {icon}
        <div>
          <h3 className="text-sm font-semibold mb-1">{title}</h3>
          <p className="text-[11px] text-white/40 leading-relaxed">{desc}</p>
        </div>
      </div>
    </div>
  );
}

const StarIcon = ({ color }: { color: string }) => (
  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${color === 'orange' ? 'bg-orange-500/15' : ''}`}>
    <svg className="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
  </div>
);

const BoltIcon = ({ color }: { color: string }) => (
  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${color === 'blue' ? 'bg-blue-500/15' : ''}`}>
    <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
  </div>
);

const DownloadIcon = ({ color }: { color: string }) => (
  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${color === 'teal' ? 'bg-teal-500/15' : ''}`}>
    <svg className="w-4 h-4 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
  </div>
);
