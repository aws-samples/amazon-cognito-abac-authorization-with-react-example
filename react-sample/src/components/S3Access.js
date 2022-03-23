import React from 'react';
import AWS from 'aws-sdk';

import JSONPretty from 'react-json-pretty';

import Form from 'react-bootstrap/Form'
import Button from 'react-bootstrap/Button'

import Container from 'react-bootstrap/esm/Container';

const config = require('../configuration.json')

class S3Access extends React.Component {
    constructor(props) {
        super(props)
        this.state = {
            bucketName: config.bucketName,
            prefix: "",
            s3ListResults: null,
            errorCode: null,
            accessKeyId: "",
            secretAccessKey: "",
            sessionToken: ""
        }
    }

    /**
     * List files in S3 bucket
     *
     * 1. Identity pool created and configured to use user pool as idp
     * 2. Permissions defined on the iam role to allow s3 list
     * 3. Bucket created with proper x-origin policy to allow calls
     */
    getS3Data = (event) => {
        event.preventDefault();

        const cognitoUserpool = `cognito-idp.${config.region}.amazonaws.com/${config.userPoolId}`
        const identityPoolId = config.identityPoolId
        const identityToken = this.props.cognitoUser.signInUserSession.idToken.jwtToken

        AWS.config.region = config.region;
        AWS.config.credentials = new AWS.CognitoIdentityCredentials({
            IdentityPoolId: identityPoolId,
            Logins: {
                [cognitoUserpool]: identityToken
            }
        });
        
        // Make the call to obtain credentials
        AWS.config.credentials.get(() => {

            // Credentials will be available when this function is called.
            var accessKeyId = AWS.config.credentials.accessKeyId;
            var secretAccessKey = AWS.config.credentials.secretAccessKey;
            var sessionToken = AWS.config.credentials.sessionToken;
            
            var s3 = new AWS.S3();
            var params = {
                Bucket: this.state.bucketName,
                Prefix: this.state.prefix
            };

            s3.listObjects(params, (err, data) => {
                let error_code, s3_results
                if (err) { 
                    error_code = err.statusCode
                } 
                else {
                    s3_results = JSON.stringify(data.Contents,['Key'], 2)
                }

                this.setState({
                    errorCode: error_code, 
                    s3ListResults: s3_results,
                    accessKeyId: accessKeyId,
                    secretAccessKey: secretAccessKey,
                    sessionToken: sessionToken
                })
            });            
        });
    }

    render() {
        if (!this.props.cognitoUser) { 
            return <div> Not logged in </div>
        }

        const unauthorized = this.state.errorCode && this.state.errorCode === 403

        return (
            <div>
                <Container style={{width: '30%'}}>
                    <Form onSubmit={this.getS3Data}>
                        <Form.Group size="lg" controlId="bucket">
                            <Form.Label>Bucket name</Form.Label>
                            <Form.Control
                                autoFocus
                                type="text"
                                value={this.state.bucketName}
                                onChange={(e) => this.setState({bucketName: e.target.value})}
                            />
                        </Form.Group>
                        <Form.Group size="lg" controlId="prefix">
                            <Form.Label>Prefix</Form.Label>
                            <Form.Control
                                type="text"
                                value={this.state.prefix}
                                onChange={(e) => this.setState({prefix: e.target.value})}
                            />
                        </Form.Group>
                        
                        <Button size="lg" type="submit" style={{marginTop: '10px'}}>
                            Get S3 Data
                        </Button>
                    </Form>
                </Container>
                <Container>
                    {
                        unauthorized && <Container style={{color: 'red'}}>Unauthorized</Container>
                    }
                    <JSONPretty id="idtoken-json-pretty" data={this.state.s3ListResults} />
                    <p>Access Key Id: {this.state.accessKeyId}</p>
                    <p>Secret Access Key: {this.state.secretAccessKey}</p>
                    <p>Session Token: {this.state.sessionToken}</p>
                </Container>
            </div>
        )
    }
}

export default S3Access
