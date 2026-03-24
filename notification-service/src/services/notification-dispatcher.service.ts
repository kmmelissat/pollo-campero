import type { OrderEventPayload } from "@pollos/shared";

/**
 * Punto de extensión futuro: WebSocket, email, push, etc.
 * Por ahora solo registra el evento de forma estructurada.
 */
export class NotificationDispatcherService {
  dispatch(_event: OrderEventPayload): void {
    // Reservado: await emailProvider.send(...)
    // Reservado: wsServer.broadcast(...)
  }
}
