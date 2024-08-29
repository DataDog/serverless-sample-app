using FluentValidation;

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