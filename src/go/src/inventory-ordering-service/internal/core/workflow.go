package core

import "context"

type OrderingWorkflowEngine interface {
	StartOrderingWorkflowFor(ctx context.Context, productId string)
}
