import axios from "axios";
import { HandlerResponse } from "../../src/loyalty-api/core/handlerResponse";
import { ProductDTO } from "../../src/loyalty-api/core/loyaltyPointsDTO";

export class ApiDriver {
  apiEndpoint: string;
  constructor(apiEndpoint: string) {
    this.apiEndpoint = apiEndpoint;
  }

  async createProduct(name: string, price: number) {
    const createProductResult = await axios.post(
      `${this.apiEndpoint}/product`,
      {
        name: name,
        price: price,
      }
    );

    return createProductResult;
  }

  async getProduct(productId: string) {
    let getProductResult = await axios.get<HandlerResponse<ProductDTO>>(
      `${this.apiEndpoint}/product/${productId}`
    );

    return getProductResult;
  }

  async listProducts() {
    const listProductResult = await axios.get(`${this.apiEndpoint}/product`);

    return listProductResult;
  }

  async updateProduct(productId: string, name: string, price: number) {
    const updateProductResult = await axios.put(`${this.apiEndpoint}/product`, {
      id: productId,
      name: name,
      price: price,
    });

    return updateProductResult;
  }

  async deleteProduct(productId: string) {
    const deleteProductResult = await axios.delete(
      `${this.apiEndpoint}/product/${productId}`
    );

    return deleteProductResult;
  }
}
