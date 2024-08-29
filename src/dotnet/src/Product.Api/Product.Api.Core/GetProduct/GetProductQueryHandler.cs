namespace Product.Api.Core.GetProduct;

public class GetProductQueryHandler
{
    private readonly IProductRepository _productRepository;

    public GetProductQueryHandler(IProductRepository productRepository)
    {
        _productRepository = productRepository;
    }

    public async Task<HandlerResponse<ProductDto>> Handle(GetProductQuery query)
    {
        var product = await this._productRepository.GetProduct(query.productId);

        if (product is null)
        {
            return new HandlerResponse<ProductDto>(null, false, new List<string>(1) { "Producty not found" });
        }

        return new HandlerResponse<ProductDto>(new ProductDto(product), true, new List<string>());
    }
}