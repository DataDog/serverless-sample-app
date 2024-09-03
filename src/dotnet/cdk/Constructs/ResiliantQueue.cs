using Amazon.CDK.AWS.SQS;
using Constructs;

namespace ServerlessGettingStarted.CDK.Constructs;

public record ResilientQueueProps(string QueueName, string Env);

public class ResilientQueue : Construct
{
    public IQueue Queue { get; }
    public IQueue Dlq { get; }

    public ResilientQueue(Construct scope, string id, ResilientQueueProps props) : base(scope, id)
    {
        this.Dlq = new Queue(this, $"{props.QueueName}DLQ-{props.Env}", new QueueProps()
        {
            QueueName = $"{props.QueueName}DLQ-{props.Env}"
        });
        this.Queue = new Queue(this, $"{props.QueueName}-{props.Env}", new QueueProps()
        {
            QueueName = $"{props.QueueName}-{props.Env}",
            DeadLetterQueue = new DeadLetterQueue()
            {
                Queue = this.Dlq,
                MaxReceiveCount = 3
            }
        });
    }
}