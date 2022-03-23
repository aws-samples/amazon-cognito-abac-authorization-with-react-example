import React from 'react';
import axios from 'axios';
import JSONPretty from 'react-json-pretty';

import Button from 'react-bootstrap/Button'
import Container from 'react-bootstrap/esm/Container';

const config = require('../configuration.json')

class ApiAccess extends React.Component {
    constructor(props) {
        super(props)
        this.state = {
            api_result: ""
        }
    }

    /**
     * Call protected APIGW endpoint
     *
     * Important:
     *   Make sure apigw cognito authorizer configuration is complete
     *   Make sure api accepts id-token (no oauth scope defined in authorization)
     *   You can only use id-token since custom scopes are not supported when sdk is used
     */
    callAPIGW = () => {

        const apiGatewayUrl = config.apiGatewayUrl;

        // set ID Token in "Authorization" header
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': this.props.cognitoUser.signInUserSession.idToken.jwtToken
        }

        axios.get(apiGatewayUrl, { headers: headers }).then((response) => {
            this.setState({api_result: JSON.stringify(response.data,null, 2)});
        }).catch(function (error) {
            console.error(error);
        });
    }

    render() {
        if (!this.props.cognitoUser) { return <div> Not logged in </div>}
        return (
            <div>
                <Container>
                    <Button onClick={this.callAPIGW}>Call API</Button>
                </Container>
                {
                    this.state.api_result && <JSONPretty id="idtoken-json-pretty" data={this.state.api_result} />
                }
            </div>
        )
    }
}

export default ApiAccess