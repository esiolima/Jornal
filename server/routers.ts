import { z } from "zod";
import { publicProcedure, router } from "./trpc"; // Deve apontar para o arquivo criado no passo 2
import { CardGenerator } from "./cardGenerator"; // Nome minúsculo para bater com o arquivo
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
        const absolutePath = path.resolve(process.cwd(), input.filePath);
        return await generator.generateCards(absolutePath, input.sessionId);
      }),
  }),
});

export type AppRouter = typeof appRouter;
