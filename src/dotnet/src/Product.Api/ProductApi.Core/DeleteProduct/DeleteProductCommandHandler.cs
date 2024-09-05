// Unless explicitly stated otherwise all files in this repository are licensed under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.

namespace ProductApi.Core.DeleteProduct;

public class DeleteProductCommandHandler(IProducts products, IEventPublisher eventPublisher)
{
    public async Task<HandlerResponse<bool>> Handle(DeleteProductCommand command)
    {
        await products.RemoveWithId(command.ProductId);

        await eventPublisher.Publish(new ProductDeletedEvent(command.ProductId));

        return new HandlerResponse<bool>(true, true, new List<string>(0));
    }
}