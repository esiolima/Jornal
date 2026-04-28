import { useState, useRef, useEffect } from "react";
import { io, Socket } from "socket.io-client";
import { trpc } from "@/lib/trpc"; 
import { Button } from "@/components/ui/button";
import { 
  Upload, 
  CheckCircle2, 
  Download, 
  Hourglass, 
  FileText, 
  AlertCircle, 
  X 
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
      if (!res.ok) throw new Error("Falha no upload");
      const { filePath } = await res.json();

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
    <div className="min-h-screen bg-[#0a0a0f] text-white p-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <header className="text-center">
          <h1 className="text-4xl font-black">GERADOR DE <span className="text-orange-500">CARDS</span></h1>
        </header>

        {error && (
          <div className="bg-red-500/20 border border-red-500 p-4 rounded-xl flex justify-between">
            <p className="text-red-200">{error}</p>
            <button onClick={() => setError(null)}><X size={18}/></button>
          </div>
        )}

        {!isProcessing && !zipPath ? (
          <div className="space-y-4">
            <div 
              onClick={() => document.getElementById("file-input")?.click()}
              className="border-2 border-dashed border-white/10 rounded-3xl p-20 text-center hover:border-orange-500/50 cursor-pointer bg-white/5"
            >
              <input id="file-input" type="file" accept=".xlsx" hidden onChange={(e) => setFile(e.target.files?.[0] || null)} />
              <Upload className="mx-auto mb-4 text-orange-500" size={48} />
              <p className="font-bold">{file ? file.name : "Clique para selecionar a planilha"}</p>
            </div>
            <Button onClick={handleUpload} disabled={!file} className="w-full bg-orange-600 h-14 text-lg font-bold">
              GERAR MATERIAIS
            </Button>
          </div>
        ) : isProcessing ? (
          <div className="bg-white/5 p-10 rounded-3xl text-center space-y-6">
            <Hourglass className="mx-auto animate-spin text-orange-500" size={40} />
            <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
              <div className="bg-orange-500 h-full transition-all" style={{ width: `${progress?.percentage}%` }} />
            </div>
            <p>{progress?.currentCard || "Iniciando..."}</p>
          </div>
        ) : (
          <div className="grid gap-4">
            <Button onClick={() => window.open(`/api/download?path=${zipPath}`)} className="bg-orange-600 h-16 text-lg font-bold">
               <Download className="mr-2" /> BAIXAR CARDS (ZIP)
            </Button>
            <Button onClick={() => window.open(`/api/download?path=${jornalPath}`)} className="bg-blue-600 h-16 text-lg font-bold">
               <FileText className="mr-2" /> BAIXAR JORNAL (PDF)
            </Button>
            <Button variant="ghost" onClick={() => window.location.reload()}>Novo Upload</Button>
          </div>
        )}
      </div>
    </div>
  );
}
