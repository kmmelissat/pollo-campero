export type OrderEventType = "order.created" | "order.updated";

export interface OrderEventPayload {
  eventType: OrderEventType;
  orderId: string;
  status: string;
  timestamp: string;
  summary: string;
}
