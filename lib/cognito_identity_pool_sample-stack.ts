import { Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';

import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3Deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as customResources from 'aws-cdk-lib/custom-resources';

export class CognitoIdentityPoolSampleStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Create a pre-token-generation lambda function which adds the 'department: Engineering' claim to user-tokens
    const preTokenLambda =  new lambda.Function(this, "PreTokenHandler", {
      runtime: lambda.Runtime.NODEJS_14_X,
      code: lambda.Code.fromAsset("resources"),
      handler: "pre-token-trigger.handler",
    });

    // Create a Cognito UserPool for authentication, attach the lambdaTrigger created above
    const userPool = new cognito.UserPool(this, "CognitoUserPool", {
      userPoolName: "AnyCompany-UserPool",
      selfSignUpEnabled: true,
      signInCaseSensitive: true,
      autoVerify: { 
        email: true 
      },
      standardAttributes: { 
        email: { 
          required: true,
          mutable: false
        }
      },
      userVerification: { 
        emailSubject: "Verify your email",
        emailBody: "Thanks for signing up. Your verification code is {####}",
        emailStyle: cognito.VerificationEmailStyle.CODE
      },
      lambdaTriggers: {
        preTokenGeneration: preTokenLambda
      },
      mfa: cognito.Mfa.OPTIONAL,
      mfaSecondFactor: {
        otp: true,
        sms: false
      }
    })

    // Define a Resource Server for the User Pool
    const resourceServerScope = new cognito.ResourceServerScope({scopeDescription: "Get all pets", scopeName: "read"})
    const resourceServer = new cognito.UserPoolResourceServer(this, "ResourceServer", {
      userPool: userPool,
      userPoolResourceServerName: "anycompanyAPI",
      identifier: "anycompany",
      scopes: [resourceServerScope]
    })

    // Create an App client for the User Pool
    // Using localhost for callback + logout for testing purposes
    const userPoolClient = new cognito.UserPoolClient(this, "UserPoolClient", {
      userPool: userPool,
      generateSecret: false,
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
          implicitCodeGrant: true
        },
        scopes: [
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.PROFILE,
          cognito.OAuthScope.resourceServer(resourceServer, resourceServerScope)
        ],
        callbackUrls: ["http://localhost"],
        logoutUrls: ["http://localhost"]
      }
    })

    // Get the UNIX timestamp in ms to ensure uniqueness in names
    const timestamp: string = String(new Date().getTime())

    // Create a domain for OAuth2 communication from the application <-> Cognito
    userPool.addDomain("CognitoDomain", { cognitoDomain: { domainPrefix: `anycompany-domain-${timestamp}` }})
    
    // Create a Cognito Authorizer for the sample API
    const auth = new apigw.CognitoUserPoolsAuthorizer(this, 'petsAuthorizer', {
      cognitoUserPools: [userPool]
    });
    
    // Create a sample Pets API.
    const api = new apigw.RestApi(this, 'PetsApiGW', {
      description: 'Example api gateway',
      deployOptions: {
        stageName: 'Prod',
      },
      defaultCorsPreflightOptions: {
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization'
        ],
        allowMethods: ['OPTIONS', 'GET'],
        allowCredentials: true,
        allowOrigins: apigw.Cors.ALL_ORIGINS
      },
    });

    const pets = api.root.addResource('pets')

    // Sample integration which returns some sample Pets data. This is used if deploying the sample application through the console too.
    const httpIntegration = new apigw.HttpIntegration('http://petstore.execute-api.eu-west-2.amazonaws.com/petstore/pets', {
      httpMethod: "GET",
      options: {
        passthroughBehavior: apigw.PassthroughBehavior.WHEN_NO_MATCH,
        integrationResponses: [{
          statusCode: "200",
          responseParameters: {
            "method.response.header.Access-Control-Allow-Origin": "'*'",
          }
        }]
      },
      proxy: false
    })

    // Create a GET for the sample API, attach the Cognito Authorizer
    pets.addMethod('GET', httpIntegration, {
      authorizer: auth,
      authorizationType: apigw.AuthorizationType.COGNITO,
      methodResponses: [{
        statusCode: '200',
        responseParameters: {
          'method.response.header.Access-Control-Allow-Origin': true
        }
      }]
    });

    const s3CorsRule: s3.CorsRule = { 
      allowedMethods: [s3.HttpMethods.GET],
      allowedOrigins: ["*"],
      allowedHeaders: ["*"],
      exposedHeaders: []
    }

    // Create the demo S3 bucket
    const s3Bucket = new s3.Bucket(this, "S3Bucket", {
      bucketName: `anycompany-bucket-${timestamp}`,
      cors: [ s3CorsRule ]
    })

    // Deploy sample .zip file to Engineering prefix
    new s3Deploy.BucketDeployment(this, "DeployEngineeringTestFile", {
      sources: [
        s3Deploy.Source.asset('resources/testfile-engineering')
      ],
      destinationBucket: s3Bucket,
      destinationKeyPrefix: "Engineering"
    }) 

    // Deploy sample .zip file to Legal prefix
    new s3Deploy.BucketDeployment(this, "DeployLegalTestFile", {
      sources: [
        s3Deploy.Source.asset('resources/testfile-legal')
      ],
      destinationBucket: s3Bucket,
      destinationKeyPrefix: "Legal"
    }) 

    // Create ABAC policy to allow access to S3 resources by matching prefix to department in Principal Tag (which come from the user token)
    const s3AccessStatement = new iam.PolicyStatement({
      resources: [s3Bucket.bucketArn],
      actions: [
        's3:List*'
      ],
      conditions: {
        'StringEquals': {
          's3:prefix': '${aws:PrincipalTag/department}'
        }
      },
      effect: iam.Effect.ALLOW
    })

    const authPolicyDocument = new iam.PolicyDocument({
      statements: [
        s3AccessStatement
      ]
    })

    const cognitoIdentityProviderProperty: cognito.CfnIdentityPool.CognitoIdentityProviderProperty = {
      clientId: userPoolClient.userPoolClientId,
      providerName: userPool.userPoolProviderName,
    };

    // Create the Identity Pool
    const identityPool = new cognito.CfnIdentityPool(this, "IdentityPool", {
      identityPoolName: "AnyCompanyIdentityPool",
      allowUnauthenticatedIdentities: false,
      cognitoIdentityProviders: [cognitoIdentityProviderProperty]
    })

    const authPolicyProperty: iam.CfnRole.PolicyProperty = { 
      policyDocument: authPolicyDocument,
      policyName: "AuthRoleAccessPolicy"
    }

    // Create an IAM role for authenticated users, attach ABAC policy to role
    const authRole = new iam.CfnRole(this, "CognitoAuthRole", {
      roleName: "CognitoIdentityPoolRole-Authorized",
      assumeRolePolicyDocument: {
        'Statement': [
          {
              'Effect': iam.Effect.ALLOW,
              'Action': ['sts:AssumeRoleWithWebIdentity', 'sts:TagSession'],
              'Condition': {
                  'StringEquals': {
                      'cognito-identity.amazonaws.com:aud': identityPool.ref,
                  },
                  'ForAnyValue:StringLike': {
                      'cognito-identity.amazonaws.com:amr': 'authenticated',
                  },
              },
              'Principal': {
                  'Federated': 'cognito-identity.amazonaws.com'
              }
          }
        ]
      },
      policies: [ authPolicyProperty ]
    })

    new cognito.CfnIdentityPoolRoleAttachment(this, "defaultRoles", {
      identityPoolId: identityPool.ref,
      roles: {
        'authenticated': authRole.attrArn
      }
    })

    const createParameters = {
      "IdentityPoolId": identityPool.ref,
      "IdentityProviderName": userPool.userPoolProviderName,
      "PrincipalTags": {
        "department": "department"
      },
      "UseDefaults": false
    }

    const setPrincipalTagAction = {
      action: "setPrincipalTagAttributeMap",
      service: "CognitoIdentity",
      parameters: createParameters,
      physicalResourceId: customResources.PhysicalResourceId.of(identityPool.ref)
    }

    const { region, account }  = Stack.of(this)
    const identityPoolArn = `arn:aws:cognito-identity:${region}:${account}:identitypool/${identityPool.ref}`

    // Creates a Custom resource (https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.custom_resources-readme.html)
    // This is necessary to attach Principal Tag mappings to the Identity Pool after it has been created.
    // This uses the SDK, rather than CDK code, as attaching Principal Tags through CDK is currently not supported yet
    new customResources.AwsCustomResource(this, 'CustomResourcePrincipalTags', {
      onCreate: setPrincipalTagAction,
      onUpdate: setPrincipalTagAction,
      policy: customResources.AwsCustomResourcePolicy.fromSdkCalls({
        resources: [identityPoolArn],
      }),
    })

    new CfnOutput(this, 'BucketName', { value: s3Bucket.bucketName })
    new CfnOutput(this, 'ApiGatewayUrl', { value: `https://${api.restApiId}.execute-api.${region}.amazonaws.com/Prod/pets` })
    new CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId })
    new CfnOutput(this, 'ClientId', { value: userPoolClient.userPoolClientId })
    new CfnOutput(this, 'IdentityPoolId', { value: identityPool.ref })
    new CfnOutput(this, 'Region', { value: region })
  }
}
