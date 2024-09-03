using FluentValidation;

namespace ProductApi.Core;

public record ProductName(string Value);

public record ProductPrice(decimal Value);

public record ProductDetails
{
    public ProductDetails(ProductName name, ProductPrice price)
    {
        Name = name.Value;
        Price = price.Value;
        
        this.ValidWhen(validator =>
        {
            validator.RuleFor(detail => detail.Name).NotEmpty().MinimumLength(3);
            validator.RuleFor(detail => detail.Price).NotEmpty().GreaterThan(0);
        });
    }
    
    public string Name { get; private set; }
    public decimal Price { get; private set; }
}

public static class FluentValidaitonExtensions
{
    public static void ValidWhen<T>(this T instance, Action<InlineValidator<T>> configure)
    {
        var validator = new InlineValidator<T>();
        configure(validator);
        
        validator.ValidateAndThrow(instance);
    }
}