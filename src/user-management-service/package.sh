#!/bin/bash
function deploy {
  rm -r ./out/ -f
  mkdir out
  mkdir out/registerUserFunction
  mkdir out/loginFunction
  mkdir out/getUserDetailsFunction
  mkdir out/handleOrderCompletedFunction
  mkdir out/oauthAuthorizeFunction
  mkdir out/oauthAuthorizeCallbackFunction
  mkdir out/oauthClientDeleteFunction
  mkdir out/oauthClientGetFunction
  mkdir out/oauthClientUpdateFunction
  mkdir out/oauthDcrFunction
  mkdir out/oauthIntrospectFunction
  mkdir out/oauthMetadataFunction
  mkdir out/oauthRevokeFunction
  mkdir out/oauthTokenFunction

  cargo lambda build --release --manifest-path src/user-management/lambdas/create_user/Cargo.toml
  zip -r -j out/registerUserFunction/registerUserFunction.zip target/lambda/create-user/bootstrap
  
  cargo lambda build --release --manifest-path src/user-management/lambdas/login/Cargo.toml
  zip -r -j out/loginFunction/loginFunction.zip target/lambda/login/bootstrap
  
  cargo lambda build --release --manifest-path src/user-management/lambdas/get_user_details/Cargo.toml
  zip -r -j out/getUserDetailsFunction/getUserDetailsFunction.zip target/lambda/get-user-details/bootstrap

  cargo lambda build --release --manifest-path src/user-management/lambdas/handle_order_completed_for_user/Cargo.toml
  zip -r -j out/handleOrderCompletedFunction/handleOrderCompletedFunction.zip target/lambda/handle-order-completed/bootstrap

  cargo lambda build --release --manifest-path src/user-management/lambdas/oauth_authorize/Cargo.toml
  zip -r -j out/oauthAuthorizeFunction/oauthAuthorizeFunction.zip target/lambda/oauth_authorize/bootstrap

  cargo lambda build --release --manifest-path src/user-management/lambdas/oauth_authorize_callback/Cargo.toml
  zip -r -j out/oauthAuthorizeCallbackFunction/oauthAuthorizeCallbackFunction.zip target/lambda/oauth_authorize_callback/bootstrap

  cargo lambda build --release --manifest-path src/user-management/lambdas/oauth_client_delete/Cargo.toml
  zip -r -j out/oauthClientDeleteFunction/oauthClientDeleteFunction.zip target/lambda/oauth_client_delete/bootstrap

  cargo lambda build --release --manifest-path src/user-management/lambdas/oauth_client_get/Cargo.toml
  zip -r -j out/oauthClientGetFunction/oauthClientGetFunction.zip target/lambda/oauth_client_get/bootstrap

  cargo lambda build --release --manifest-path src/user-management/lambdas/oauth_client_update/Cargo.toml
  zip -r -j out/oauthClientUpdateFunction/oauthClientUpdateFunction.zip target/lambda/oauth_client_update/bootstrap

  cargo lambda build --release --manifest-path src/user-management/lambdas/oauth_dcr/Cargo.toml
  zip -r -j out/oauthDcrFunction/oauthDcrFunction.zip target/lambda/oauth_dcr/bootstrap

  cargo lambda build --release --manifest-path src/user-management/lambdas/oauth_introspect/Cargo.toml
  zip -r -j out/oauthIntrospectFunction/oauthIntrospectFunction.zip target/lambda/oauth_introspect/bootstrap

  cargo lambda build --release --manifest-path src/user-management/lambdas/oauth_metadata/Cargo.toml
  zip -r -j out/oauthMetadataFunction/oauthMetadataFunction.zip target/lambda/oauth_metadata/bootstrap

  cargo lambda build --release --manifest-path src/user-management/lambdas/oauth_revoke/Cargo.toml
  zip -r -j out/oauthRevokeFunction/oauthRevokeFunction.zip target/lambda/oauth_revoke/bootstrap

  cargo lambda build --release --manifest-path src/user-management/lambdas/oauth_token/Cargo.toml
  zip -r -j out/oauthTokenFunction/oauthTokenFunction.zip target/lambda/oauth_token/bootstrap
}

deploy
