#!/bin/bash
function deploy {
  rm -r ./out/ -f
  mkdir out
  mkdir out/registerUserFunction
  mkdir out/loginFunction
  mkdir out/handleOrderCompletedFunction

  cargo lambda build --release --manifest-path src/user-management/lambdas/create_user/Cargo.toml
  zip -r -j out/registerUserFunction/registerUserFunction.zip target/lambda/create-user/bootstrap
  
  cargo lambda build --release --manifest-path src/user-management/lambdas/login/Cargo.toml
  zip -r -j out/loginFunction/loginFunction.zip target/lambda/login/bootstrap

  cargo lambda build --release --manifest-path src/user-management/lambdas/handle_order_completed_for_user/Cargo.toml
  zip -r -j out/handleOrderCompletedFunction/handleOrderCompletedFunction.zip target/lambda/handle-order-completed/bootstrap
}

deploy
