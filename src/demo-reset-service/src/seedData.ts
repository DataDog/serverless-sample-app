//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

export interface SeedProduct {
  name: string;
  price: number;
}

export const SEED_PRODUCTS: SeedProduct[] = [
  { name: 'ServerlessConf Hoodie', price: 49.99 },
  { name: 'Cloud Native T-Shirt', price: 24.99 },
  { name: 'Kubernetes Backpack', price: 89.99 },
  { name: 'Microservices Mug', price: 14.99 },
  { name: 'Developer Laptop Stand', price: 79.99 },
];
