export class PriceInputDto {
  planId: string;
  quantity: number;
  period: {
    unit: 'months' | 'days' | 'years';
    value: number;
  };
}

export class ProxyOrderPurchaseInputDto {
  userId: string;
  planId: string;
  quantity: number;
  country: string;
  ispId: string;
  period: {
    unit: 'months' | 'days' | 'years';
    value: number;
  };
  autoExtend: {
    isEnabled: boolean;
  };
  traffic: number;
}

export class ProxyOrderPlanInputDto {
  id: string;
  label: string;
}

export class PurchaseOrderInputDto {
  userId: string;
  planId: string;
  quantity: number;
  country: string;
  ispId: string;
  period: {
    unit: 'months' | 'days' | 'years';
    value: number;
  };
  autoExtend: {
    isEnabled: boolean;
  };
  traffic: number;
}
