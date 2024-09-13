use async_trait::async_trait;
use tracing::instrument;

use crate::core::OrderingWorkflow;

pub struct StepFunctionsWorkflow {
    client: aws_sdk_sfn::Client,
    step_function_arn: String
}

impl StepFunctionsWorkflow {
    pub fn new(client: aws_sdk_sfn::Client, step_function_arn: String) -> StepFunctionsWorkflow {
        StepFunctionsWorkflow { client, step_function_arn }
    }
}

#[async_trait]
impl OrderingWorkflow for StepFunctionsWorkflow {
    #[instrument(
        name = "start_step_function_workflow",
        skip(self, product_id)
        fields(workflow_arn=self.step_function_arn)
    )]
    async fn start_workflow_for(
        &self,
        product_id: String,
    ) -> Result<(), ()>{


        self.client
            .start_execution()
            .set_state_machine_arn(Some(self.step_function_arn.clone()))
            .input(format!("{{\"productId\":\"{}\"}}", &product_id))
            .send()
            .await
            .map_err(|e| {
                tracing::error!("{}", e);

                ()
            })?;

        Ok(())
    }
}
