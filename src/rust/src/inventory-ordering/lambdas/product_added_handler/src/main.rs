use aws_lambda_events::sns::SnsEvent;
use inventory_ordering_core::{
    adapters::StepFunctionsWorkflow, core::OrderingWorkflow, ports::handle_product_added_event,
};
use lambda_runtime::{run, service_fn, Error, LambdaEvent};
use observability::{observability, TracedMessage};
use tracing::instrument;
use tracing_subscriber::util::SubscriberInitExt;

#[instrument(name = "handle-product-added", skip(workflow, event))]
async fn function_handler<TWorkflow: OrderingWorkflow>(
    workflow: &TWorkflow,
    event: LambdaEvent<SnsEvent>,
) -> Result<(), Error> {
    for sns_record in &event.payload.records {
        let traced_message: TracedMessage = sns_record.into();
        let evt = serde_json::from_str(&traced_message.message).unwrap();

        handle_product_added_event(workflow, evt).await?;
    }

    Ok(())
}
#[tokio::main]
async fn main() -> Result<(), Error> {
    observability().init();

    let workflow_arn = std::env::var("ORDERING_SERVICE_WORKFLOW_ARN")
        .expect("ORDERING_SERVICE_WORKFLOW_ARN is not set");
    let config = aws_config::load_from_env().await;
    let sfn_client = aws_sdk_sfn::Client::new(&config);
    let event_publisher = StepFunctionsWorkflow::new(sfn_client, workflow_arn);

    run(service_fn(|event| {
        function_handler(&event_publisher, event)
    }))
    .await
}
