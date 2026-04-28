import { z } from "zod";
import { publicProcedure, router } from "./trpc";
import { CardGenerator } from "./cardGenerator"; // CORRIGIDO: minúsculo conforme o arquivo
import path from "path";

const generator = new CardGenerator();
generator.initialize().catch(console.error);

export const appRouter = router({
  card: router({
    generateCards: publicProcedure
      .input(z.object({ 
        filePath: z.string(), 
        sessionId: z.string() 
      }))
      .mutation(async ({ input }) => {
        // Resolve o caminho absoluto e garante que é uma string
        const absolutePath = path.resolve(process.cwd(), String(input.filePath));
        const result = await generator.generateCards(absolutePath, input.sessionId);
        
        // Retorno simplificado para evitar erro 400 de transformação no tRPC
        return {
          zipPath: result.zipPath,
          jornalPath: result.jornalPath
        };
      }),
  }),
});

export type AppRouter = typeof appRouter;
