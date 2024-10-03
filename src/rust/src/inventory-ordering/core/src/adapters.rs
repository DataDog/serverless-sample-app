use async_trait::async_trait;
use opentelemetry::trace::TraceContextExt;
use serde::Serialize;
use tracing::instrument;
use tracing_opentelemetry::OpenTelemetrySpanExt;

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

        let span_context = tracing::Span::current().context().span().span_context().clone();

        let trace_id = span_context.trace_id().to_string().clone();
        let span_id = span_context.span_id().to_string().clone();

        let workflow_input = WorkflowInput{
            product_id: product_id,
            datadog: DatadogTracing{
                trace_id: trace_id,
                span_id: span_id,
                priority: 1,
                tags: "".to_string()
            }
        };

        self.client
            .start_execution()
            .set_state_machine_arn(Some(self.step_function_arn.clone()))
            .input(serde_json::to_string(&workflow_input).unwrap())
            .send()
            .await
            .map_err(|e| {
                tracing::error!("{}", e);

                ()
            })?;

        Ok(())
    }
}

#[derive(Serialize)]
struct WorkflowInput {
    #[serde(rename(serialize = "productId"))]
    product_id: String,
    #[serde(rename(serialize = "_datadog"))]
    datadog: DatadogTracing
}

#[derive(Serialize)]
struct DatadogTracing {
    #[serde(rename(serialize = "x-datadog-trace-id"))]
    trace_id: String,
    #[serde(rename(serialize = "x-datadog-parent-id"))]
    span_id: String,
    #[serde(rename(serialize = "x-datadog-sampling-priority"))]
    priority: i32,
    #[serde(rename(serialize = "x-datadog-tags"))]
    tags: String
}