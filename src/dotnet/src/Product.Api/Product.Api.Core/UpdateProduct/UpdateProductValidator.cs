using FluentValidation;
using Product.Api.Core.CreateProduct;

namespace Product.Api.Core.UpdateProduct;

public class UpdateProductValidator : AbstractValidator<UpdateProductCommand>
{
    public UpdateProductValidator()
    {
        RuleFor(command => command.Id).NotEmpty();
        RuleFor(command => command.Name).NotEmpty().MinimumLength(3);
        RuleFor(command => command.Price).NotEmpty().GreaterThan(0);
    }
}