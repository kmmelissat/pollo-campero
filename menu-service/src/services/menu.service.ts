import type { Product } from "../models/product";
import { MENU_SEED } from "./menu-seed";

export class MenuService {
  private readonly byId = new Map<string, Product>(
    MENU_SEED.map((p) => [p.id, p]),
  );

  getAll(): Product[] {
    return [...MENU_SEED];
  }

  getById(id: string): Product | undefined {
    return this.byId.get(id);
  }
}
