import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { CardGenerator } from "../logic/CardGenerator"; // Certifique-se que o caminho está correto

export const cardRouter = router({
  generateCards: publicProcedure
    .input(
      z.object({
        filePath: z.string(),
        sessionId: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      // 1. Criamos a instância
      const generator = new CardGenerator();
      
      try {
        // 2. Inicializamos o Puppeteer
        await generator.initialize();
        
        // 3. Geramos os cards
        const result = await generator.generateCards(input.filePath, input.sessionId);
        
        return {
          success: true,
          zipPath: result.zipPath,
          jornalPath: result.jornalPath,
        };
      } catch (error: any) {
        console.error("Erro no processamento de cards:", error);
        throw new Error(error.message || "Falha ao gerar cards");
      } finally {
        // 4. SEMPRE fechamos o browser para não travar o servidor
        // O erro acontecia aqui porque o método não existia ou o 'generator' estava indefinido
        if (generator && typeof generator.close === 'function') {
          await generator.close();
        }
      }
    }),
});
