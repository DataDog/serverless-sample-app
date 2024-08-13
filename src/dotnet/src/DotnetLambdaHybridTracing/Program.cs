using Amazon.CDK;

namespace DotnetLambdaHybridTracing
{
    sealed class Program
    {
        public static void Main(string[] args)
        {
            var app = new App();
            new DotnetLambdaHybridTracingStack(app, "DotnetLambdaHybridTracingStack", new StackProps());
            
            Tags.Of(app).Add("env", "test");
            Tags.Of(app).Add("service", "dotnet-trace-testing");
            Tags.Of(app).Add("version", "testing");
            
            app.Synth();
        }
    }
}
