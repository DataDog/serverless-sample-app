package core

type PriceLessThanZeroError struct{ Detail string }

func (e *PriceLessThanZeroError) Error() string {
	return "Input price is less than 0"
}

type MissingProductIdError struct{ Detail string }

func (e *MissingProductIdError) Error() string {
	return "Event is missing a productId"
}
