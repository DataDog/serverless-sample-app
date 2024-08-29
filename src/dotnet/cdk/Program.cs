﻿using Amazon.CDK;
using ServerlessGettingStarted.CDK.Services.Product.Api;
using ServerlessGettingStarted.CDK.Services.Shared;

namespace ServerlessGettingStarted.CDK
{
    sealed class Program
    {
        public static void Main(string[] args)
        {
            var app = new App();
            var sharedStack = new SharedStack(app, "DotnetSharedStack");
            
            var productApiStack = new ProductApiStack(app, "DotnetProductApiStack", new StackProps());
            
            app.Synth();
        }
    }
}