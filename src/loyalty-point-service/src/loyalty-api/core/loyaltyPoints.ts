//
// Unless explicitly stated otherwise all files in this repository are licensed
// under the Apache License Version 2.0.
// This product includes software developed at Datadog (https://www.datadoghq.com/).
// Copyright 2024 Datadog, Inc.
//

export class LoyaltyPoints {
  userId: string;
  currentPoints: number;
  orders: string[]


  constructor(userId: string, currentPoints: number, orders: string[]) {
    this.userId = userId;
    this.currentPoints = currentPoints;
    this.orders = orders;
  }
  
  addPoints(orderNumber: string, points: number): boolean {
    if (this.orders.includes(orderNumber)) {
      return false;
    }
    this.orders.push(orderNumber);
    this.currentPoints += points;
    return true;
  }

  spendPoints(points: number): boolean {
    if (this.currentPoints < points) {
      return false;
    }
    this.currentPoints -= points;
    return true;
  }
}
