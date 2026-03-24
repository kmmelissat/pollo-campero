import { z } from "zod";
import { AppError } from "../utils/app-error";

const productSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  price: z.number(),
  available: z.boolean(),
  category: z.string(),
});

const menuResponseSchema = z.object({
  success: z.literal(true),
  data: productSchema,
});

export type MenuProduct = z.infer<typeof productSchema>;

export class MenuClient {
  constructor(
    private readonly baseUrl: string,
    private readonly timeoutMs: number = 5000,
  ) {}

  async getProduct(productId: string): Promise<MenuProduct> {
    const url = `${this.baseUrl.replace(/\/$/, "")}/menu/${encodeURIComponent(productId)}`;
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) {
        if (res.status === 404) {
          throw new AppError(`Producto no encontrado: ${productId}`, 400);
        }
        throw new AppError("menu-service respondió con error", 502);
      }
      const json: unknown = await res.json();
      const parsed = menuResponseSchema.safeParse(json);
      if (!parsed.success) {
        throw new AppError("Respuesta inválida de menu-service", 502);
      }
      return parsed.data.data;
    } catch (e) {
      if (e instanceof AppError) throw e;
      if (e instanceof Error && e.name === "AbortError") {
        throw new AppError(
          "menu-service no respondió a tiempo (timeout)",
          504,
        );
      }
      throw new AppError(
        "No se pudo contactar a menu-service. Verifica MENU_SERVICE_URL.",
        503,
      );
    } finally {
      clearTimeout(t);
    }
  }
}
