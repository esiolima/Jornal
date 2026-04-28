import { z } from "zod";
import { publicProcedure, router } from "./trpc";
import { CardGenerator } from "./cardGenerator"; 
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
        // FORÇA a conversão para string e resolve o caminho absoluto
        const cleanPath = String(input.filePath);
        const absolutePath = path.resolve(process.cwd(), cleanPath);
        
        return await generator.generateCards(absolutePath, input.sessionId);
      }),
  }),
});

export type AppRouter = typeof appRouter;
