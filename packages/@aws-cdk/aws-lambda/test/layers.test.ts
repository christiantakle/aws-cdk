import '@aws-cdk/assert-internal/jest';
import * as path from 'path';
import { canonicalizeTemplate, ResourcePart, SynthUtils } from '@aws-cdk/assert-internal';
import * as s3 from '@aws-cdk/aws-s3';
import * as cdk from '@aws-cdk/core';
import * as cxapi from '@aws-cdk/cx-api';
import * as lambda from '../lib';

describe('layers', () => {
  test('creating a layer', () => {
    // GIVEN
    const stack = new cdk.Stack(undefined, 'TestStack');
    const bucket = new s3.Bucket(stack, 'Bucket');
    const code = new lambda.S3Code(bucket, 'ObjectKey');

    // WHEN
    new lambda.LayerVersion(stack, 'LayerVersion', {
      code,
      compatibleRuntimes: [lambda.Runtime.NODEJS_10_X],
    });

    // THEN
    expect(stack).toHaveResource('AWS::Lambda::LayerVersion', {
      Content: {
        S3Bucket: stack.resolve(bucket.bucketName),
        S3Key: 'ObjectKey',
      },
      CompatibleRuntimes: ['nodejs10.x'],
    });
  });

  test('granting access to a layer', () => {
    // GIVEN
    const stack = new cdk.Stack(undefined, 'TestStack');
    const bucket = new s3.Bucket(stack, 'Bucket');
    const code = new lambda.S3Code(bucket, 'ObjectKey');
    const layer = new lambda.LayerVersion(stack, 'LayerVersion', {
      code,
      compatibleRuntimes: [lambda.Runtime.NODEJS_10_X],
    });

    // WHEN
    layer.addPermission('GrantUsage-123456789012', { accountId: '123456789012' });
    layer.addPermission('GrantUsage-o-123456', { accountId: '*', organizationId: 'o-123456' });

    // THEN
    expect(stack).toHaveResource('AWS::Lambda::LayerVersionPermission', {
      Action: 'lambda:GetLayerVersion',
      LayerVersionArn: stack.resolve(layer.layerVersionArn),
      Principal: '123456789012',
    });
    expect(stack).toHaveResource('AWS::Lambda::LayerVersionPermission', {
      Action: 'lambda:GetLayerVersion',
      LayerVersionArn: stack.resolve(layer.layerVersionArn),
      Principal: '*',
      OrganizationId: 'o-123456',
    });
  });

  test('creating a layer with no runtimes compatible', () => {
    // GIVEN
    const stack = new cdk.Stack(undefined, 'TestStack');
    const bucket = new s3.Bucket(stack, 'Bucket');
    const code = new lambda.S3Code(bucket, 'ObjectKey');

    // THEN
    expect(() => new lambda.LayerVersion(stack, 'LayerVersion', { code, compatibleRuntimes: [] }))
      .toThrow(/supports no runtime/);
  });

  test('asset metadata is added to the cloudformation resource', () => {
    // GIVEN
    const stack = new cdk.Stack();
    stack.node.setContext(cxapi.ASSET_RESOURCE_METADATA_ENABLED_CONTEXT, true);

    // WHEN
    let layerCodePath = path.join(__dirname, 'layer-code');
    new lambda.LayerVersion(stack, 'layer', {
      code: lambda.Code.fromAsset(layerCodePath),
    });

    // THEN
    expect(canonicalizeTemplate(SynthUtils.toCloudFormation(stack))).toHaveResource('AWS::Lambda::LayerVersion', {
      Metadata: {
        'aws:asset:path': 'asset.Asset1Hash',
        'aws:asset:original-path': layerCodePath,
        'aws:asset:is-bundled': false,
        'aws:asset:property': 'Content',
      },
    }, ResourcePart.CompleteDefinition);
  });

  test('creating a layer with a removal policy', () => {
    // GIVEN
    const stack = new cdk.Stack();

    // WHEN
    new lambda.LayerVersion(stack, 'layer', {
      code: lambda.Code.fromAsset(path.join(__dirname, 'layer-code')),
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // THEN
    expect(canonicalizeTemplate(SynthUtils.toCloudFormation(stack))).toHaveResource('AWS::Lambda::LayerVersion', {
      UpdateReplacePolicy: 'Retain',
      DeletionPolicy: 'Retain',
    }, ResourcePart.CompleteDefinition);
  });

  test('specified compatible architectures is recognized', () => {
    const stack = new cdk.Stack();
    const bucket = new s3.Bucket(stack, 'Bucket');
    const code = new lambda.S3Code(bucket, 'ObjectKey');
    new lambda.LayerVersion(stack, 'MyLayer', {
      code,
      compatibleArchitectures: [lambda.Architecture.ARM_64],
    });

    expect(stack).toHaveResource('AWS::Lambda::LayerVersion', {
      CompatibleArchitectures: ['arm64'],
    });
  });
});
