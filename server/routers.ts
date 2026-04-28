import { z } from "zod";
import { publicProcedure, router } from "./trpc";
import { CardGenerator } from "./cardGenerator"; // Corrigido para o seu arquivo real
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
        // Resolve o caminho para evitar erro de string/object no Railway
        const absolutePath = path.isAbsolute(input.filePath) 
          ? input.filePath 
          : path.resolve(process.cwd(), input.filePath);
          
        return await generator.generateCards(absolutePath, input.sessionId);
      }),
  }),
});

export type AppRouter = typeof appRouter;
