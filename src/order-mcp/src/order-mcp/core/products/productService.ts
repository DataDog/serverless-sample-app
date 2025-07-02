import axios, { AxiosInstance } from "axios";
import { getParameter } from "@aws-lambda-powertools/parameters/ssm";
import { Logger } from "@aws-lambda-powertools/logger";

export interface ProductDTO {
  id: string;
  name: string;
  price: number;
}

const logger = new Logger({});

export interface ProductService {
  getAvailableProducts: () => Promise<ProductDTO[]>;
}

export const createProductService = async (
  authToken: string
): Promise<ProductService> => {
  const currentEnvironment = process.env.ENV || "local";

  const integratedEnvironments = ["dev", "staging", "prod"];

  if (integratedEnvironments.includes(currentEnvironment)) {
    // In production or staging, use the real product service
    return await createHttpProductServiceInstance(authToken);
  } else {
    // In local or development environments, use the mock product service
    return new MockProductService();
  }
};

export class MockProductService implements ProductService {
  async getAvailableProducts(): Promise<ProductDTO[]> {
    // Return mock products for testing purposes
    return [
      { id: "mock-product-a", name: "Mock Product A", price: 50 },
      { id: "mock-product-b", name: "Mock Product B", price: 75 },
      { id: "mock-product-c", name: "Mock Product C", price: 100 },
    ];
  }
}

const createHttpProductServiceInstance = async (
  authToken: string
): Promise<ProductService> => {
  const productApiEndpoint = await getParameter(
    `/${process.env.ENV}/ProductService/api-endpoint`,
    {
      decrypt: true,
    }
  );

  if (!productApiEndpoint) {
    logger.warn("Product API endpoint is not configured.");

    throw new Error(
      "Product API endpoint is not configured. Please check your environment variables."
    );
  }

  const productApiClient = axios.create({
    baseURL: productApiEndpoint,
  });

  return new HttpProductService(
    productApiEndpoint,
    authToken,
    productApiClient
  );
};

class HttpProductService implements ProductService {
  apiEndpoint: string;
  authToken: string;
  productApiClient: AxiosInstance | undefined;

  constructor(
    apiEndpoint: string,
    authToken: string,
    productApiClient?: AxiosInstance
  ) {
    this.apiEndpoint = apiEndpoint;
    this.productApiClient = productApiClient;
    this.authToken = authToken;
  }

  async getAvailableProducts(): Promise<ProductDTO[]> {
    const response = await fetch(`${this.apiEndpoint}/product`);
    if (!response.ok) {
      throw new Error("Failed to fetch products from the API");
    }
    return response.json();
  }
}
