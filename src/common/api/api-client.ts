import axios from 'axios';

export class ApiClient {
  apiKey = process.env.PROXY_CHEAP_API_KEY;
  apiSecretKey = process.env.PROXY_CHEAP_API_SECRET;
  paymentPointSecretKey = process.env.PAYMENTPOINT_SECRET;
  paymentPointApiKey = process.env.PAYMENTPOINT_APIKEY;

  constructor(private readonly baseUrl: string) {}

  async get<T>(
    endpoint: string,
    params?: Record<string, any>,
  ): Promise<T | null> {
    try {
      const response = await axios.get<T>(`${this.baseUrl}${endpoint}`, {
        params,
        headers: {
          'X-Api-Key': this.apiKey,
          'X-Api-Secret': this.apiSecretKey,
        },
      });
      if (response.status !== 200) {
        throw new Error(
          'Service temporarily unavailable. Please try again later.',
        );
      }
      return response.data;
    } catch (error) {
      console.error(`Error fetching ${endpoint}: `, error);
      return null;
    }
  }

  async post<T>(endpoint: string, data?: any): Promise<T | null> {
    try {
      const response = await axios.post<T>(`${this.baseUrl}${endpoint}`, data, {
        headers: {
          'X-Api-Key': this.apiKey,
          'X-Api-Secret': this.apiSecretKey,
        },
      });
      if (response.status !== 201) {
        throw new Error('Unable to create resource. Please try again.');
      }
      return response.data;
    } catch (error) {
      console.error(`Error fetching ${endpoint}: `, error);
      return null;
    }
  }

  async put<T>(endpoint: string, data?: any): Promise<T | null> {
    try {
      const response = await axios.put<T>(`${this.baseUrl}${endpoint}`, data, {
        headers: {
          'X-Api-Key': this.apiKey,
          'X-Api-Secret': this.apiSecretKey,
        },
      });
      if (response.status !== 200) {
        throw new Error('Unable to update resource. Please try again.');
      }
      return response.data;
    } catch (error) {
      console.error(`Error fetching ${endpoint}: `, error);
      return null;
    }
  }

  async delete<T>(endpoint: string): Promise<T | null> {
    try {
      const response = await axios.delete<T>(`${this.baseUrl}${endpoint}`, {
        headers: {
          'X-Api-Key': this.apiKey,
          'X-Api-Secret': this.apiSecretKey,
        },
      });
      if (response.status !== 200) {
        throw new Error('Unable to delete resource. Please try again.');
      }
      return response.data;
    } catch (error) {
      console.error(`Error fetching ${endpoint}: `, error);
      return null;
    }
  }

  async postPaymentPoint<T>(endpoint: string, data?: any): Promise<T | null> {
    try {
      const response = await axios.post<T>(`${this.baseUrl}${endpoint}`, data, {
        headers: {
          Authorization: `Bearer ${this.paymentPointSecretKey}`,
          'Content-Type': 'application/json',
          'api-key': this.paymentPointApiKey,
        },
      });
      if (response.status !== 201) {
        throw new Error('Payment processing failed. Please try again.');
      }
      return response.data;
    } catch (error) {
      console.error(`Error fetching ${endpoint}: `, error);
      return null;
    }
  }
}
