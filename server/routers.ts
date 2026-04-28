import { z } from "zod";
import { publicProcedure, router } from "./trpc";
import { CardGenerator } from "./cardGenerator"; // Nome exato do arquivo no seu GitHub
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
        // Garantindo que o path seja resolvido corretamente no Linux do Railway
        const absolutePath = path.resolve(process.cwd(), input.filePath);
        return await generator.generateCards(absolutePath, input.sessionId);
      }),
  }),
});

export type AppRouter = typeof appRouter;
