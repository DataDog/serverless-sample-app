using System.Collections.Generic;
using System.Linq;
using Amazon.CDK;
using Amazon.CDK.AWS.Lambda;
using Amazon.CDK.AWS.Lambda.DotNet;
using Amazon.CDK.AWS.Logs;
using Amazon.CDK.AWS.SecretsManager;
using Constructs;

namespace DotnetLambdaHybridTracing;

public record FunctionProps(string ServiceName, string Env, string Version, string FunctionName, string ProjectPath, string Handler, Dictionary<string, string> EnvironmentVariables, ISecret DdApiKeySecret);

public class InstrumentedFunction : Construct
{
    public IFunction Function { get; private set; }
    
    public InstrumentedFunction(Construct scope, string id, FunctionProps props) : base(scope, id)
    {
        var functionName = $"{props.ServiceName}-{props.FunctionName}-{props.Env}";

        var defaultEnvironmentVariables = new Dictionary<string, string>()
        {
            { "POWERTOOLS_SERVICE_NAME", props.ServiceName },
            { "POWERTOOLS_LOG_LEVEL", "DEBUG" },
            { "AWS_LAMBDA_EXEC_WRAPPER", "/opt/datadog_wrapper" },
            { "DD_SITE", "datadoghq.eu" },
            { "DD_ENV", props.Env },
            { "ENV", props.Env },
            { "DD_VERSION", props.Version },
            { "DD_API_KEY_SECRET_ARN", props.DdApiKeySecret.SecretArn },
            { "DD_CAPTURE_LAMBDA_PAYLOAD", "true" },
        };
        
        Function = new DotNetFunction(this, id,
            new DotNetFunctionProps
            {
                ProjectDir = props.ProjectPath,
                Handler = props.Handler,
                MemorySize = 1024,
                Timeout = Duration.Seconds(29),
                Runtime = Runtime.DOTNET_8,
                Environment = defaultEnvironmentVariables.Union(props.EnvironmentVariables).ToDictionary(x => x.Key, x => x.Value),
                Architecture = Architecture.ARM_64,
                FunctionName = functionName,
                LogRetention = RetentionDays.ONE_DAY,
                Layers =
                [
                    LayerVersion.FromLayerVersionArn(this, "DDExtension", "arn:aws:lambda:eu-west-1:464622532012:layer:Datadog-Extension-ARM:59"),
                    LayerVersion.FromLayerVersionArn(this, "DDTrace", "arn:aws:lambda:eu-west-1:464622532012:layer:dd-trace-dotnet-ARM:15"),
                ],
            });

        props.DdApiKeySecret.GrantRead(Function);
    }
}