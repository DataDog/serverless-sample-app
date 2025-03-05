cdk-deploy:
	cd src/shared-infra; cdk deploy
	cd ../../inventory-service; cdk deploy &; bg
