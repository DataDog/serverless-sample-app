using FluentValidation;

namespace Product.Api.Core.DeleteProduct;

public class DeleteProductValidator : AbstractValidator<DeleteProductCommand>
{
    public DeleteProductValidator()
    {
        RuleFor(command => command.ProductId).NotEmpty();
    }
}