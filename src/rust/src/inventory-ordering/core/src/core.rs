use async_trait::async_trait;

#[async_trait]
pub trait OrderingWorkflow {
    async fn start_workflow_for(
        &self,
        product_id: String,
    ) -> Result<(), ()>;
}