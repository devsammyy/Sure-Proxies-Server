// dtos/proxy.dto.ts
export interface ProxyService {
  serviceId: string;
  name: string;
  plans?: ProxyPlan[];
  basePrice: number;
}

export interface ProxyPlan {
  planId: string;
  name: string;
  basePrice: number;
}

export interface PurchaseDto {
  userId: string;
  proxyServiceId: string;
  proxyPlanId: string;
  pricePaid: number;
  status: 'pending' | 'active' | 'expired';
  createdAt: Date;
  details?: any;
}
