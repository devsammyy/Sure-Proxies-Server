// dtos/proxy.dto.ts
export class ProxyOrderModel {
  id: string;
  label: string;
  plans?: ProxyOrderPlanModel[];
}

export class ProxyOrderPlanModel {
  id: string;
  label: string;
}

export class PurchaseOrderModel {
  id: string;
  userId: string;
  serviceId: string;

  planId?: string; // Optional for traffic-only services
  profitPrice: number;
  status: 'pending' | 'active' | 'expired';
  createdAt: Date;
  details?: any;
}

export class PriceResponseModel {
  appliedDiscounts: number[]; // You can replace 'any' with a more specific type if known
  finalPrice: number;
  priceNoDiscounts: number;
  discount: number;
  unitPrice: number;
  unitPriceAfterDiscount: number;
  additionalAmount: number;
  additionalAmountAfterDiscount: number;
  paymentFee: number;
  subtotal: number;
  discountAmount: number;
  finalPriceInCurrency: number;
  currency: string;
}

export class Isp {
  id: string;
  label: string;
}

export class IspsByCountry {
  [countryCode: string]: Isp[];
}

export class Periods {
  months: number[];
  days: number[];
}

export class ServiceDetailsResponseModel {
  serviceId: string;
  countries: string[];
  isps: IspsByCountry;
  periods: Periods;
}

export class PendingOptions {
  quantity?: number;
  period?: { unit: 'months' | 'days' | 'years'; value: number };
  autoExtend?: { isEnabled: boolean };
  traffic?: number;
  country?: string;
  ispId?: string;
  couponCode?: string;
}

export class PendingDataModel {
  userId: string;
  serviceId: string;
  planId?: string; // Optional for traffic-only services
  pricePaid: number;
  expectedPrice?: number; // Expected price in Naira for validation
  options: PendingOptions;
}

export class ProxyOrderPurchaseModel {
  id: string;
  periodInMonths: number;
  bandwidth: number;
  totalPrice: number;
}

export class TxDoc {
  finalized?: boolean;
}

export type FinalizeTxResult =
  | { status: 'no_pending' }
  | { status: 'no_tx' }
  | { status: 'already_finalized' }
  | { status: 'ok'; pending: PendingDataModel; txData: TxDoc };
