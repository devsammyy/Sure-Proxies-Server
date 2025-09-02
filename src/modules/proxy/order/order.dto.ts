// dtos/proxy.dto.ts
export interface ProxyOrderDto {
  id: string;
  name: string;
  plans?: ProxyOrderPlanDto[];
  basePrice: number;
}

export interface ProxyOrderPlanDto {
  id: string;
  name: string;
  basePrice: number;
}

export interface PurchaseOrderDto {
  userId: string;
  proxyServiceId: string;
  proxyPlanId: string;
  pricePaid: number;
  status: 'pending' | 'active' | 'expired';
  createdAt: Date;
  details?: any;
}
