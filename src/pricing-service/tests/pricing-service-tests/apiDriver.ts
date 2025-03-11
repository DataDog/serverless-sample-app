import axios from "axios";

export class ApiDriver {
  apiEndpoint: string;
  bearerToken: string;
  constructor(apiEndpoint: string, bearerToken: string) {
    this.apiEndpoint = apiEndpoint;
    this.bearerToken = bearerToken;
  }

  async generatePricing(name: string, price: number) {
    const generatePricingResult = await axios.post(
      `${this.apiEndpoint}/pricing`,
      {
        name: name,
        price: price,
      },
      {
        validateStatus: (status) =>
          (status >= 200 && status < 300) || status === 502,
        headers: {
          Authorization: `Bearer ${this.bearerToken}`,
        },
      }
    );

    return generatePricingResult;
  }
}
