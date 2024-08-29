using FluentValidation;

namespace Product.Api.Core.CreateProduct;

public class CreateProductValidator : AbstractValidator<CreateProductCommand>
{
    public CreateProductValidator()
    {
        RuleFor(command => command.Name).NotEmpty().MinimumLength(3);
        RuleFor(command => command.Price).NotEmpty().GreaterThan(0);
    }
}